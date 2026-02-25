package api

import (
	"fmt"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/database"
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

// GetRequestTimeSeriesHandler returns time-series data for charts backed by PostgreSQL
func GetRequestTimeSeriesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	period := r.URL.Query().Get("period")
	if period == "" {
		period = "24h"
	}

	var duration time.Duration
	var truncUnit string
	var numPoints int
	var step time.Duration

	switch period {
	case "1h":
		duration, truncUnit, numPoints, step = time.Hour, "minute", 12, 5*time.Minute
	case "6h":
		duration, truncUnit, numPoints, step = 6*time.Hour, "minute", 24, 15*time.Minute
	case "24h":
		duration, truncUnit, numPoints, step = 24*time.Hour, "hour", 24, time.Hour
	case "7d":
		duration, truncUnit, numPoints, step = 7*24*time.Hour, "day", 7, 24*time.Hour
	default:
		duration, truncUnit, numPoints, step = 24*time.Hour, "hour", 24, time.Hour
	}

	now := time.Now().UTC()
	start := now.Add(-duration)

	repo := database.NewRequestRepository()
	rawBuckets, err := repo.GetTimeSeriesAggregation(start, now, truncUnit)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to query time series data")
		return
	}

	// Aggregate raw DB buckets (minute-level for 1h/6h) into step-sized bins
	type binEntry struct {
		requests     int64
		errors       int64
		avgLatencyMs float64
		p50Ms        float64
		p90Ms        float64
		p95Ms        float64
		p99Ms        float64
		totalCost    float64
	}
	binMap := make(map[time.Time]*binEntry)
	bucketStart := start.Truncate(step)

	for _, b := range rawBuckets {
		bt := b.BucketTime.UTC()
		elapsed := bt.Sub(bucketStart)
		if elapsed < 0 {
			elapsed = 0
		}
		binIdx := int64(elapsed / step)
		binTime := bucketStart.Add(time.Duration(binIdx) * step)

		if existing, ok := binMap[binTime]; ok {
			totalReq := existing.requests + b.Requests
			if totalReq > 0 {
				existing.avgLatencyMs = (existing.avgLatencyMs*float64(existing.requests) + b.AvgLatencyMs*float64(b.Requests)) / float64(totalReq)
			}
			existing.requests = totalReq
			existing.errors += b.Errors
			existing.totalCost += b.TotalCost
			if b.P50Ms > existing.p50Ms {
				existing.p50Ms = b.P50Ms
			}
			if b.P90Ms > existing.p90Ms {
				existing.p90Ms = b.P90Ms
			}
			if b.P95Ms > existing.p95Ms {
				existing.p95Ms = b.P95Ms
			}
			if b.P99Ms > existing.p99Ms {
				existing.p99Ms = b.P99Ms
			}
		} else {
			binMap[binTime] = &binEntry{
				requests:     b.Requests,
				errors:       b.Errors,
				avgLatencyMs: b.AvgLatencyMs,
				p50Ms:        b.P50Ms,
				p90Ms:        b.P90Ms,
				p95Ms:        b.P95Ms,
				p99Ms:        b.P99Ms,
				totalCost:    b.TotalCost,
			}
		}
	}

	// Zero-fill: build separate series arrays expected by the frontend
	type requestPoint struct {
		Time     string  `json:"time"`
		Requests int64   `json:"requests"`
		Errors   int64   `json:"errors"`
	}
	type latencyPoint struct {
		Time  string  `json:"time"`
		P50Ms float64 `json:"p50_ms"`
		P90Ms float64 `json:"p90_ms"`
		P95Ms float64 `json:"p95_ms"`
		P99Ms float64 `json:"p99_ms"`
	}
	type costPoint struct {
		Time string  `json:"time"`
		Cost float64 `json:"cost"`
	}

	requestSeries := make([]requestPoint, 0, numPoints)
	latencySeries := make([]latencyPoint, 0, numPoints)
	costSeries := make([]costPoint, 0, numPoints)

	for i := 0; i < numPoints; i++ {
		t := bucketStart.Add(time.Duration(i) * step)
		ts := t.Format(time.RFC3339)
		if b, ok := binMap[t]; ok {
			requestSeries = append(requestSeries, requestPoint{Time: ts, Requests: b.requests, Errors: b.errors})
			latencySeries = append(latencySeries, latencyPoint{Time: ts, P50Ms: b.p50Ms, P90Ms: b.p90Ms, P95Ms: b.p95Ms, P99Ms: b.p99Ms})
			costSeries = append(costSeries, costPoint{Time: ts, Cost: b.totalCost})
		} else {
			requestSeries = append(requestSeries, requestPoint{Time: ts})
			latencySeries = append(latencySeries, latencyPoint{Time: ts})
			costSeries = append(costSeries, costPoint{Time: ts})
		}
	}

	types.WriteSuccess(w, "Time series data retrieved", map[string]interface{}{
		"period":   period,
		"points":   numPoints,
		"requests": requestSeries,
		"latency":  latencySeries,
		"cost":     costSeries,
		"errors":   requestSeries, // errors field uses same slice (has errors count)
	})
}

