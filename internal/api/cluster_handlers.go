package api

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/cluster"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// GetClusterStatusHandler returns full cluster topology: all nodes, leader, this node.
// GET /api/v1/cluster/status
func GetClusterStatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	coord := cluster.GetGlobalCoordinator()
	if coord == nil {
		respondJSON(w, http.StatusServiceUnavailable, types.NewErrorResponse(
			"Cluster Unavailable", "Cluster coordinator not initialised",
		))
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	status, err := coord.GetClusterStatus(ctx)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, types.NewErrorResponse(
			"Cluster Error", err.Error(),
		))
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"cluster": status,
	})
}

// GetClusterNodesHandler lists every registered cluster node and its status.
// GET /api/v1/cluster/nodes
func GetClusterNodesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	reg := cluster.GetGlobalNodeRegistry()
	if reg == nil {
		respondJSON(w, http.StatusServiceUnavailable, types.NewErrorResponse(
			"Cluster Unavailable", "Node registry not initialised",
		))
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	nodes, err := reg.GetAllNodes(ctx)
	if err != nil {
		respondJSON(w, http.StatusInternalServerError, types.NewErrorResponse(
			"Registry Error", err.Error(),
		))
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success":      true,
		"total_nodes":  len(nodes),
		"active_nodes": reg.GetActiveNodeCount(ctx),
		"nodes":        nodes,
	})
}

// GetClusterLeaderHandler returns the current leader node ID.
// GET /api/v1/cluster/leader
func GetClusterLeaderHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	coord := cluster.GetGlobalCoordinator()
	if coord == nil {
		respondJSON(w, http.StatusServiceUnavailable, types.NewErrorResponse(
			"Cluster Unavailable", "Cluster coordinator not initialised",
		))
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	leaderID := coord.GetLeaderID(ctx)
	thisNode := cluster.GetGlobalNodeRegistry().GetNodeInfo()

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success":       true,
		"leader_node_id": leaderID,
		"is_this_node":  leaderID == thisNode.ID,
		"this_node_id":  thisNode.ID,
	})
}

// DrainNodeHandler marks this node as draining so the load balancer can
// stop sending new traffic before a graceful shutdown.
// POST /api/v1/cluster/drain
func DrainNodeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	reg := cluster.GetGlobalNodeRegistry()
	if reg == nil {
		respondJSON(w, http.StatusServiceUnavailable, types.NewErrorResponse(
			"Cluster Unavailable", "Node registry not initialised",
		))
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	if err := reg.SetDraining(ctx); err != nil {
		respondJSON(w, http.StatusInternalServerError, types.NewErrorResponse(
			"Drain Error", err.Error(),
		))
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Node is now draining — no new traffic will be routed here",
		"node_id": reg.GetNodeInfo().ID,
	})
}

// AcquireLockHandler acquires a named distributed lock (for testing/admin use).
// POST /api/v1/cluster/lock/acquire   body: {"key":"my-lock","ttl_seconds":30}
func AcquireLockHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Key        string `json:"key"`
		TTLSeconds int    `json:"ttl_seconds"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Key == "" {
		respondJSON(w, http.StatusBadRequest, types.NewErrorResponse(
			"Bad Request", "key and ttl_seconds are required",
		))
		return
	}
	if req.TTLSeconds <= 0 || req.TTLSeconds > 300 {
		req.TTLSeconds = 30
	}

	coord := cluster.GetGlobalCoordinator()
	if coord == nil {
		respondJSON(w, http.StatusServiceUnavailable, types.NewErrorResponse(
			"Cluster Unavailable", "Cluster coordinator not initialised",
		))
		return
	}

	ttl := time.Duration(req.TTLSeconds) * time.Second
	lock := coord.AcquireLock(req.Key, ttl)

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	if err := lock.TryLock(ctx); err != nil {
		respondJSON(w, http.StatusConflict, map[string]interface{}{
			"success":  false,
			"acquired": false,
			"message":  "Lock is currently held by another instance",
			"holder":   lock.CurrentHolder(ctx),
		})
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success":     true,
		"acquired":    true,
		"key":         req.Key,
		"ttl_seconds": req.TTLSeconds,
		"message":     "Lock acquired successfully",
	})
}

// helper shared across this package
func respondJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(payload)
}
