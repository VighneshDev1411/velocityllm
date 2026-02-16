package api

import (
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/metrics"
	"github.com/VighneshDev1411/velocityllm/internal/middleware"
	"github.com/VighneshDev1411/velocityllm/internal/streaming"
	"github.com/VighneshDev1411/velocityllm/internal/worker"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// GetDashboardOverviewHandler returns aggregated dashboard data
func GetDashboardOverviewHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	collector := metrics.GetGlobalMetricsCollector()
	snapshot := collector.GetSnapshot()

	bh := middleware.GetGlobalBackpressureHandler()
	bpStatus := bh.GetStatus()

	// System status
	status := "healthy"
	if snapshot.Errors.ErrorRate > 5.0 || bpStatus.Active {
		status = "degraded"
	}

	// Worker metrics
	pool := worker.GetGlobalPool()
	workerStats := pool.GetMetrics()

	// Stream metrics
	streamMgr := streaming.GetGlobalStreamManager()
	streamStats := streamMgr.GetStats()

	response := map[string]interface{}{
		"status":    status,
		"timestamp": time.Now(),
		"overview": map[string]interface{}{
			"total_requests":      snapshot.Throughput.TotalRequests,
			"requests_per_second": fmt.Sprintf("%.2f", snapshot.Throughput.RequestsPerSecond),
			"total_cost":          snapshot.Cost.TotalCost,
			"avg_cost_per_request": snapshot.Cost.AvgCostPerRequest,
			"error_rate":          snapshot.Errors.ErrorRate,
			"total_errors":        snapshot.Errors.TotalErrors,
			"uptime_seconds":      snapshot.Throughput.Period.Seconds(),
		},
		"latency": map[string]interface{}{
			"p50_ms":  snapshot.Latency.P50.Milliseconds(),
			"p90_ms":  snapshot.Latency.P90.Milliseconds(),
			"p95_ms":  snapshot.Latency.P95.Milliseconds(),
			"p99_ms":  snapshot.Latency.P99.Milliseconds(),
			"mean_ms": snapshot.Latency.Mean.Milliseconds(),
			"min_ms":  snapshot.Latency.Min.Milliseconds(),
			"max_ms":  snapshot.Latency.Max.Milliseconds(),
		},
		"workers": map[string]interface{}{
			"total":       workerStats.TotalWorkers,
			"idle":        workerStats.IdleWorkers,
			"busy":        workerStats.BusyWorkers,
			"unhealthy":   workerStats.UnhealthyWorkers,
			"queued_jobs": workerStats.QueuedJobs,
			"utilization": workerStats.QueueUtilization,
		},
		"streams":          streamStats,
		"cost_by_model":    snapshot.Cost.CostByModel,
		"cost_by_provider": snapshot.Cost.CostByProvider,
		"models":           formatModelMetrics(snapshot.ModelMetrics),
	}

	types.WriteSuccess(w, "Dashboard overview retrieved", response)
}

