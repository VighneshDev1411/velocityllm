package api

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/optimization"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// GetDBPoolStatsHandler returns database connection pool statistics
func GetDBPoolStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	pool := optimization.GetGlobalDBPool()
	if pool == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Database pool not initialized")
		return
	}

	stats := pool.GetStats()

	response := map[string]interface{}{
		"total_connections":   stats.TotalConnections,
		"idle_connections":    stats.IdleConnections,
		"active_connections":  stats.ActiveConnections,
		"wait_count":          stats.WaitCount,
		"wait_duration":       stats.WaitDuration.String(),
		"connections_created": stats.ConnectionsCreated,
		"connections_closed":  stats.ConnectionsClosed,
		"errors":              stats.Errors,
		"pool_type":           "database",
	}

	types.WriteSuccess(w, "Database pool statistics retrieved", response)
}

// GetRedisPoolStatsHandler returns Redis connection pool statistics
func GetRedisPoolStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	pool := optimization.GetGlobalRedisPool()
	if pool == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Redis pool not initialized")
		return
	}

	stats := pool.GetStats()

	response := map[string]interface{}{
		"total_connections":   stats.TotalConnections,
		"idle_connections":    stats.IdleConnections,
		"active_connections":  stats.ActiveConnections,
		"wait_count":          stats.WaitCount,
		"wait_duration":       stats.WaitDuration.String(),
		"connections_created": stats.ConnectionsCreated,
		"connections_closed":  stats.ConnectionsClosed,
		"errors":              stats.Errors,
		"pool_type":           "redis",
	}

	types.WriteSuccess(w, "Redis pool statistics retrieved", response)
}

// GetHTTPPoolStatsHandler returns HTTP connection pool statistics
func GetHTTPPoolStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	pool := optimization.GetGlobalHTTPPool()
	if pool == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "HTTP pool not initialized")
		return
	}

	stats := pool.GetStats()

	response := map[string]interface{}{
		"total_connections":   stats.TotalConnections,
		"idle_connections":    stats.IdleConnections,
		"active_connections":  stats.ActiveConnections,
		"wait_count":          stats.WaitCount,
		"wait_duration":       stats.WaitDuration.String(),
		"connections_created": stats.ConnectionsCreated,
		"connections_closed":  stats.ConnectionsClosed,
		"errors":              stats.Errors,
		"pool_type":           "http",
	}

	types.WriteSuccess(w, "HTTP pool statistics retrieved", response)
}

// GetAllPoolStatsHandler returns statistics for all connection pools
func GetAllPoolStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	response := map[string]interface{}{}

	// Database pool
	if dbPool := optimization.GetGlobalDBPool(); dbPool != nil {
		stats := dbPool.GetStats()
		response["database"] = map[string]interface{}{
			"total_connections":   stats.TotalConnections,
			"idle_connections":    stats.IdleConnections,
			"active_connections":  stats.ActiveConnections,
			"connections_created": stats.ConnectionsCreated,
			"connections_closed":  stats.ConnectionsClosed,
			"errors":              stats.Errors,
		}
	}

	// Redis pool
	if redisPool := optimization.GetGlobalRedisPool(); redisPool != nil {
		stats := redisPool.GetStats()
		response["redis"] = map[string]interface{}{
			"total_connections":   stats.TotalConnections,
			"idle_connections":    stats.IdleConnections,
			"active_connections":  stats.ActiveConnections,
			"connections_created": stats.ConnectionsCreated,
			"connections_closed":  stats.ConnectionsClosed,
			"errors":              stats.Errors,
		}
	}

	// HTTP pool
	if httpPool := optimization.GetGlobalHTTPPool(); httpPool != nil {
		stats := httpPool.GetStats()
		response["http"] = map[string]interface{}{
			"total_connections":   stats.TotalConnections,
			"idle_connections":    stats.IdleConnections,
			"active_connections":  stats.ActiveConnections,
			"connections_created": stats.ConnectionsCreated,
			"connections_closed":  stats.ConnectionsClosed,
			"errors":              stats.Errors,
		}
	}

	types.WriteSuccess(w, "All pool statistics retrieved", response)
}

