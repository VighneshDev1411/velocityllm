package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/mesh"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// GetRegionStatusesHandler returns health/latency for all regions (Day 51)
func GetRegionStatusesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	m := mesh.GetServiceMesh()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Service mesh not initialized")
		return
	}

	statuses := m.GetRegionStatuses()
	types.WriteSuccess(w, "Region statuses retrieved", map[string]interface{}{
		"regions": statuses,
		"count":   len(statuses),
	})
}

// GetGeoStatsHandler returns geo-routing statistics (Day 51)
func GetGeoStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	m := mesh.GetServiceMesh()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Service mesh not initialized")
		return
	}

	gr := m.GetGeoRouter()
	if gr == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Geo router not initialized")
		return
	}

	types.WriteSuccess(w, "Geo-routing stats retrieved", gr.GetStats())
}

// GeoRouteHandler selects the best instance using geo-aware routing (Day 51)
func GeoRouteHandler(w http.ResponseWriter, r *http.Request) {
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

	instance, routeType, err := m.RouteGeo(serviceName)
	if err != nil {
		types.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	types.WriteSuccess(w, "Geo-route selected", map[string]interface{}{
		"service":    serviceName,
		"instance":   instance.ID,
		"endpoint":   instance.Endpoint(),
		"region":     instance.Region,
		"zone":       instance.Zone,
		"route_type": routeType,
		"health":     instance.Health,
	})
}

// RecordRegionLatencyHandler records a latency measurement for a region (Day 51)
func RecordRegionLatencyHandler(w http.ResponseWriter, r *http.Request) {
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
		Region    string  `json:"region"`
		LatencyMs float64 `json:"latency_ms"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Region == "" {
		types.WriteError(w, http.StatusBadRequest, "region and latency_ms required")
		return
	}

	m.RecordRegionLatency(req.Region, req.LatencyMs)
	types.WriteSuccess(w, "Latency recorded", map[string]interface{}{
		"region":     req.Region,
		"latency_ms": req.LatencyMs,
	})
}

// RecordRegionErrorHandler records an error for a region (Day 51)
func RecordRegionErrorHandler(w http.ResponseWriter, r *http.Request) {
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
		Region string `json:"region"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Region == "" {
		types.WriteError(w, http.StatusBadRequest, "region required")
		return
	}

	m.RecordRegionError(req.Region)
	types.WriteSuccess(w, "Error recorded", map[string]string{
		"region": req.Region,
	})
}

// GetGeoConfigHandler returns the current geo-routing configuration (Day 51)
func GetGeoConfigHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	m := mesh.GetServiceMesh()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Service mesh not initialized")
		return
	}

	gr := m.GetGeoRouter()
	if gr == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Geo router not initialized")
		return
	}

	types.WriteSuccess(w, "Geo config retrieved", gr.GetStats())
}