// GetModelComparisonHandler returns model performance comparison data from the DB
func GetModelComparisonHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	repo := database.NewRequestRepository()
	modelStats, err := repo.GetModelStats()
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to query model stats")
		return
	}

	models := make([]map[string]interface{}, 0, len(modelStats))
	for _, ms := range modelStats {
		successRate := float64(0)
		if ms.RequestCount > 0 {
			successRate = float64(ms.SuccessCount) / float64(ms.RequestCount) * 100
		}
		models = append(models, map[string]interface{}{
			"model":        ms.Model,
			"requests":     ms.RequestCount,
			"total_cost":   math.Round(ms.TotalCost*10000) / 10000,
			"avg_latency":  math.Round(ms.AvgLatencyMs),
			"success_rate": math.Round(successRate*100) / 100,
			"avg_cost":     math.Round(ms.AvgCost*10000) / 10000,
			"last_used":    ms.LastUsed.Format(time.RFC3339),
		})
	}

	types.WriteSuccess(w, "Model comparison data retrieved", map[string]interface{}{
		"models": models,
	})
}

// GetCostBreakdownHandler returns cost breakdown for pie/bar charts from the DB
func GetCostBreakdownHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	repo := database.NewRequestRepository()
	modelStats, err := repo.GetModelStats()
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to query cost stats")
		return
	}

	costByModel := make(map[string]float64)
	costByProvider := make(map[string]float64)
	totalCost := 0.0
	totalRequests := int64(0)
	for _, ms := range modelStats {
		costByModel[ms.Model] += ms.TotalCost
		costByProvider[ms.Provider] += ms.TotalCost
		totalCost += ms.TotalCost
		totalRequests += ms.RequestCount
	}

	byModel := make([]map[string]interface{}, 0)
	for model, cost := range costByModel {
		byModel = append(byModel, map[string]interface{}{
			"name":  model,
			"value": math.Round(cost*10000) / 10000,
		})
	}

	byProvider := make([]map[string]interface{}, 0)
	for provider, cost := range costByProvider {
		byProvider = append(byProvider, map[string]interface{}{
			"name":  provider,
			"value": math.Round(cost*10000) / 10000,
		})
	}

	avgPerRequest := 0.0
	if totalRequests > 0 {
		avgPerRequest = totalCost / float64(totalRequests)
	}

	types.WriteSuccess(w, "Cost breakdown retrieved", map[string]interface{}{
		"total_cost":      math.Round(totalCost*10000) / 10000,
		"by_model":        byModel,
		"by_provider":     byProvider,
		"avg_per_request": math.Round(avgPerRequest*10000) / 10000,
	})
}

// GetRequestLogHandler returns the full request log from the DB with filtering
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

	repo := database.NewRequestRepository()
	requests, total, err := repo.GetFiltered(model, status, limit, offset)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to query request log")
		return
	}

	formattedEntries := make([]map[string]interface{}, 0, len(requests))
	for _, req := range requests {
		formattedEntries = append(formattedEntries, map[string]interface{}{
			"id":         req.ID,
			"timestamp":  req.CreatedAt.Format(time.RFC3339),
			"model":      req.Model,
			"provider":   req.Provider,
			"prompt":     req.Prompt,
			"latency_ms": req.Latency,
			"cost":       req.Cost,
			"tokens":     req.TokensTotal,
			"status":     req.Status,
			"cache_hit":  req.CacheHit,
		})
	}

	types.WriteSuccess(w, "Request log retrieved", map[string]interface{}{
		"requests": formattedEntries,
		"pagination": map[string]interface{}{
			"limit":  limit,
			"offset": offset,
			"total":  total,
		},
	})
}

