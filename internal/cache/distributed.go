package cache

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"
)

// CacheEvent types for pub/sub broadcast
const (
	EventInvalidate    = "invalidate"
	EventInvalidateTag = "invalidate_tag"
	EventClear         = "clear"
	EventUpdate        = "update"

	// Redis pub/sub channel for cache coordination
	CacheChannel = "velocityllm:cache:events"
)

// CacheEvent represents a distributed cache event broadcast via pub/sub.
type CacheEvent struct {
	Type      string `json:"type"`
	Key       string `json:"key,omitempty"`
	Tag       string `json:"tag,omitempty"`
	Pattern   string `json:"pattern,omitempty"`
	NodeID    string `json:"node_id"`
	Timestamp int64  `json:"timestamp"`
	Epoch     uint64 `json:"epoch"`
}

// DistributedCacheConfig holds configuration for the distributed cache layer.
type DistributedCacheConfig struct {
	NodeID           string
	ReplicaCount     int           // virtual nodes per physical node in hash ring
	ReplicationFactor int          // number of nodes to replicate writes to
	SyncInterval     time.Duration // how often to sync cluster state
	MaxSyncRetries   int
	EnablePubSub     bool
}

// DefaultDistributedCacheConfig returns sensible defaults.
func DefaultDistributedCacheConfig() DistributedCacheConfig {
	return DistributedCacheConfig{
		NodeID:           "node-1",
		ReplicaCount:     150,
		ReplicationFactor: 2,
		SyncInterval:     10 * time.Second,
		MaxSyncRetries:   3,
		EnablePubSub:     true,
	}
}

// DistributedCache coordinates cache operations across multiple nodes.
// It wraps the existing CacheManager and adds:
// - Consistent hashing for key routing
// - Pub/Sub for cross-node invalidation
// - Cache epoch tracking for coherence
// - Cluster-wide statistics aggregation
type DistributedCache struct {
	mu            sync.RWMutex
	config        DistributedCacheConfig
	ring          *HashRing
	localManager  *CacheManager
	epoch         uint64 // monotonically increasing version for coherence
	stats         *DistributedCacheStats
	stopCh        chan struct{}
	subscribeDone chan struct{}
}

// DistributedCacheStats tracks cluster-wide cache metrics.
type DistributedCacheStats struct {
	mu                sync.RWMutex
	LocalHits         int64            `json:"local_hits"`
	LocalMisses       int64            `json:"local_misses"`
	RemoteHits        int64            `json:"remote_hits"`
	RemoteMisses      int64            `json:"remote_misses"`
	InvalidationsSent int64            `json:"invalidations_sent"`
	InvalidationsRecv int64            `json:"invalidations_received"`
	ReplicationWrites int64            `json:"replication_writes"`
	PubSubErrors      int64            `json:"pubsub_errors"`
	ClusterNodes      int              `json:"cluster_nodes"`
	CurrentEpoch      uint64           `json:"current_epoch"`
	NodeStats         map[string]int64 `json:"node_stats"`
	LastSyncTime      time.Time        `json:"last_sync_time"`
}

func newDistributedStats() *DistributedCacheStats {
	return &DistributedCacheStats{
		NodeStats: make(map[string]int64),
	}
}

// Global distributed cache instance
var (
	globalDistCache     *DistributedCache
	globalDistCacheLock sync.RWMutex
)

// InitDistributedCache initializes the global distributed cache.
func InitDistributedCache(config DistributedCacheConfig, localManager *CacheManager) *DistributedCache {
	dc := &DistributedCache{
		config:        config,
		ring:          NewHashRing(config.ReplicaCount),
		localManager:  localManager,
		stats:         newDistributedStats(),
		stopCh:        make(chan struct{}),
		subscribeDone: make(chan struct{}),
	}

	// Add self to the hash ring
	dc.ring.AddNode(config.NodeID)

	// Start pub/sub listener if Redis is available and enabled
	if config.EnablePubSub && RedisClient != nil {
		go dc.subscribeToEvents()
	}

	// Start periodic sync
	go dc.periodicSync()

	globalDistCacheLock.Lock()
	globalDistCache = dc
	globalDistCacheLock.Unlock()

	log.Printf("[DistributedCache] Initialized node=%s replicas=%d replication=%d pubsub=%v",
		config.NodeID, config.ReplicaCount, config.ReplicationFactor, config.EnablePubSub)

	return dc
}

// GetDistributedCache returns the global distributed cache instance.
func GetDistributedCache() *DistributedCache {
	globalDistCacheLock.RLock()
	defer globalDistCacheLock.RUnlock()
	return globalDistCache
}

