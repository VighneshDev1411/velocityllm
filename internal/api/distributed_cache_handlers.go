package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/cache"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// GetDistributedCacheStatsHandler returns cluster-wide distributed cache statistics (Day 48)
func GetDistributedCacheStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	dc := cache.GetDistributedCache()
	if dc == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Distributed cache not initialized")
		return
	}

	stats := dc.GetStats()
	types.WriteSuccess(w, "Distributed cache stats retrieved", stats)
}

// GetHashRingHandler returns consistent hash ring state and node distribution (Day 48)
func GetHashRingHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	dc := cache.GetDistributedCache()
	if dc == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Distributed cache not initialized")
		return
	}

	stats := dc.GetStats()
	result := map[string]interface{}{
		"nodes":        stats["node_list"],
		"node_count":   stats["cluster_nodes"],
		"distribution": stats["ring_distribution"],
		"replication":  stats["replication_factor"],
	}
	types.WriteSuccess(w, "Hash ring state retrieved", result)
}

// GetKeyRoutingHandler returns which node owns a cache key and its replicas (Day 48)
func GetKeyRoutingHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	key := r.URL.Query().Get("key")
	if key == "" {
		types.WriteError(w, http.StatusBadRequest, "key parameter required")
		return
	}

	dc := cache.GetDistributedCache()
	if dc == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Distributed cache not initialized")
		return
	}

	info := dc.GetKeyInfo(key)
	types.WriteSuccess(w, "Key routing info retrieved", info)
}

// DistributedInvalidateHandler broadcasts cache invalidation across all nodes (Day 48)
func DistributedInvalidateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	dc := cache.GetDistributedCache()
	if dc == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Distributed cache not initialized")
		return
	}

	var req struct {
		Key     string `json:"key"`
		Tag     string `json:"tag"`
		Pattern string `json:"pattern"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Tag != "" {
		dc.InvalidateByTag(req.Tag)
		types.WriteSuccess(w, "Tag invalidation broadcast to cluster", map[string]string{"tag": req.Tag})
	} else if req.Key != "" {
		dc.Invalidate(req.Key)
		types.WriteSuccess(w, "Key invalidation broadcast to cluster", map[string]string{"key": req.Key})
	} else {
		types.WriteError(w, http.StatusBadRequest, "key or tag parameter required")
	}
}

// DistributedClearHandler broadcasts full cache clear across all nodes (Day 48)
func DistributedClearHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	dc := cache.GetDistributedCache()
	if dc == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Distributed cache not initialized")
		return
	}

	dc.Clear()
	types.WriteSuccess(w, "Cache clear broadcast to all cluster nodes", nil)
}

// AddCacheNodeHandler adds a node to the distributed cache ring (Day 48)
func AddCacheNodeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	dc := cache.GetDistributedCache()
	if dc == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Distributed cache not initialized")
		return
	}

	var req struct {
		NodeID string `json:"node_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.NodeID == "" {
		types.WriteError(w, http.StatusBadRequest, "node_id required")
		return
	}

	dc.AddNode(req.NodeID)
	types.WriteSuccess(w, "Node added to cache ring", map[string]interface{}{
		"node_id":    req.NodeID,
		"total_nodes": dc.GetStats()["cluster_nodes"],
	})
}

// RemoveCacheNodeHandler removes a node from the distributed cache ring (Day 48)
func RemoveCacheNodeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	dc := cache.GetDistributedCache()
	if dc == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Distributed cache not initialized")
		return
	}

	var req struct {
		NodeID string `json:"node_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.NodeID == "" {
		types.WriteError(w, http.StatusBadRequest, "node_id required")
		return
	}

	dc.RemoveNode(req.NodeID)
	types.WriteSuccess(w, "Node removed from cache ring", map[string]interface{}{
		"node_id":    req.NodeID,
		"total_nodes": dc.GetStats()["cluster_nodes"],
	})
}
