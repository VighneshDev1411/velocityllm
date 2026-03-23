package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/cdn"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// GetCDNStatsHandler returns CDN statistics (Day 52)
func GetCDNStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	m := cdn.GetGlobalCDN()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "CDN not initialized")
		return
	}

	types.WriteSuccess(w, "CDN stats retrieved", m.GetStats())
}

// GetCDNStatusHandler returns full CDN status including edges (Day 52)
func GetCDNStatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	m := cdn.GetGlobalCDN()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "CDN not initialized")
		return
	}

	types.WriteSuccess(w, "CDN status retrieved", m.GetFullStatus())
}

// GetCDNEdgesHandler returns edge node statuses (Day 52)
func GetCDNEdgesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	m := cdn.GetGlobalCDN()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "CDN not initialized")
		return
	}

	edges := m.GetEdgeNodes()
	types.WriteSuccess(w, "Edge nodes retrieved", map[string]interface{}{
		"edges": edges,
		"count": len(edges),
	})
}

// SetEdgeStatusHandler updates an edge node's status (Day 52)
func SetEdgeStatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	m := cdn.GetGlobalCDN()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "CDN not initialized")
		return
	}

	var req struct {
		Location string `json:"location"`
		Status   string `json:"status"` // active, draining, offline
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Location == "" || req.Status == "" {
		types.WriteError(w, http.StatusBadRequest, "location and status required")
		return
	}

	if err := m.SetEdgeStatus(req.Location, req.Status); err != nil {
		types.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	types.WriteSuccess(w, "Edge status updated", map[string]string{
		"location": req.Location,
		"status":   req.Status,
	})
}

// InvalidateCDNCacheHandler invalidates CDN cache paths (Day 52)
func InvalidateCDNCacheHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	m := cdn.GetGlobalCDN()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "CDN not initialized")
		return
	}

	var req struct {
		Paths []string `json:"paths"`
		All   bool     `json:"all"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	var result *cdn.InvalidationRequest
	if req.All {
		result = m.InvalidateAll()
	} else if len(req.Paths) > 0 {
		result = m.InvalidatePaths(req.Paths)
	} else {
		types.WriteError(w, http.StatusBadRequest, "paths or all=true required")
		return
	}

	types.WriteSuccess(w, "Cache invalidation created", result)
}

// GetCDNInvalidationsHandler returns recent invalidations (Day 52)
func GetCDNInvalidationsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	m := cdn.GetGlobalCDN()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "CDN not initialized")
		return
	}

	inv := m.GetInvalidations()
	types.WriteSuccess(w, "Invalidations retrieved", map[string]interface{}{
		"invalidations": inv,
		"count":         len(inv),
	})
}

// GetCDNOriginsHandler returns origin server configs (Day 52)
func GetCDNOriginsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	m := cdn.GetGlobalCDN()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "CDN not initialized")
		return
	}

	origins := m.GetOrigins()
	types.WriteSuccess(w, "Origins retrieved", map[string]interface{}{
		"origins": origins,
		"count":   len(origins),
	})
}

// SetOriginHealthHandler updates an origin's health (Day 52)
func SetOriginHealthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	m := cdn.GetGlobalCDN()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "CDN not initialized")
		return
	}

	var req struct {
		OriginID string `json:"origin_id"`
		Healthy  bool   `json:"healthy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.OriginID == "" {
		types.WriteError(w, http.StatusBadRequest, "origin_id required")
		return
	}

	if err := m.SetOriginHealth(req.OriginID, req.Healthy); err != nil {
		types.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	types.WriteSuccess(w, "Origin health updated", map[string]interface{}{
		"origin_id": req.OriginID,
		"healthy":   req.Healthy,
	})
}

// GetCDNCacheRulesHandler returns cache rules (Day 52)
func GetCDNCacheRulesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	m := cdn.GetGlobalCDN()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "CDN not initialized")
		return
	}

	rules := m.GetCacheRules()
	types.WriteSuccess(w, "Cache rules retrieved", map[string]interface{}{
		"rules": rules,
		"count": len(rules),
	})
}

// AddCDNCacheRuleHandler adds a new cache rule (Day 52)
func AddCDNCacheRuleHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	m := cdn.GetGlobalCDN()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "CDN not initialized")
		return
	}

	var req struct {
		PathPattern  string `json:"path_pattern"`
		TTLSeconds   int    `json:"ttl_seconds"`
		CacheControl string `json:"cache_control"`
		Compress     bool   `json:"compress"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.PathPattern == "" {
		types.WriteError(w, http.StatusBadRequest, "path_pattern required")
		return
	}

	rule := cdn.CacheRule{
		PathPattern:  req.PathPattern,
		TTL:          time.Duration(req.TTLSeconds) * time.Second,
		CacheControl: req.CacheControl,
		Compress:     req.Compress,
	}

	m.AddCacheRule(rule)
	types.WriteSuccess(w, "Cache rule added", rule)
}