// GetBatcherStatsHandler returns request batcher statistics
func GetBatcherStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	batcher := optimization.GetGlobalRequestBatcher()
	if batcher == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Request batcher not initialized")
		return
	}

	stats := batcher.GetStats()

	response := map[string]interface{}{
		"total_requests":     stats.TotalRequests,
		"total_batches":      stats.TotalBatches,
		"avg_batch_size":     fmt.Sprintf("%.2f", stats.AvgBatchSize),
		"total_tokens":       stats.TotalTokens,
		"total_cost":         fmt.Sprintf("$%.6f", stats.TotalCost),
		"cost_savings":       fmt.Sprintf("$%.6f", stats.CostSavings),
		"savings_percentage": fmt.Sprintf("%.2f%%", stats.SavingsPercentage),
		"avg_wait_time":      stats.AvgWaitTime.String(),
	}

	types.WriteSuccess(w, "Batcher statistics retrieved", response)
}

// GetBatcherPendingHandler returns pending batches information
func GetBatcherPendingHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	batcher := optimization.GetGlobalRequestBatcher()
	if batcher == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Request batcher not initialized")
		return
	}

	pending := batcher.GetPendingBatches()

	response := map[string]interface{}{
		"pending_batches": pending,
		"total_pending":   calculateTotalPending(pending),
	}

	types.WriteSuccess(w, "Pending batches retrieved", response)
}

// GetOptimizationSummaryHandler returns comprehensive optimization summary
func GetOptimizationSummaryHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	response := map[string]interface{}{
		"connection_pooling": map[string]interface{}{
			"enabled": true,
		},
		"request_batching": map[string]interface{}{
			"enabled": true,
		},
	}

	// Database pool summary
	if dbPool := optimization.GetGlobalDBPool(); dbPool != nil {
		stats := dbPool.GetStats()
		response["connection_pooling"].(map[string]interface{})["database"] = map[string]interface{}{
			"total":  stats.TotalConnections,
			"active": stats.ActiveConnections,
			"idle":   stats.IdleConnections,
		}
	}

	// Redis pool summary
	if redisPool := optimization.GetGlobalRedisPool(); redisPool != nil {
		stats := redisPool.GetStats()
		response["connection_pooling"].(map[string]interface{})["redis"] = map[string]interface{}{
			"total":  stats.TotalConnections,
			"active": stats.ActiveConnections,
			"idle":   stats.IdleConnections,
		}
	}

	// HTTP pool summary
	if httpPool := optimization.GetGlobalHTTPPool(); httpPool != nil {
		stats := httpPool.GetStats()
		response["connection_pooling"].(map[string]interface{})["http"] = map[string]interface{}{
			"total":  stats.TotalConnections,
			"active": stats.ActiveConnections,
			"idle":   stats.IdleConnections,
		}
	}

	// Batcher summary
	if batcher := optimization.GetGlobalRequestBatcher(); batcher != nil {
		stats := batcher.GetStats()
		response["request_batching"].(map[string]interface{})["stats"] = map[string]interface{}{
			"total_requests":     stats.TotalRequests,
			"total_batches":      stats.TotalBatches,
			"avg_batch_size":     fmt.Sprintf("%.2f", stats.AvgBatchSize),
			"cost_savings":       fmt.Sprintf("$%.4f", stats.CostSavings),
			"savings_percentage": fmt.Sprintf("%.2f%%", stats.SavingsPercentage),
		}
	}

	types.WriteSuccess(w, "Optimization summary retrieved", response)
}

