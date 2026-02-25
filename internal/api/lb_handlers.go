package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/loadbalancer"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// GetLBStatsHandler returns the load balancer pool statistics.
// GET /api/v1/lb/stats
func GetLBStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	lb := loadbalancer.GetGlobal()
	if lb == nil {
		respondJSON(w, http.StatusServiceUnavailable, types.NewErrorResponse(
			"LB Unavailable", "Load balancer not initialised",
		))
		return
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success":   true,
		"algorithm": lb.Algorithm(),
		"backends":  lb.Stats(),
	})
}

// GetLBBackendsHandler lists all backends with their health and weight.
// GET /api/v1/lb/backends
func GetLBBackendsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	lb := loadbalancer.GetGlobal()
	if lb == nil {
		respondJSON(w, http.StatusServiceUnavailable, types.NewErrorResponse(
			"LB Unavailable", "Load balancer not initialised",
		))
		return
	}
	stats := lb.Stats()
	healthy := 0
	for _, s := range stats {
		if s.Healthy && s.Active {
			healthy++
		}
	}
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success":          true,
		"total_backends":   len(stats),
		"healthy_backends": healthy,
		"backends":         stats,
	})
}

// UpdateLBAlgorithmHandler changes the routing algorithm at runtime.
// POST /api/v1/lb/algorithm   body: {"algorithm":"least_connections"}
func UpdateLBAlgorithmHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	lb := loadbalancer.GetGlobal()
	if lb == nil {
		respondJSON(w, http.StatusServiceUnavailable, types.NewErrorResponse(
			"LB Unavailable", "Load balancer not initialised",
		))
		return
	}
	var req struct {
		Algorithm string `json:"algorithm"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Algorithm == "" {
		respondJSON(w, http.StatusBadRequest, types.NewErrorResponse(
			"Bad Request", "algorithm field is required",
		))
		return
	}
	valid := map[string]bool{
		"round_robin": true, "weighted_round_robin": true,
		"least_connections": true, "ip_hash": true, "random": true,
	}
	if !valid[req.Algorithm] {
		respondJSON(w, http.StatusBadRequest, types.NewErrorResponse(
			"Invalid Algorithm",
			"Valid options: round_robin, weighted_round_robin, least_connections, ip_hash, random",
		))
		return
	}
	lb.SetAlgorithm(loadbalancer.Algorithm(req.Algorithm))
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success":   true,
		"algorithm": req.Algorithm,
		"message":   "Load balancing algorithm updated",
	})
}

// UpdateBackendWeightHandler changes an individual backend's routing weight.
// POST /api/v1/lb/backends/weight   body: {"id":"node-1","weight":80}
func UpdateBackendWeightHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	lb := loadbalancer.GetGlobal()
	if lb == nil {
		respondJSON(w, http.StatusServiceUnavailable, types.NewErrorResponse(
			"LB Unavailable", "Load balancer not initialised",
		))
		return
	}
	var req struct {
		ID     string `json:"id"`
		Weight int    `json:"weight"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
		respondJSON(w, http.StatusBadRequest, types.NewErrorResponse(
			"Bad Request", "id and weight are required",
		))
		return
	}
	if req.Weight < 1 || req.Weight > 100 {
		respondJSON(w, http.StatusBadRequest, types.NewErrorResponse(
			"Bad Request", "weight must be between 1 and 100",
		))
		return
	}
	lb.UpdateWeight(req.ID, req.Weight)
	respondJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"id":      req.ID,
		"weight":  req.Weight,
		"message": "Backend weight updated",
	})
}