// ── Core Operations ──────────────────────────────────────────────

// Get retrieves a value, checking local cache first, then the responsible node.
func (dc *DistributedCache) Get(ctx context.Context, key string, dest interface{}) (bool, error) {
	// Always check local cache first (fastest path)
	if dc.localManager != nil {
		found, _, err := dc.localManager.Get(ctx, key, dest)
		if err == nil && found {
			atomic.AddInt64(&dc.stats.LocalHits, 1)
			return true, nil
		}
		atomic.AddInt64(&dc.stats.LocalMisses, 1)
	}

	// Check if this node is responsible for the key
	owner := dc.ring.GetNode(key)
	if owner == dc.config.NodeID {
		// We own this key but didn't find it locally — true miss
		atomic.AddInt64(&dc.stats.RemoteMisses, 1)
		return false, nil
	}

	// Key belongs to another node — try L2 (Redis, shared across nodes)
	if dc.localManager != nil {
		found, _, err := dc.localManager.Get(ctx, key, dest)
		if err == nil && found {
			atomic.AddInt64(&dc.stats.RemoteHits, 1)
			return true, nil
		}
	}
	atomic.AddInt64(&dc.stats.RemoteMisses, 1)
	return false, nil
}

// Set stores a value and replicates to peer nodes via pub/sub.
func (dc *DistributedCache) Set(ctx context.Context, key string, value interface{}) error {
	// Write to local cache
	if dc.localManager != nil {
		dc.localManager.Set(ctx, key, value)
	}

	// Increment epoch for coherence tracking
	newEpoch := atomic.AddUint64(&dc.epoch, 1)

	// Broadcast update event so other nodes can invalidate stale L1 entries
	dc.broadcastEvent(CacheEvent{
		Type:      EventUpdate,
		Key:       key,
		NodeID:    dc.config.NodeID,
		Timestamp: time.Now().UnixMilli(),
		Epoch:     newEpoch,
	})

	atomic.AddInt64(&dc.stats.ReplicationWrites, 1)
	return nil
}

// Invalidate removes a key from all nodes in the cluster.
func (dc *DistributedCache) Invalidate(key string) {
	ctx := context.Background()
	// Remove locally
	if dc.localManager != nil {
		dc.localManager.Delete(ctx, key)
	}

	// Broadcast to all nodes
	dc.broadcastEvent(CacheEvent{
		Type:      EventInvalidate,
		Key:       key,
		NodeID:    dc.config.NodeID,
		Timestamp: time.Now().UnixMilli(),
		Epoch:     atomic.AddUint64(&dc.epoch, 1),
	})

	atomic.AddInt64(&dc.stats.InvalidationsSent, 1)
}

// InvalidateByTag removes all keys with the given tag across the cluster.
func (dc *DistributedCache) InvalidateByTag(tag string) {
	// Remove locally via tagged cache
	tc := GetGlobalTaggedCache()
	if tc != nil {
		_, _ = tc.InvalidateByTag(context.Background(), tag)
	}

	// Broadcast tag invalidation
	dc.broadcastEvent(CacheEvent{
		Type:      EventInvalidateTag,
		Tag:       tag,
		NodeID:    dc.config.NodeID,
		Timestamp: time.Now().UnixMilli(),
		Epoch:     atomic.AddUint64(&dc.epoch, 1),
	})

	atomic.AddInt64(&dc.stats.InvalidationsSent, 1)
}

// Clear removes all cached data across the cluster.
func (dc *DistributedCache) Clear() {
	ctx := context.Background()
	if dc.localManager != nil {
		dc.localManager.Clear(ctx, "")
	}

	dc.broadcastEvent(CacheEvent{
		Type:      EventClear,
		NodeID:    dc.config.NodeID,
		Timestamp: time.Now().UnixMilli(),
		Epoch:     atomic.AddUint64(&dc.epoch, 1),
	})

	atomic.AddInt64(&dc.stats.InvalidationsSent, 1)
}

// ── Cluster Management ──────────────────────────────────────────

// AddNode registers a new node in the cluster ring.
func (dc *DistributedCache) AddNode(nodeID string) {
	dc.ring.AddNode(nodeID)
	dc.stats.mu.Lock()
	dc.stats.ClusterNodes = dc.ring.NodeCount()
	dc.stats.mu.Unlock()
	log.Printf("[DistributedCache] Node added: %s (total: %d)", nodeID, dc.ring.NodeCount())
}

