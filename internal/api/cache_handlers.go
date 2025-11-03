package api

import (
	"context"
	"net/http"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/cache"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// GetCacheStatsHandler returns cache statistics
func GetCacheStatsHandler(w http.ResponseWriter, r *http.Request) {
	// Get Redis stats
	redisStats, err := cache.GetStats()
	if err != nil {
		utils.Error("Failed to get cache stats: %v", err)
		types.WriteError(w, http.StatusInternalServerError, "Failed to retrieve cache statistics")
		return
	}

	types.WriteSuccess(w, "Cache statistics retrieved successfully", redisStats)
}

// ClearCacheHandler clears cache entries matching a pattern
func ClearCacheHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Get pattern from query parameter (default to all cache entries)
	pattern := r.URL.Query().Get("pattern")
	if pattern == "" {
		pattern = "cache:*" // Default: clear all cache entries
	}

	cacheService := cache.NewCacheService(5 * time.Minute)
	ctx := context.Background()

	// Clear matching keys
	deleted, err := cacheService.Clear(ctx, pattern)
	if err != nil {
		utils.Error("Failed to clear cache: %v", err)
		types.WriteError(w, http.StatusInternalServerError, "Failed to clear cache")
		return
	}

	response := map[string]interface{}{
		"pattern": pattern,
		"deleted": deleted,
	}

	types.WriteSuccess(w, "Cache cleared successfully", response)
}

// FlushAllCacheHandler clears ALL Redis data (use with caution!)
func FlushAllCacheHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Safety check - require confirmation parameter
	confirm := r.URL.Query().Get("confirm")
	if confirm != "yes" {
		types.WriteError(w, http.StatusBadRequest, "Please add ?confirm=yes to flush all cache")
		return
	}

	if err := cache.FlushAll(); err != nil {
		utils.Error("Failed to flush cache: %v", err)
		types.WriteError(w, http.StatusInternalServerError, "Failed to flush cache")
		return
	}

	utils.Warn("CACHE FLUSH: All Redis data cleared")
	types.WriteSuccess(w, "All cache data flushed successfully", nil)
}

// TestCacheHandler tests cache functionality
func TestCacheHandler(w http.ResponseWriter, r *http.Request) {
	ctx := context.Background()
	cacheService := cache.NewCacheService(5 * time.Minute)

	testKey := "test:cache:demo"
	testValue := map[string]interface{}{
		"message":   "This is a test cache entry",
		"timestamp": time.Now(),
		"data":      []string{"item1", "item2", "item3"},
	}

	// Test SET
	if err := cacheService.Set(ctx, testKey, testValue, 1*time.Minute); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to set cache")
		return
	}

	// Test GET
	var retrieved map[string]interface{}
	found, err := cacheService.Get(ctx, testKey, &retrieved)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to get cache")
		return
	}

	if !found {
		types.WriteError(w, http.StatusInternalServerError, "Cache entry not found after setting")
		return
	}

	// Test TTL
	ttl, err := cacheService.GetTTL(ctx, testKey)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to get TTL")
		return
	}

	// Clean up
	_ = cacheService.Delete(ctx, testKey)

	result := map[string]interface{}{
		"test_passed": true,
		"operations": map[string]string{
			"set":    "success",
			"get":    "success",
			"ttl":    "success",
			"delete": "success",
		},
		"retrieved_data": retrieved,
		"ttl_remaining":  ttl.String(),
	}

	types.WriteSuccess(w, "Cache test completed successfully", result)
}
