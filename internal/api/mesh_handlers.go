package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/mesh"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// GetMeshStatsHandler returns service mesh statistics (Day 50)
func GetMeshStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	m := mesh.GetServiceMesh()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Service mesh not initialized")
		return
	}

	types.WriteSuccess(w, "Service mesh stats retrieved", m.GetStats())
}

// GetMeshTopologyHandler returns the full mesh topology (Day 50)
func GetMeshTopologyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	m := mesh.GetServiceMesh()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Service mesh not initialized")
		return
	}

	types.WriteSuccess(w, "Mesh topology retrieved", m.GetTopology())
}

// DiscoverServiceHandler returns healthy instances of a service (Day 50)
func DiscoverServiceHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	serviceName := r.URL.Query().Get("service")
	if serviceName == "" {
		types.WriteError(w, http.StatusBadRequest, "service parameter required")
		return
	}

	m := mesh.GetServiceMesh()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Service mesh not initialized")
		return
	}

	instances := m.Discover(serviceName)
	result := make([]map[string]interface{}, 0, len(instances))
	for _, inst := range instances {
		result = append(result, map[string]interface{}{
			"id":       inst.ID,
			"endpoint": inst.Endpoint(),
			"version":  inst.Version,
			"status":   inst.Status,
			"health":   inst.Health,
			"region":   inst.Region,
			"weight":   inst.Weight,
		})
	}

	types.WriteSuccess(w, "Service instances discovered", map[string]interface{}{
		"service":   serviceName,
		"instances": result,
		"count":     len(result),
	})
}

// RouteServiceHandler selects the best instance for a service (Day 50)
func RouteServiceHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	serviceName := r.URL.Query().Get("service")
	if serviceName == "" {
		types.WriteError(w, http.StatusBadRequest, "service parameter required")
		return
	}

	m := mesh.GetServiceMesh()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Service mesh not initialized")
		return
	}

	instance, err := m.Route(serviceName)
	if err != nil {
		types.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	types.WriteSuccess(w, "Route selected", map[string]interface{}{
		"service":  serviceName,
		"instance": instance.ID,
		"endpoint": instance.Endpoint(),
		"version":  instance.Version,
		"health":   instance.Health,
	})
}

// GetTrafficPolicyHandler returns the traffic policy for a service (Day 50)
func GetTrafficPolicyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	serviceName := r.URL.Query().Get("service")
	if serviceName == "" {
		serviceName = "velocityllm"
	}

	m := mesh.GetServiceMesh()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Service mesh not initialized")
		return
	}

	policy := m.GetTrafficPolicy(serviceName)
	types.WriteSuccess(w, "Traffic policy retrieved", policy)
}

// SetTrafficPolicyHandler updates the traffic policy for a service (Day 50)
func SetTrafficPolicyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	m := mesh.GetServiceMesh()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Service mesh not initialized")
		return
	}

	var req struct {
		Service      string `json:"service"`
		Algorithm    string `json:"algorithm"`
		CBEnabled    *bool  `json:"circuit_breaker_enabled"`
		RetryMax     *int   `json:"retry_max_attempts"`
		TimeoutSec   *int   `json:"timeout_seconds"`
		CanaryEnable *bool  `json:"canary_enabled"`
		CanaryVersion string `json:"canary_version"`
		CanaryPct    *int   `json:"canary_traffic_pct"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Service == "" {
		req.Service = "velocityllm"
	}

	// Start from current or default policy
	policy := m.GetTrafficPolicy(req.Service)
	if policy == nil {
		p := mesh.DefaultTrafficPolicy()
		policy = &p
	}
	policy.Name = req.Service

	if req.Algorithm != "" {
		policy.LoadBalancing.Algorithm = req.Algorithm
	}
	if req.CBEnabled != nil {
		policy.CircuitBreaker.Enabled = *req.CBEnabled
	}
	if req.RetryMax != nil {
		policy.Retry.MaxAttempts = *req.RetryMax
	}
	if req.TimeoutSec != nil {
		policy.Timeout = time.Duration(*req.TimeoutSec) * time.Second
	}
	if req.CanaryEnable != nil && *req.CanaryEnable {
		policy.CanaryRouting = &mesh.CanaryPolicy{
			Enabled:       true,
			CanaryVersion: req.CanaryVersion,
			TrafficPct:    10,
		}
		if req.CanaryPct != nil {
			policy.CanaryRouting.TrafficPct = *req.CanaryPct
		}
	} else if req.CanaryEnable != nil && !*req.CanaryEnable {
		policy.CanaryRouting = nil
	}

	m.SetTrafficPolicy(req.Service, policy)
	types.WriteSuccess(w, "Traffic policy updated", policy)
}

// UpdateInstanceHealthHandler updates an instance's health (Day 50)
func UpdateInstanceHealthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	m := mesh.GetServiceMesh()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Service mesh not initialized")
		return
	}

	var req struct {
		InstanceID string `json:"instance_id"`
		Health     string `json:"health"` // healthy, degraded, unhealthy
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.InstanceID == "" || req.Health == "" {
		types.WriteError(w, http.StatusBadRequest, "instance_id and health required")
		return
	}

	m.UpdateInstanceHealth(req.InstanceID, mesh.HealthState(req.Health))
	types.WriteSuccess(w, "Instance health updated", map[string]string{
		"instance_id": req.InstanceID,
		"health":      req.Health,
	})
}