// GetAnalyticsSummaryHandler returns a comprehensive analytics summary backed by the DB
func GetAnalyticsSummaryHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	repo := database.NewRequestRepository()

	latencyStats, err := repo.GetOverallLatencyStats()
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to query latency stats")
		return
	}

	modelStats, err := repo.GetModelStats()
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to query model stats")
		return
	}

	// Aggregate totals from model stats
	totalCost := 0.0
	totalRequests := int64(0)
	totalErrors := int64(0)
	costByModel := make(map[string]float64)
	costByProvider := make(map[string]float64)
	for _, ms := range modelStats {
		totalCost += ms.TotalCost
		totalRequests += ms.RequestCount
		totalErrors += ms.ErrorCount
		costByModel[ms.Model] += ms.TotalCost
		costByProvider[ms.Provider] += ms.TotalCost
	}
	avgCost := 0.0
	if totalRequests > 0 {
		avgCost = totalCost / float64(totalRequests)
	}

	// Build model table
	modelTable := make([]map[string]interface{}, 0, len(modelStats))
	for _, ms := range modelStats {
		successRate := float64(0)
		if ms.RequestCount > 0 {
			successRate = float64(ms.SuccessCount) / float64(ms.RequestCount) * 100
		}
		modelTable = append(modelTable, map[string]interface{}{
			"model":        ms.Model,
			"requests":     ms.RequestCount,
			"success_rate": math.Round(successRate*100) / 100,
			"avg_latency":  math.Round(ms.AvgLatencyMs),
			"total_cost":   math.Round(ms.TotalCost*10000) / 10000,
			"avg_cost":     math.Round(ms.AvgCost*10000) / 10000,
			"last_used":    ms.LastUsed.Format(time.RFC3339),
		})
	}

	// Real-time rates (need sliding window, stay in-memory) and infra status
	collector := metrics.GetGlobalMetricsCollector()
	snapshot := collector.GetSnapshot()
	pool := worker.GetGlobalPool()
	workerStats := pool.GetMetrics()
	streamMgr := streaming.GetGlobalStreamManager()
	streamStats := streamMgr.GetStats()

	errorRate := 0.0
	if totalRequests > 0 {
		errorRate = float64(totalErrors) / float64(totalRequests) * 100
	}

	response := map[string]interface{}{
		"latency": map[string]interface{}{
			"p50_ms":  latencyStats.P50Ms,
			"p90_ms":  latencyStats.P90Ms,
			"p95_ms":  latencyStats.P95Ms,
			"p99_ms":  latencyStats.P99Ms,
			"mean_ms": latencyStats.MeanMs,
			"min_ms":  latencyStats.MinMs,
			"max_ms":  latencyStats.MaxMs,
			"count":   latencyStats.Count,
		},
		"throughput": map[string]interface{}{
			"requests_per_second": fmt.Sprintf("%.2f", snapshot.Throughput.RequestsPerSecond),
			"requests_per_minute": fmt.Sprintf("%.2f", snapshot.Throughput.RequestsPerMinute),
			"total_requests":      totalRequests,
			"uptime_seconds":      snapshot.Throughput.Period.Seconds(),
		},
		"cost": map[string]interface{}{
			"total_cost":       math.Round(totalCost*10000) / 10000,
			"avg_per_request":  math.Round(avgCost*10000) / 10000,
			"cost_by_model":    costByModel,
			"cost_by_provider": costByProvider,
		},
		"errors": map[string]interface{}{
			"total_errors":   totalErrors,
			"error_rate":     math.Round(errorRate*100) / 100,
			"errors_by_type": snapshot.Errors.ErrorsByType,
		},
		"models":  modelTable,
		"workers": workerStats,
		"streams": streamStats,
	}

	types.WriteSuccess(w, "Analytics summary retrieved", response)
}
