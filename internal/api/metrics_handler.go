package api

import (
	"fmt"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/metrics"
	"github.com/VighneshDev1411/velocityllm/internal/middleware"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// GetMetricsSnapshotHandler returns complete metrics snapshot
func GetMetricsSnapshotHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	collector := metrics.GetGlobalMetricsCollector()
	snapshot := collector.GetSnapshot()

	response := map[string]interface{}{
		"timestamp": snapshot.Timestamp,
		"latency": map[string]interface{}{
			"p50_ms":  snapshot.Latency.P50.Milliseconds(),
			"p90_ms":  snapshot.Latency.P90.Milliseconds(),
			"p95_ms":  snapshot.Latency.P95.Milliseconds(),
			"p99_ms":  snapshot.Latency.P99.Milliseconds(),
			"min_ms":  snapshot.Latency.Min.Milliseconds(),
			"max_ms":  snapshot.Latency.Max.Milliseconds(),
			"mean_ms": snapshot.Latency.Mean.Milliseconds(),
			"count":   snapshot.Latency.Count,
		},
		"throughput": map[string]interface{}{
			"requests_per_second": fmt.Sprintf("%.2f", snapshot.Throughput.RequestsPerSecond),
			"requests_per_minute": fmt.Sprintf("%.2f", snapshot.Throughput.RequestsPerMinute),
			"total_requests":      snapshot.Throughput.TotalRequests,
			"period":              snapshot.Throughput.Period.String(),
		},
		"cost": map[string]interface{}{
			"total_cost":           fmt.Sprintf("$%.4f", snapshot.Cost.TotalCost),
			"avg_cost_per_request": fmt.Sprintf("$%.6f", snapshot.Cost.AvgCostPerRequest),
			"cost_by_model":        formatCostMap(snapshot.Cost.CostByModel),
			"cost_by_provider":     formatCostMap(snapshot.Cost.CostByProvider),
		},
		"errors": map[string]interface{}{
			"total_errors":   snapshot.Errors.TotalErrors,
			"error_rate":     fmt.Sprintf("%.2f%%", snapshot.Errors.ErrorRate),
			"errors_by_type": snapshot.Errors.ErrorsByType,
		},
		"models": formatModelMetrics(snapshot.ModelMetrics),
	}

	types.WriteSuccess(w, "Metrics snapshot retrieved", response)
}

// GetLatencyMetricsHandler returns latency statistics
func GetLatencyMetricsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	collector := metrics.GetGlobalMetricsCollector()
	latency := collector.GetLatencyMetrics()

	response := map[string]interface{}{
		"p50_ms":         latency.P50.Milliseconds(),
		"p90_ms":         latency.P90.Milliseconds(),
		"p95_ms":         latency.P95.Milliseconds(),
		"p99_ms":         latency.P99.Milliseconds(),
		"min_ms":         latency.Min.Milliseconds(),
		"max_ms":         latency.Max.Milliseconds(),
		"mean_ms":        latency.Mean.Milliseconds(),
		"count":          latency.Count,
		"total_duration": latency.TotalDuration.String(),
	}

	types.WriteSuccess(w, "Latency metrics retrieved", response)
}

// GetThroughputMetricsHandler returns throughput statistics
func GetThroughputMetricsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	collector := metrics.GetGlobalMetricsCollector()
	throughput := collector.GetThroughputMetrics()

	response := map[string]interface{}{
		"requests_per_second": fmt.Sprintf("%.2f", throughput.RequestsPerSecond),
		"requests_per_minute": fmt.Sprintf("%.2f", throughput.RequestsPerMinute),
		"total_requests":      throughput.TotalRequests,
		"period":              throughput.Period.String(),
		"uptime":              throughput.Period.String(),
	}

	types.WriteSuccess(w, "Throughput metrics retrieved", response)
}

// GetCostMetricsHandler returns cost statistics
func GetCostMetricsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	collector := metrics.GetGlobalMetricsCollector()
	cost := collector.GetCostMetrics()

	response := map[string]interface{}{
		"total_cost":           fmt.Sprintf("$%.4f", cost.TotalCost),
		"avg_cost_per_request": fmt.Sprintf("$%.6f", cost.AvgCostPerRequest),
		"cost_by_model":        formatCostMap(cost.CostByModel),
		"cost_by_provider":     formatCostMap(cost.CostByProvider),
	}

	types.WriteSuccess(w, "Cost metrics retrieved", response)
}

// GetErrorMetricsHandler returns error statistics
func GetErrorMetricsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	collector := metrics.GetGlobalMetricsCollector()
	errors := collector.GetErrorMetrics()

	response := map[string]interface{}{
		"total_errors":   errors.TotalErrors,
		"error_rate":     fmt.Sprintf("%.2f%%", errors.ErrorRate),
		"errors_by_type": errors.ErrorsByType,
	}

	if errors.LastError != "" {
		response["last_error"] = errors.LastError
		response["last_error_time"] = errors.LastErrorTime
	}

	types.WriteSuccess(w, "Error metrics retrieved", response)
}

// GetModelMetricsHandler returns per-model statistics
func GetModelMetricsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	collector := metrics.GetGlobalMetricsCollector()
	modelMetrics := collector.GetModelMetrics()

	response := formatModelMetrics(modelMetrics)

	types.WriteSuccess(w, "Model metrics retrieved", response)
}

// ResetMetricsHandler resets all metrics
func ResetMetricsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	collector := metrics.GetGlobalMetricsCollector()
	collector.Reset()

	types.WriteSuccess(w, "Metrics reset successfully", map[string]interface{}{
		"message": "All metrics have been reset",
	})
}