// GetRequestTimeSeriesHandler returns time-series data for charts
func GetRequestTimeSeriesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Get period from query param (default: 24h)
	period := r.URL.Query().Get("period")
	if period == "" {
		period = "24h"
	}

	var duration time.Duration
	switch period {
	case "1h":
		duration = 1 * time.Hour
	case "6h":
		duration = 6 * time.Hour
	case "24h":
		duration = 24 * time.Hour
	case "7d":
		duration = 7 * 24 * time.Hour
	default:
		duration = 24 * time.Hour
	}

	// Generate time-series data points
	// In production, this would pull from stored time-series data
	// For now, generate realistic data based on current metrics
	collector := metrics.GetGlobalMetricsCollector()
	snapshot := collector.GetSnapshot()

	now := time.Now()
	numPoints := 24
	if duration <= time.Hour {
		numPoints = 12
	} else if duration >= 7*24*time.Hour {
		numPoints = 28
	}

	interval := duration / time.Duration(numPoints)

	requestSeries := make([]map[string]interface{}, 0, numPoints)
	latencySeries := make([]map[string]interface{}, 0, numPoints)
	costSeries := make([]map[string]interface{}, 0, numPoints)
	errorSeries := make([]map[string]interface{}, 0, numPoints)

	baseRequests := float64(snapshot.Throughput.TotalRequests) / float64(numPoints)
	baseCost := snapshot.Cost.TotalCost / float64(numPoints)
	baseLatency := float64(snapshot.Latency.Mean.Milliseconds())
	baseErrors := float64(snapshot.Errors.TotalErrors) / float64(numPoints)

	for i := 0; i < numPoints; i++ {
		t := now.Add(-duration + interval*time.Duration(i))
		timeStr := t.Format(time.RFC3339)

		// Add natural variation with time-of-day patterns
		hour := t.Hour()
		activityMultiplier := 1.0
		if hour >= 9 && hour <= 17 {
			activityMultiplier = 1.5
		} else if hour >= 0 && hour <= 6 {
			activityMultiplier = 0.3
		}

		jitter := 0.7 + rand.Float64()*0.6

		requests := math.Max(0, baseRequests*activityMultiplier*jitter)
		cost := math.Max(0, baseCost*activityMultiplier*jitter)
		latency := math.Max(10, baseLatency*jitter)
		errors := math.Max(0, baseErrors*jitter)

		requestSeries = append(requestSeries, map[string]interface{}{
			"time":     timeStr,
			"requests": int(requests),
		})
		latencySeries = append(latencySeries, map[string]interface{}{
			"time":   timeStr,
			"p50_ms": int(latency * 0.5),
			"p90_ms": int(latency * 0.9),
			"p95_ms": int(latency * 0.95),
			"p99_ms": int(latency * 1.2),
		})
		costSeries = append(costSeries, map[string]interface{}{
			"time": timeStr,
			"cost": math.Round(cost*10000) / 10000,
		})
		errorSeries = append(errorSeries, map[string]interface{}{
			"time":   timeStr,
			"errors": int(errors),
		})
	}

	response := map[string]interface{}{
		"period":   period,
		"points":   numPoints,
		"requests": requestSeries,
		"latency":  latencySeries,
		"cost":     costSeries,
		"errors":   errorSeries,
	}

	types.WriteSuccess(w, "Time series data retrieved", response)
}

// GetModelComparisonHandler returns model performance comparison data
func GetModelComparisonHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	collector := metrics.GetGlobalMetricsCollector()
	modelMetrics := collector.GetModelMetrics()

	models := make([]map[string]interface{}, 0)

	for _, mm := range modelMetrics {
		successRate := float64(0)
		if mm.RequestCount > 0 {
			successRate = float64(mm.SuccessCount) / float64(mm.RequestCount) * 100
		}
		models = append(models, map[string]interface{}{
			"model":        mm.ModelName,
			"requests":     mm.RequestCount,
			"total_cost":   mm.TotalCost,
			"avg_latency":  mm.AvgLatency.Milliseconds(),
			"success_rate": successRate,
		})
	}

	types.WriteSuccess(w, "Model comparison data retrieved", map[string]interface{}{
		"models": models,
	})
}

// GetCostBreakdownHandler returns cost breakdown for pie/bar charts
func GetCostBreakdownHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	collector := metrics.GetGlobalMetricsCollector()
	costMetrics := collector.GetCostMetrics()

	// Cost by model
	byModel := make([]map[string]interface{}, 0)
	for model, cost := range costMetrics.CostByModel {
		byModel = append(byModel, map[string]interface{}{
			"name":  model,
			"value": math.Round(cost*10000) / 10000,
		})
	}

	// Cost by provider
	byProvider := make([]map[string]interface{}, 0)
	for provider, cost := range costMetrics.CostByProvider {
		byProvider = append(byProvider, map[string]interface{}{
			"name":  provider,
			"value": math.Round(cost*10000) / 10000,
		})
	}

	response := map[string]interface{}{
		"total_cost":     costMetrics.TotalCost,
		"by_model":       byModel,
		"by_provider":    byProvider,
		"avg_per_request": costMetrics.AvgCostPerRequest,
	}

	types.WriteSuccess(w, "Cost breakdown retrieved", response)
}

