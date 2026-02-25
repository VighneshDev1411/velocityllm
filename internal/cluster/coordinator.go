package cluster

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/redis/go-redis/v9"
)

const (
	leaderLockKey  = "leader"       // logical key; becomes "lock:leader" in Redis
	leaderLockTTL  = 15 * time.Second
	electionPeriod = 5 * time.Second
)

// ClusterStatus is the snapshot returned by the cluster status API.
type ClusterStatus struct {
	TotalNodes   int        `json:"total_nodes"`
	ActiveNodes  int        `json:"active_nodes"`
	LeaderNodeID string     `json:"leader_node_id"`
	IsLeader     bool       `json:"is_leader"`
	ThisNode     NodeInfo   `json:"this_node"`
	Nodes        []NodeInfo `json:"nodes"`
}

// Coordinator manages leader election and exposes cluster-wide status.
// Leadership is based on a Redis lock whose value is the winning node's ID,
// making it trivial to identify the leader without a separate key.
type Coordinator struct {
	registry   *NodeRegistry
	redis      *redis.Client
	leaderLock *DistributedLock
	isLeader   bool
	mu         sync.RWMutex
	stopChan   chan struct{}
}

var (
	globalCoordinator *Coordinator
	coordinatorOnce   sync.Once
)

// NewCoordinator creates a Coordinator for the given node.
func NewCoordinator(registry *NodeRegistry, rdb *redis.Client) *Coordinator {
	nodeID := registry.GetNodeInfo().ID
	return &Coordinator{
		registry:   registry,
		redis:      rdb,
		leaderLock: newDistributedLockWithValue(rdb, leaderLockKey, nodeID, leaderLockTTL),
		stopChan:   make(chan struct{}),
	}
}

// InitGlobalCoordinator creates the singleton Coordinator.
func InitGlobalCoordinator(registry *NodeRegistry, rdb *redis.Client) *Coordinator {
	coordinatorOnce.Do(func() {
		globalCoordinator = NewCoordinator(registry, rdb)
	})
	return globalCoordinator
}

// GetGlobalCoordinator returns the singleton Coordinator.
func GetGlobalCoordinator() *Coordinator { return globalCoordinator }

// Start launches the background election loop.
func (c *Coordinator) Start(ctx context.Context) {
	go c.electionLoop(ctx)
	utils.Info("Cluster coordinator started (node: %s)", c.registry.GetNodeInfo().ID)
}

// Stop releases leadership and halts the election loop.
func (c *Coordinator) Stop() {
	select {
	case <-c.stopChan:
	default:
		close(c.stopChan)
	}
	c.mu.RLock()
	leader := c.isLeader
	c.mu.RUnlock()
	if leader {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if err := c.leaderLock.Unlock(ctx); err != nil {
			utils.Error("Failed to release leader lock: %v", err)
		} else {
			utils.Info("Released cluster leader lock")
		}
		c.mu.Lock()
		c.isLeader = false
		c.mu.Unlock()
	}
}

// IsLeader returns true if this node currently holds the leader lock.
func (c *Coordinator) IsLeader() bool {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.isLeader
}

// GetLeaderID returns the node ID of the current leader by reading the lock value.
func (c *Coordinator) GetLeaderID(ctx context.Context) string {
	return c.leaderLock.CurrentHolder(ctx)
}

// AcquireLock is a convenience helper for callers that need a one-off
// distributed lock unrelated to leader election.
func (c *Coordinator) AcquireLock(key string, ttl time.Duration) *DistributedLock {
	return NewDistributedLock(c.redis, key, ttl)
}

// GetClusterStatus returns a point-in-time view of the whole cluster.
func (c *Coordinator) GetClusterStatus(ctx context.Context) (ClusterStatus, error) {
	nodes, err := c.registry.GetAllNodes(ctx)
	if err != nil {
		return ClusterStatus{}, fmt.Errorf("get nodes: %w", err)
	}
	active := 0
	for _, n := range nodes {
		if n.Status == NodeStatusActive {
			active++
		}
	}
	return ClusterStatus{
		TotalNodes:   len(nodes),
		ActiveNodes:  active,
		LeaderNodeID: c.GetLeaderID(ctx),
		IsLeader:     c.IsLeader(),
		ThisNode:     c.registry.GetNodeInfo(),
		Nodes:        nodes,
	}, nil
}

// electionLoop periodically attempts to become (or stay) the cluster leader.
func (c *Coordinator) electionLoop(ctx context.Context) {
	ticker := time.NewTicker(electionPeriod)
	defer ticker.Stop()
	c.tryBecomeLeader(ctx) // immediate first attempt
	for {
		select {
		case <-ticker.C:
			c.tryBecomeLeader(ctx)
		case <-c.stopChan:
			return
		case <-ctx.Done():
			return
		}
	}
}

func (c *Coordinator) tryBecomeLeader(ctx context.Context) {
	tCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	c.mu.RLock()
	alreadyLeader := c.isLeader
	c.mu.RUnlock()

	if alreadyLeader {
		// Extend our existing lease
		if err := c.leaderLock.Extend(tCtx); err != nil {
			c.mu.Lock()
			c.isLeader = false
			c.mu.Unlock()
			utils.Info("Lost cluster leadership (lease expired): %v", err)
		}
		return
	}

	// Try to win the election
	if err := c.leaderLock.TryLock(tCtx); err == nil {
		c.mu.Lock()
		c.isLeader = true
		c.mu.Unlock()
		utils.Info("Elected as cluster leader: %s", c.registry.GetNodeInfo().ID)
	}
}
