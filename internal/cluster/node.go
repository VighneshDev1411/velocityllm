package cluster

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/redis/go-redis/v9"
)

const (
	nodeKeyPrefix     = "cluster:node:"
	nodeIndexKey      = "cluster:nodes"
	heartbeatTTL      = 30 * time.Second
	heartbeatInterval = 10 * time.Second
)

// NodeStatus represents the lifecycle state of a cluster node.
type NodeStatus string

const (
	NodeStatusActive   NodeStatus = "active"
	NodeStatusDraining NodeStatus = "draining"
	NodeStatusStopped  NodeStatus = "stopped"
)

// NodeInfo holds the metadata for a single cluster instance.
type NodeInfo struct {
	ID        string     `json:"id"`
	Hostname  string     `json:"hostname"`
	Port      int        `json:"port"`
	StartTime time.Time  `json:"start_time"`
	Status    NodeStatus `json:"status"`
	Version   string     `json:"version"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// NodeRegistry registers this node in Redis and maintains a heartbeat so other
// instances can discover the full cluster topology.
type NodeRegistry struct {
	redis    *redis.Client
	nodeInfo NodeInfo
	mu       sync.RWMutex
	stopChan chan struct{}
}

var (
	globalRegistry *NodeRegistry
	registryOnce   sync.Once
)

// NewNodeRegistry constructs a NodeRegistry for the given nodeID.
func NewNodeRegistry(rdb *redis.Client, nodeID, version string, port int) *NodeRegistry {
	hostname, _ := os.Hostname()
	return &NodeRegistry{
		redis: rdb,
		nodeInfo: NodeInfo{
			ID:        nodeID,
			Hostname:  hostname,
			Port:      port,
			StartTime: time.Now(),
			Status:    NodeStatusActive,
			Version:   version,
			UpdatedAt: time.Now(),
		},
		stopChan: make(chan struct{}),
	}
}

// InitGlobalNodeRegistry creates the singleton NodeRegistry.
func InitGlobalNodeRegistry(rdb *redis.Client, nodeID, version string, port int) *NodeRegistry {
	registryOnce.Do(func() {
		globalRegistry = NewNodeRegistry(rdb, nodeID, version, port)
	})
	return globalRegistry
}

// GetGlobalNodeRegistry returns the singleton NodeRegistry.
func GetGlobalNodeRegistry() *NodeRegistry { return globalRegistry }

// Register writes this node into Redis and starts the heartbeat goroutine.
func (nr *NodeRegistry) Register(ctx context.Context) error {
	nr.mu.Lock()
	nr.nodeInfo.Status = NodeStatusActive
	nr.nodeInfo.UpdatedAt = time.Now()
	nr.mu.Unlock()

	if err := nr.saveNodeInfo(ctx); err != nil {
		return fmt.Errorf("register node: %w", err)
	}
	if err := nr.redis.SAdd(ctx, nodeIndexKey, nr.nodeInfo.ID).Err(); err != nil {
		return fmt.Errorf("add node to index: %w", err)
	}

	go nr.heartbeatLoop()
	utils.Info("Cluster node registered: %s (host: %s, port: %d)", nr.nodeInfo.ID, nr.nodeInfo.Hostname, nr.nodeInfo.Port)
	return nil
}

// Deregister marks the node as stopped and removes it from Redis.
func (nr *NodeRegistry) Deregister(ctx context.Context) {
	select {
	case <-nr.stopChan:
	default:
		close(nr.stopChan)
	}
	nr.redis.SRem(ctx, nodeIndexKey, nr.nodeInfo.ID)
	nr.redis.Del(ctx, nr.nodeKey())
	utils.Info("Cluster node deregistered: %s", nr.nodeInfo.ID)
}

// SetDraining marks the node as draining (no new requests) during graceful shutdown.
func (nr *NodeRegistry) SetDraining(ctx context.Context) error {
	nr.mu.Lock()
	nr.nodeInfo.Status = NodeStatusDraining
	nr.mu.Unlock()
	return nr.saveNodeInfo(ctx)
}

// GetNodeInfo returns a snapshot of this node's metadata.
func (nr *NodeRegistry) GetNodeInfo() NodeInfo {
	nr.mu.RLock()
	defer nr.mu.RUnlock()
	return nr.nodeInfo
}

// GetAllNodes returns info for every node currently registered in the cluster.
// Nodes whose TTL has expired are cleaned from the index automatically.
func (nr *NodeRegistry) GetAllNodes(ctx context.Context) ([]NodeInfo, error) {
	ids, err := nr.redis.SMembers(ctx, nodeIndexKey).Result()
	if err != nil {
		return nil, err
	}
	nodes := make([]NodeInfo, 0, len(ids))
	for _, id := range ids {
		data, err := nr.redis.Get(ctx, nodeKeyPrefix+id).Bytes()
		if err != nil {
			// TTL expired — stale node, clean it up
			nr.redis.SRem(ctx, nodeIndexKey, id)
			continue
		}
		var n NodeInfo
		if json.Unmarshal(data, &n) == nil {
			nodes = append(nodes, n)
		}
	}
	return nodes, nil
}

// GetActiveNodeCount returns the number of nodes with status "active".
func (nr *NodeRegistry) GetActiveNodeCount(ctx context.Context) int {
	nodes, err := nr.GetAllNodes(ctx)
	if err != nil {
		return 1
	}
	count := 0
	for _, n := range nodes {
		if n.Status == NodeStatusActive {
			count++
		}
	}
	return count
}

// heartbeatLoop refreshes this node's Redis TTL on every tick.
func (nr *NodeRegistry) heartbeatLoop() {
	ticker := time.NewTicker(heartbeatInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			nr.mu.Lock()
			nr.nodeInfo.UpdatedAt = time.Now()
			nr.mu.Unlock()
			if err := nr.saveNodeInfo(ctx); err != nil {
				utils.Error("Heartbeat failed for node %s: %v", nr.nodeInfo.ID, err)
			}
			cancel()
		case <-nr.stopChan:
			return
		}
	}
}

func (nr *NodeRegistry) saveNodeInfo(ctx context.Context) error {
	nr.mu.RLock()
	data, err := json.Marshal(nr.nodeInfo)
	nr.mu.RUnlock()
	if err != nil {
		return err
	}
	return nr.redis.Set(ctx, nr.nodeKey(), data, heartbeatTTL).Err()
}

func (nr *NodeRegistry) nodeKey() string { return nodeKeyPrefix + nr.nodeInfo.ID }