// GetRateLimiterStatsHandler returns rate limiter statistics
func GetRateLimiterStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	rl := middleware.GetGlobalRateLimiter()
	stats := rl.GetStats()

	types.WriteSuccess(w, "Rate limiter statistics retrieved", stats)
}

// GetRateLimiterUserStatusHandler returns status for a specific user
func GetRateLimiterUserStatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Get user identifier from query parameter
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		types.WriteError(w, http.StatusBadRequest, "user_id query parameter required")
		return
	}

	rl := middleware.GetGlobalRateLimiter()
	status := rl.GetUserStatus(userID)

	types.WriteSuccess(w, "User rate limit status retrieved", status)
}

// GetBackpressureStatsHandler returns backpressure statistics
func GetBackpressureStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	bh := middleware.GetGlobalBackpressureHandler()
	stats := bh.GetStats()

	types.WriteSuccess(w, "Backpressure statistics retrieved", stats)
}

// GetBackpressureStatusHandler returns current backpressure status
func GetBackpressureStatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	bh := middleware.GetGlobalBackpressureHandler()
	status := bh.GetStatus()

	response := map[string]interface{}{
		"active":             status.Active,
		"queue_usage":        fmt.Sprintf("%.2f%%", status.QueueUsage),
		"worker_utilization": fmt.Sprintf("%.2f%%", status.WorkerUtilization),
		"requests_rejected":  status.RequestsRejected,
		"reason":             status.Reason,
	}

	types.WriteSuccess(w, "Backpressure status retrieved", response)
}

// ResetBackpressureStatsHandler resets backpressure statistics
func ResetBackpressureStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	bh := middleware.GetGlobalBackpressureHandler()
	bh.Reset()

	types.WriteSuccess(w, "Backpressure statistics reset", map[string]interface{}{
		"message": "Backpressure statistics have been reset",
	})
}

// GetSystemHealthHandler returns comprehensive system health
func GetSystemHealthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Gather metrics from all components
	collector := metrics.GetGlobalMetricsCollector()
	snapshot := collector.GetSnapshot()

	bh := middleware.GetGlobalBackpressureHandler()
	backpressureStatus := bh.GetStatus()

	// Determine overall health status
	status := "healthy"
	issues := make([]string, 0)

	// Check error rate
	if snapshot.Errors.ErrorRate > 5.0 {
		status = "degraded"
		issues = append(issues, fmt.Sprintf("High error rate: %.2f%%", snapshot.Errors.ErrorRate))
	}

	// Check backpressure
	if backpressureStatus.Active {
		if status == "healthy" {
			status = "degraded"
		}
		issues = append(issues, backpressureStatus.Reason)
	}

	// Check latency (P99 > 1s is concerning)
	if snapshot.Latency.P99.Milliseconds() > 1000 {
		if status == "healthy" {
			status = "degraded"
		}
		issues = append(issues, fmt.Sprintf("High P99 latency: %dms", snapshot.Latency.P99.Milliseconds()))
	}

	response := map[string]interface{}{
		"status":    status,
		"timestamp": snapshot.Timestamp,
		"checks": map[string]interface{}{
			"error_rate": map[string]interface{}{
				"status": snapshot.Errors.ErrorRate < 5.0,
				"value":  fmt.Sprintf("%.2f%%", snapshot.Errors.ErrorRate),
			},
			"latency": map[string]interface{}{
				"status": snapshot.Latency.P99.Milliseconds() < 1000,
				"p99_ms": snapshot.Latency.P99.Milliseconds(),
			},
			"backpressure": map[string]interface{}{
				"status": !backpressureStatus.Active,
				"active": backpressureStatus.Active,
			},
			"throughput": map[string]interface{}{
				"status":              true,
				"requests_per_second": fmt.Sprintf("%.2f", snapshot.Throughput.RequestsPerSecond),
			},
		},
		"issues": issues,
		"metrics_summary": map[string]interface{}{
			"total_requests": snapshot.Throughput.TotalRequests,
			"error_rate":     fmt.Sprintf("%.2f%%", snapshot.Errors.ErrorRate),
			"p50_latency_ms": snapshot.Latency.P50.Milliseconds(),
			"p99_latency_ms": snapshot.Latency.P99.Milliseconds(),
			"total_cost":     fmt.Sprintf("$%.4f", snapshot.Cost.TotalCost),
		},
	}

	types.WriteSuccess(w, "System health retrieved", response)
}

// Helper functions

func formatCostMap(costs map[string]float64) map[string]string {
	formatted := make(map[string]string)
	for key, value := range costs {
		formatted[key] = fmt.Sprintf("$%.4f", value)
	}
	return formatted
}

func formatModelMetrics(modelMetrics map[string]*metrics.ModelMetrics) []map[string]interface{} {
	result := make([]map[string]interface{}, 0, len(modelMetrics))

	for _, metrics := range modelMetrics {
		successRate := float64(0)
		if metrics.RequestCount > 0 {
			successRate = float64(metrics.SuccessCount) / float64(metrics.RequestCount) * 100
		}

		result = append(result, map[string]interface{}{
			"model_name":     metrics.ModelName,
			"request_count":  metrics.RequestCount,
			"success_count":  metrics.SuccessCount,
			"failure_count":  metrics.FailureCount,
			"success_rate":   fmt.Sprintf("%.2f%%", successRate),
			"avg_latency_ms": metrics.AvgLatency.Milliseconds(),
			"total_cost":     fmt.Sprintf("$%.4f", metrics.TotalCost),
			"avg_cost":       fmt.Sprintf("$%.6f", metrics.AvgCost),
			"last_used":      metrics.LastUsed,
		})
	}

	return result
}