// RemoveNode unregisters a node from the cluster ring.
func (dc *DistributedCache) RemoveNode(nodeID string) {
	dc.ring.RemoveNode(nodeID)
	dc.stats.mu.Lock()
	dc.stats.ClusterNodes = dc.ring.NodeCount()
	dc.stats.mu.Unlock()
	log.Printf("[DistributedCache] Node removed: %s (total: %d)", nodeID, dc.ring.NodeCount())
}

// GetKeyOwner returns which node owns a given cache key.
func (dc *DistributedCache) GetKeyOwner(key string) string {
	return dc.ring.GetNode(key)
}

// GetKeyReplicas returns the nodes that hold replicas of a key.
func (dc *DistributedCache) GetKeyReplicas(key string) []string {
	return dc.ring.GetNodes(key, dc.config.ReplicationFactor)
}

// ── Pub/Sub ─────────────────────────────────────────────────────

func (dc *DistributedCache) broadcastEvent(event CacheEvent) {
	if !dc.config.EnablePubSub || RedisClient == nil {
		return
	}

	data, err := json.Marshal(event)
	if err != nil {
		log.Printf("[DistributedCache] Failed to marshal event: %v", err)
		atomic.AddInt64(&dc.stats.PubSubErrors, 1)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	if err := RedisClient.Publish(ctx, CacheChannel, string(data)).Err(); err != nil {
		log.Printf("[DistributedCache] Failed to publish event: %v", err)
		atomic.AddInt64(&dc.stats.PubSubErrors, 1)
	}
}

func (dc *DistributedCache) subscribeToEvents() {
	defer close(dc.subscribeDone)

	if RedisClient == nil {
		return
	}

	ctx := context.Background()
	pubsub := RedisClient.Subscribe(ctx, CacheChannel)
	defer pubsub.Close()

	ch := pubsub.Channel()
	log.Printf("[DistributedCache] Subscribed to channel: %s", CacheChannel)

	for {
		select {
		case <-dc.stopCh:
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			dc.handleEvent(msg.Payload)
		}
	}
}

func (dc *DistributedCache) handleEvent(payload string) {
	var event CacheEvent
	if err := json.Unmarshal([]byte(payload), &event); err != nil {
		log.Printf("[DistributedCache] Invalid event: %v", err)
		return
	}

	// Ignore events from self
	if event.NodeID == dc.config.NodeID {
		return
	}

	atomic.AddInt64(&dc.stats.InvalidationsRecv, 1)

	// Update epoch if received is higher
	for {
		current := atomic.LoadUint64(&dc.epoch)
		if event.Epoch <= current {
			break
		}
		if atomic.CompareAndSwapUint64(&dc.epoch, current, event.Epoch) {
			break
		}
	}

	switch event.Type {
	case EventInvalidate:
		// Invalidate key in local L1 cache only (L2/Redis is shared)
		if dc.localManager != nil && dc.localManager.multiLevel != nil {
			dc.localManager.multiLevel.l1Cache.Delete(context.Background(), event.Key)
		}
		log.Printf("[DistributedCache] Invalidated key=%s from node=%s", event.Key, event.NodeID)

	case EventInvalidateTag:
		tc := GetGlobalTaggedCache()
		if tc != nil {
			_, _ = tc.InvalidateByTag(context.Background(), event.Tag)
		}
		log.Printf("[DistributedCache] Invalidated tag=%s from node=%s", event.Tag, event.NodeID)

	case EventUpdate:
		// Another node updated a key — invalidate our local L1 to avoid stale data
		if dc.localManager != nil && dc.localManager.multiLevel != nil {
			dc.localManager.multiLevel.l1Cache.Delete(context.Background(), event.Key)
		}

	case EventClear:
		if dc.localManager != nil && dc.localManager.multiLevel != nil {
			dc.localManager.multiLevel.l1Cache.Clear(context.Background())
		}
		log.Printf("[DistributedCache] Full cache clear from node=%s", event.NodeID)
	}

	// Track per-node stats
	dc.stats.mu.Lock()
	dc.stats.NodeStats[event.NodeID]++
	dc.stats.mu.Unlock()
}

// ── Periodic Sync ───────────────────────────────────────────────

func (dc *DistributedCache) periodicSync() {
	ticker := time.NewTicker(dc.config.SyncInterval)
	defer ticker.Stop()

	for {
		select {
		case <-dc.stopCh:
			return
		case <-ticker.C:
			dc.syncClusterState()
		}
	}
}

func (dc *DistributedCache) syncClusterState() {
	if RedisClient == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Register/heartbeat this node in Redis
	nodeKey := fmt.Sprintf("velocityllm:nodes:%s", dc.config.NodeID)
	nodeData, _ := json.Marshal(map[string]interface{}{
		"node_id":    dc.config.NodeID,
		"epoch":      atomic.LoadUint64(&dc.epoch),
		"timestamp":  time.Now().UnixMilli(),
		"local_hits": atomic.LoadInt64(&dc.stats.LocalHits),
		"local_misses": atomic.LoadInt64(&dc.stats.LocalMisses),
	})
	RedisClient.Set(ctx, nodeKey, string(nodeData), 30*time.Second)

	// Discover other nodes
	keys, err := RedisClient.Keys(ctx, "velocityllm:nodes:*").Result()
	if err == nil {
		for _, key := range keys {
			// Extract node ID and add to ring if not already present
			nodeID := key[len("velocityllm:nodes:"):]
			if nodeID != dc.config.NodeID {
				dc.ring.AddNode(nodeID)
			}
		}
	}

	dc.stats.mu.Lock()
	dc.stats.ClusterNodes = dc.ring.NodeCount()
	dc.stats.LastSyncTime = time.Now()
	dc.stats.CurrentEpoch = atomic.LoadUint64(&dc.epoch)
	dc.stats.mu.Unlock()
}

// ── Statistics ──────────────────────────────────────────────────

// GetStats returns current distributed cache statistics.
func (dc *DistributedCache) GetStats() map[string]interface{} {
	dc.stats.mu.RLock()
	defer dc.stats.mu.RUnlock()

	localHits := atomic.LoadInt64(&dc.stats.LocalHits)
	localMisses := atomic.LoadInt64(&dc.stats.LocalMisses)
	remoteHits := atomic.LoadInt64(&dc.stats.RemoteHits)
	remoteMisses := atomic.LoadInt64(&dc.stats.RemoteMisses)

	totalHits := localHits + remoteHits
	totalRequests := totalHits + localMisses + remoteMisses

	var hitRate float64
	if totalRequests > 0 {
		hitRate = float64(totalHits) / float64(totalRequests) * 100
	}

	// Get hash ring distribution
	distribution := dc.ring.GetDistribution()

	return map[string]interface{}{
		"node_id":               dc.config.NodeID,
		"cluster_nodes":         dc.ring.NodeCount(),
		"node_list":             dc.ring.GetAllNodes(),
		"replication_factor":    dc.config.ReplicationFactor,
		"current_epoch":         atomic.LoadUint64(&dc.epoch),
		"local_hits":            localHits,
		"local_misses":          localMisses,
		"remote_hits":           remoteHits,
		"remote_misses":         remoteMisses,
		"overall_hit_rate":      fmt.Sprintf("%.2f%%", hitRate),
		"invalidations_sent":    atomic.LoadInt64(&dc.stats.InvalidationsSent),
		"invalidations_received": atomic.LoadInt64(&dc.stats.InvalidationsRecv),
		"replication_writes":    atomic.LoadInt64(&dc.stats.ReplicationWrites),
		"pubsub_errors":         atomic.LoadInt64(&dc.stats.PubSubErrors),
		"pubsub_enabled":        dc.config.EnablePubSub,
		"ring_distribution":     distribution,
		"node_event_counts":     dc.stats.NodeStats,
		"last_sync":             dc.stats.LastSyncTime,
	}
}

// GetKeyInfo returns routing information for a specific cache key.
func (dc *DistributedCache) GetKeyInfo(key string) map[string]interface{} {
	return map[string]interface{}{
		"key":      key,
		"owner":    dc.ring.GetNode(key),
		"replicas": dc.ring.GetNodes(key, dc.config.ReplicationFactor),
		"is_local": dc.ring.GetNode(key) == dc.config.NodeID,
	}
}

// ── Shutdown ────────────────────────────────────────────────────

// Stop gracefully shuts down the distributed cache.
func (dc *DistributedCache) Stop() {
	close(dc.stopCh)
	// Wait for subscriber to finish
	select {
	case <-dc.subscribeDone:
	case <-time.After(5 * time.Second):
	}

	// Deregister from Redis
	if RedisClient != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		nodeKey := fmt.Sprintf("velocityllm:nodes:%s", dc.config.NodeID)
		RedisClient.Del(ctx, nodeKey)
	}

	log.Printf("[DistributedCache] Stopped node=%s", dc.config.NodeID)
}