// ResizeDBPoolHandler dynamically resizes database connection pool
func ResizeDBPoolHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodPut {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		MaxConnections int `json:"max_connections"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.MaxConnections < 1 || req.MaxConnections > 100 {
		types.WriteError(w, http.StatusBadRequest, "Max connections must be between 1 and 100")
		return
	}

	pool := optimization.GetGlobalDBPool()
	if pool == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Database pool not initialized")
		return
	}

	if err := pool.Resize(req.MaxConnections); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to resize pool: "+err.Error())
		return
	}

	response := map[string]interface{}{
		"max_connections": req.MaxConnections,
		"message":         "Database pool resized successfully",
	}

	types.WriteSuccess(w, "Pool resized", response)
}

// GetOptimizationMetricsHandler returns detailed optimization metrics
func GetOptimizationMetricsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	metrics := map[string]interface{}{}

	// Connection pool metrics
	poolMetrics := map[string]interface{}{}

	if dbPool := optimization.GetGlobalDBPool(); dbPool != nil {
		stats := dbPool.GetStats()
		totalWait := int64(0)
		if stats.WaitCount > 0 {
			totalWait = stats.WaitDuration.Milliseconds()
		}

		poolMetrics["database"] = map[string]interface{}{
			"efficiency":  calculatePoolEfficiency(stats),
			"avg_wait_ms": totalWait / max(stats.WaitCount, 1),
			"reuse_rate":  calculateReuseRate(stats),
		}
	}

	if redisPool := optimization.GetGlobalRedisPool(); redisPool != nil {
		stats := redisPool.GetStats()
		totalWait := int64(0)
		if stats.WaitCount > 0 {
			totalWait = stats.WaitDuration.Milliseconds()
		}

		poolMetrics["redis"] = map[string]interface{}{
			"efficiency":  calculatePoolEfficiency(stats),
			"avg_wait_ms": totalWait / max(stats.WaitCount, 1),
			"reuse_rate":  calculateReuseRate(stats),
		}
	}

	if httpPool := optimization.GetGlobalHTTPPool(); httpPool != nil {
		stats := httpPool.GetStats()
		totalWait := int64(0)
		if stats.WaitCount > 0 {
			totalWait = stats.WaitDuration.Milliseconds()
		}

		poolMetrics["http"] = map[string]interface{}{
			"efficiency":  calculatePoolEfficiency(stats),
			"avg_wait_ms": totalWait / max(stats.WaitCount, 1),
			"reuse_rate":  calculateReuseRate(stats),
		}
	}

	metrics["connection_pools"] = poolMetrics

	// Batching metrics
	if batcher := optimization.GetGlobalRequestBatcher(); batcher != nil {
		stats := batcher.GetStats()

		// Calculate what cost would have been without batching
		costWithoutBatching := float64(stats.TotalRequests) * 0.01

		metrics["request_batching"] = map[string]interface{}{
			"total_requests":        stats.TotalRequests,
			"total_batches":         stats.TotalBatches,
			"avg_batch_size":        fmt.Sprintf("%.2f", stats.AvgBatchSize),
			"batching_efficiency":   fmt.Sprintf("%.2f%%", (1-float64(stats.TotalBatches)/float64(max(stats.TotalRequests, 1)))*100),
			"cost_without_batching": fmt.Sprintf("$%.4f", costWithoutBatching),
			"cost_with_batching":    fmt.Sprintf("$%.4f", stats.TotalCost),
			"total_savings":         fmt.Sprintf("$%.4f", stats.CostSavings),
			"savings_percentage":    fmt.Sprintf("%.2f%%", stats.SavingsPercentage),
		}
	}

	types.WriteSuccess(w, "Optimization metrics retrieved", metrics)
}

// Helper functions

func calculateTotalPending(pending map[string]int) int {
	total := 0
	for _, count := range pending {
		total += count
	}
	return total
}

func calculatePoolEfficiency(stats optimization.PoolStats) string {
	if stats.ConnectionsCreated == 0 {
		return "0.00%"
	}

	// Efficiency = (connections reused) / (total connections created)
	// Higher is better
	totalUses := stats.WaitCount + int64(stats.ConnectionsCreated)
	efficiency := float64(totalUses) / float64(stats.ConnectionsCreated) * 100

	return fmt.Sprintf("%.2f%%", efficiency)
}

func calculateReuseRate(stats optimization.PoolStats) string {
	if stats.ConnectionsCreated == 0 {
		return "0.00"
	}

	// Reuse rate = total uses / connections created
	totalUses := stats.WaitCount + int64(stats.ConnectionsCreated)
	reuseRate := float64(totalUses) / float64(stats.ConnectionsCreated)

	return fmt.Sprintf("%.2f", reuseRate)
}

func max(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
