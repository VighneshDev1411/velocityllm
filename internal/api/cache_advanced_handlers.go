package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/cache"
	"github.com/VighneshDev1411/velocityllm/internal/middleware"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// GetCacheAnalyticsHandler returns detailed cache analytics (Day 7)
func GetCacheAnalyticsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	manager := cache.GetGlobalCacheManager()
	if manager == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Cache manager not initialized")
		return
	}

	stats := manager.GetStats()
	types.WriteSuccess(w, "Cache analytics retrieved", stats)
}

// GetMultiLevelStatsHandler returns multi-level cache statistics
func GetMultiLevelStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	manager := cache.GetGlobalCacheManager()
	if manager == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Cache manager not initialized")
		return
	}

	stats := manager.GetStats()
	if stats.MultiLevel == nil {
		types.WriteError(w, http.StatusNotFound, "Multi-level cache not enabled")
		return
	}

	types.WriteSuccess(w, "Multi-level cache stats retrieved", stats.MultiLevel)
}

// GetSemanticCacheStatsHandler returns semantic cache statistics
func GetSemanticCacheStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	manager := cache.GetGlobalCacheManager()
	if manager == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Cache manager not initialized")
		return
	}

	stats := manager.GetStats()
	if stats.Semantic == nil {
		types.WriteError(w, http.StatusNotFound, "Semantic cache not enabled")
		return
	}

	types.WriteSuccess(w, "Semantic cache stats retrieved", stats.Semantic)
}

// WarmCacheHandler pre-populates cache with common queries
func WarmCacheHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	manager := cache.GetGlobalCacheManager()
	if manager == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Cache manager not initialized")
		return
	}

	// Parse warming data
	var warmData struct {
		Entries map[string]interface{} `json:"entries"`
	}
	if err := json.NewDecoder(r.Body).Decode(&warmData); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if len(warmData.Entries) == 0 {
		types.WriteError(w, http.StatusBadRequest, "No entries provided for warming")
		return
	}

	// Warm the cache
	if err := manager.Warm(r.Context(), warmData.Entries); err != nil {
		utils.Error("Failed to warm cache", "error", err)
		types.WriteError(w, http.StatusInternalServerError, "Failed to warm cache")
		return
	}

	utils.Info("Cache warmed successfully", "entries", len(warmData.Entries))
	types.WriteSuccess(w, "Cache warmed successfully", map[string]int{
		"entries_warmed": len(warmData.Entries),
	})
}

// TestSemanticCacheHandler tests semantic similarity matching
func TestSemanticCacheHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	manager := cache.GetGlobalCacheManager()
	if manager == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Cache manager not initialized")
		return
	}

	// Parse test request
	var testReq struct {
		Prompt string `json:"prompt"`
		Model  string `json:"model"`
	}
	if err := json.NewDecoder(r.Body).Decode(&testReq); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if testReq.Prompt == "" {
		types.WriteError(w, http.StatusBadRequest, "Prompt is required")
		return
	}
	if testReq.Model == "" {
		testReq.Model = "gpt-4"
	}

	// Try semantic lookup
	var result interface{}
	found, similarity, err := manager.GetSemantic(r.Context(), testReq.Prompt, testReq.Model, &result)
	if err != nil {
		utils.Error("Semantic cache lookup failed", "error", err)
		types.WriteError(w, http.StatusInternalServerError, "Semantic cache lookup failed")
		return
	}

	response := map[string]interface{}{
		"found":      found,
		"similarity": similarity,
	}
	if found {
		response["cached_result"] = result
	}

	types.WriteSuccess(w, "Semantic cache test completed", response)
}

// GetCacheHitRateHandler returns current cache hit rate
func GetCacheHitRateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	manager := cache.GetGlobalCacheManager()
	if manager == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Cache manager not initialized")
		return
	}

	stats := manager.GetStats()

	response := map[string]interface{}{
		"overall_hit_rate": 0.0,
		"l1_hit_rate":      0.0,
		"l2_hit_rate":      0.0,
	}

	if stats.MultiLevel != nil && stats.MultiLevel.Analytics != nil {
		response["overall_hit_rate"] = stats.MultiLevel.Analytics.OverallHitRate
		response["l1_hit_rate"] = stats.MultiLevel.Analytics.L1HitRate
		response["l2_hit_rate"] = stats.MultiLevel.Analytics.L2HitRate
		response["total_requests"] = stats.MultiLevel.Analytics.TotalHits + stats.MultiLevel.Analytics.TotalMisses
		response["total_hits"] = stats.MultiLevel.Analytics.TotalHits
		response["total_misses"] = stats.MultiLevel.Analytics.TotalMisses
	}

	types.WriteSuccess(w, "Cache hit rate retrieved", response)
}

// GetCacheLatencyHandler returns cache latency metrics
func GetCacheLatencyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	manager := cache.GetGlobalCacheManager()
	if manager == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Cache manager not initialized")
		return
	}

	stats := manager.GetStats()

	if stats.MultiLevel == nil || stats.MultiLevel.Analytics == nil {
		types.WriteError(w, http.StatusNotFound, "Cache analytics not available")
		return
	}

	analytics := stats.MultiLevel.Analytics
	response := map[string]interface{}{
		"l1_latency": map[string]float64{
			"avg_ms": analytics.AvgL1Latency,
			"p50_ms": analytics.P50L1Latency,
			"p95_ms": analytics.P95L1Latency,
			"p99_ms": analytics.P99L1Latency,
		},
		"l2_latency": map[string]float64{
			"avg_ms": analytics.AvgL2Latency,
			"p50_ms": analytics.P50L2Latency,
			"p95_ms": analytics.P95L2Latency,
			"p99_ms": analytics.P99L2Latency,
		},
		"write_latency": map[string]float64{
			"avg_ms": analytics.AvgWriteLatency,
		},
	}

	types.WriteSuccess(w, "Cache latency metrics retrieved", response)
}

// InvalidateCacheByTagHandler invalidates cache entries by tag
func InvalidateCacheByTagHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		Tags []string `json:"tags"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if len(req.Tags) == 0 {
		types.WriteError(w, http.StatusBadRequest, "At least one tag is required")
		return
	}

	tc := cache.GetGlobalTaggedCache()
	if tc == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Tagged cache not initialized")
		return
	}

	deleted, err := tc.InvalidateByTags(r.Context(), req.Tags)
	if err != nil {
		utils.Error("Failed to invalidate by tags", "error", err)
		types.WriteError(w, http.StatusInternalServerError, "Failed to invalidate cache")
		return
	}

	types.WriteSuccess(w, "Cache invalidated by tags", map[string]interface{}{
		"tags":    req.Tags,
		"deleted": deleted,
	})
}

// GetResponseCacheStatsHandler returns HTTP response cache stats
func GetResponseCacheStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	statsJSON, err := middleware.GetResponseCacheStatsJSON()
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to get response cache stats")
		return
	}

	var stats interface{}
	json.Unmarshal(statsJSON, &stats)
	types.WriteSuccess(w, "Response cache stats retrieved", stats)
}