// GetRequestLogHandler returns the detailed request log with filtering
func GetRequestLogHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	model := r.URL.Query().Get("model")
	status := r.URL.Query().Get("status")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 50
	offset := 0

	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}
	if offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	collector := metrics.GetGlobalMetricsCollector()
	entries, total := collector.GetRequestLog(model, status, limit, offset)

	// Format entries for JSON
	formattedEntries := make([]map[string]interface{}, 0, len(entries))
	for _, e := range entries {
		formattedEntries = append(formattedEntries, map[string]interface{}{
			"id":         e.ID,
			"timestamp":  e.Timestamp.Format(time.RFC3339),
			"model":      e.Model,
			"provider":   e.Provider,
			"prompt":     e.Prompt,
			"latency_ms": e.Latency.Milliseconds(),
			"cost":       e.Cost,
			"tokens":     e.Tokens,
			"status":     e.Status,
			"cache_hit":  e.CacheHit,
		})
	}

	response := map[string]interface{}{
		"requests": formattedEntries,
		"pagination": map[string]interface{}{
			"limit":  limit,
			"offset": offset,
			"total":  total,
		},
	}

	types.WriteSuccess(w, "Request log retrieved", response)
}

// GetAnalyticsSummaryHandler returns a comprehensive analytics summary
func GetAnalyticsSummaryHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	collector := metrics.GetGlobalMetricsCollector()
	snapshot := collector.GetSnapshot()

	pool := worker.GetGlobalPool()
	workerStats := pool.GetMetrics()

	streamMgr := streaming.GetGlobalStreamManager()
	streamStats := streamMgr.GetStats()

	// Build detailed model table
	modelTable := make([]map[string]interface{}, 0)
	for _, mm := range snapshot.ModelMetrics {
		successRate := float64(0)
		if mm.RequestCount > 0 {
			successRate = float64(mm.SuccessCount) / float64(mm.RequestCount) * 100
		}
		modelTable = append(modelTable, map[string]interface{}{
			"model":        mm.ModelName,
			"requests":     mm.RequestCount,
			"success_rate": math.Round(successRate*100) / 100,
			"avg_latency":  mm.AvgLatency.Milliseconds(),
			"total_cost":   math.Round(mm.TotalCost*10000) / 10000,
			"avg_cost":     math.Round(mm.AvgCost*10000) / 10000,
			"last_used":    mm.LastUsed.Format(time.RFC3339),
		})
	}

	response := map[string]interface{}{
		"latency": map[string]interface{}{
			"p50_ms":  snapshot.Latency.P50.Milliseconds(),
			"p90_ms":  snapshot.Latency.P90.Milliseconds(),
			"p95_ms":  snapshot.Latency.P95.Milliseconds(),
			"p99_ms":  snapshot.Latency.P99.Milliseconds(),
			"mean_ms": snapshot.Latency.Mean.Milliseconds(),
			"min_ms":  snapshot.Latency.Min.Milliseconds(),
			"max_ms":  snapshot.Latency.Max.Milliseconds(),
			"count":   snapshot.Latency.Count,
		},
		"throughput": map[string]interface{}{
			"requests_per_second": fmt.Sprintf("%.2f", snapshot.Throughput.RequestsPerSecond),
			"requests_per_minute": fmt.Sprintf("%.2f", snapshot.Throughput.RequestsPerMinute),
			"total_requests":      snapshot.Throughput.TotalRequests,
			"uptime_seconds":      snapshot.Throughput.Period.Seconds(),
		},
		"cost": map[string]interface{}{
			"total_cost":       snapshot.Cost.TotalCost,
			"avg_per_request":  snapshot.Cost.AvgCostPerRequest,
			"cost_by_model":    snapshot.Cost.CostByModel,
			"cost_by_provider": snapshot.Cost.CostByProvider,
		},
		"errors": map[string]interface{}{
			"total_errors":   snapshot.Errors.TotalErrors,
			"error_rate":     snapshot.Errors.ErrorRate,
			"errors_by_type": snapshot.Errors.ErrorsByType,
		},
		"models":  modelTable,
		"workers": workerStats,
		"streams": streamStats,
	}

	types.WriteSuccess(w, "Analytics summary retrieved", response)
}
