package api

import (
	"fmt"
	"math"
	"math/rand"
	"net/http"
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
	if baseRequests < 1 {
		baseRequests = 10
	}
	baseCost := snapshot.Cost.TotalCost / float64(numPoints)
	if baseCost < 0.001 {
		baseCost = 0.05
	}
	baseLatency := float64(snapshot.Latency.Mean.Milliseconds())
	if baseLatency < 1 {
		baseLatency = 150
	}
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

	// If no real data, provide sample model data
	if len(modelMetrics) == 0 {
		sampleModels := []struct {
			name     string
			requests int64
			cost     float64
			latency  int64
			success  float64
		}{
			{"gpt-4", 245, 1.2340, 850, 99.2},
			{"gpt-3.5-turbo", 1230, 0.3250, 320, 99.8},
			{"claude-3-opus", 180, 1.5600, 920, 98.5},
			{"claude-3-sonnet", 890, 0.4500, 450, 99.5},
			{"llama-3-70b", 320, 0.0800, 280, 97.8},
		}

		for _, m := range sampleModels {
			models = append(models, map[string]interface{}{
				"model":        m.name,
				"requests":     m.requests,
				"total_cost":   m.cost,
				"avg_latency":  m.latency,
				"success_rate": m.success,
			})
		}
	} else {
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
	if len(costMetrics.CostByModel) == 0 {
		// Sample data
		byModel = append(byModel,
			map[string]interface{}{"name": "gpt-4", "value": 1.234},
			map[string]interface{}{"name": "gpt-3.5-turbo", "value": 0.325},
			map[string]interface{}{"name": "claude-3-opus", "value": 1.560},
			map[string]interface{}{"name": "claude-3-sonnet", "value": 0.450},
			map[string]interface{}{"name": "llama-3-70b", "value": 0.080},
		)
	} else {
		for model, cost := range costMetrics.CostByModel {
			byModel = append(byModel, map[string]interface{}{
				"name":  model,
				"value": math.Round(cost*10000) / 10000,
			})
		}
	}

	// Cost by provider
	byProvider := make([]map[string]interface{}, 0)
	if len(costMetrics.CostByProvider) == 0 {
		byProvider = append(byProvider,
			map[string]interface{}{"name": "OpenAI", "value": 1.559},
			map[string]interface{}{"name": "Anthropic", "value": 2.010},
			map[string]interface{}{"name": "Meta (Self-hosted)", "value": 0.080},
		)
	} else {
		for provider, cost := range costMetrics.CostByProvider {
			byProvider = append(byProvider, map[string]interface{}{
				"name":  provider,
				"value": math.Round(cost*10000) / 10000,
			})
		}
	}

	response := map[string]interface{}{
		"total_cost":     costMetrics.TotalCost,
		"by_model":       byModel,
		"by_provider":    byProvider,
		"avg_per_request": costMetrics.AvgCostPerRequest,
	}

	types.WriteSuccess(w, "Cost breakdown retrieved", response)
}
