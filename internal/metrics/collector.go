package metrics

import (
	"sort"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// MetricsCollector collects and aggregates metrics
type MetricsCollector struct {
	config            MetricsConfig
	latencies         []time.Duration
	costs             []float64
	requestTimestamps []time.Time
	modelMetrics      map[string]*ModelMetrics
	errorCounts       map[string]int64
	totalRequests     int64
	totalErrors       int64
	totalCost         float64
	startTime         time.Time
	requestLog        []RequestLogEntry
	mu                sync.RWMutex
}

// NewMetricsCollector creates a new metrics collector
func NewMetricsCollector(config MetricsConfig) *MetricsCollector {
	mc := &MetricsCollector{
		config:            config,
		latencies:         make([]time.Duration, 0, 1000),
		costs:             make([]float64, 0, 1000),
		requestTimestamps: make([]time.Time, 0, 1000),
		modelMetrics:      make(map[string]*ModelMetrics),
		errorCounts:       make(map[string]int64),
		requestLog:        make([]RequestLogEntry, 0, 500),
		startTime:         time.Now(),
	}

	utils.Info("Metrics collector initialized (interval: %s)", config.CollectionInterval)
	return mc
}

// RecordRequest records a request with its metrics
func (mc *MetricsCollector) RecordRequest(
	modelName string,
	latency time.Duration,
	cost float64,
	success bool,
	cacheHit bool,
) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	// Record overall metrics
	mc.totalRequests++
	mc.latencies = append(mc.latencies, latency)
	mc.costs = append(mc.costs, cost)
	mc.requestTimestamps = append(mc.requestTimestamps, time.Now())
	mc.totalCost += cost

	if !success {
		mc.totalErrors++
	}

	// Record per-model metrics
	if _, exists := mc.modelMetrics[modelName]; !exists {
		mc.modelMetrics[modelName] = &ModelMetrics{
			ModelName: modelName,
		}
	}

	modelMetric := mc.modelMetrics[modelName]
	modelMetric.RequestCount++
	modelMetric.TotalLatency += latency
	modelMetric.TotalCost += cost
	modelMetric.LastUsed = time.Now()

	if success {
		modelMetric.SuccessCount++
	} else {
		modelMetric.FailureCount++
	}

	// Update averages
	modelMetric.AvgLatency = modelMetric.TotalLatency / time.Duration(modelMetric.RequestCount)
	modelMetric.AvgCost = modelMetric.TotalCost / float64(modelMetric.RequestCount)

	// Cleanup old data if needed
	mc.cleanup()
}

// RecordDetailedRequest records a request with full details for the request log
func (mc *MetricsCollector) RecordDetailedRequest(entry RequestLogEntry) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	mc.requestLog = append(mc.requestLog, entry)

	// Keep only last 500 entries
	if len(mc.requestLog) > 500 {
		mc.requestLog = mc.requestLog[len(mc.requestLog)-500:]
	}
}

// GetRequestLog returns the request log, optionally filtered
func (mc *MetricsCollector) GetRequestLog(model string, status string, limit int, offset int) ([]RequestLogEntry, int) {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	// Filter
	var filtered []RequestLogEntry
	for i := len(mc.requestLog) - 1; i >= 0; i-- {
		entry := mc.requestLog[i]
		if model != "" && entry.Model != model {
			continue
		}
		if status != "" && entry.Status != status {
			continue
		}
		filtered = append(filtered, entry)
	}

	total := len(filtered)

	// Paginate
	if offset >= len(filtered) {
		return []RequestLogEntry{}, total
	}
	filtered = filtered[offset:]
	if limit > 0 && limit < len(filtered) {
		filtered = filtered[:limit]
	}

	return filtered, total
}

// RecordError records an error
func (mc *MetricsCollector) RecordError(errorType string) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	mc.totalErrors++
	mc.errorCounts[errorType]++
}

// GetLatencyMetrics returns latency statistics
func (mc *MetricsCollector) GetLatencyMetrics() LatencyMetrics {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	if len(mc.latencies) == 0 {
		return LatencyMetrics{}
	}

	// Make a copy and sort for percentile calculation
	latenciesCopy := make([]time.Duration, len(mc.latencies))
	copy(latenciesCopy, mc.latencies)
	sort.Slice(latenciesCopy, func(i, j int) bool {
		return latenciesCopy[i] < latenciesCopy[j]
	})

	// Calculate percentiles
	p50 := calculatePercentile(latenciesCopy, 0.50)
	p90 := calculatePercentile(latenciesCopy, 0.90)
	p95 := calculatePercentile(latenciesCopy, 0.95)
	p99 := calculatePercentile(latenciesCopy, 0.99)

	// Calculate mean
	var totalDuration time.Duration
	for _, lat := range mc.latencies {
		totalDuration += lat
	}
	mean := totalDuration / time.Duration(len(mc.latencies))

	return LatencyMetrics{
		P50:           p50,
		P90:           p90,
		P95:           p95,
		P99:           p99,
		Min:           latenciesCopy[0],
		Max:           latenciesCopy[len(latenciesCopy)-1],
		Mean:          mean,
		Count:         int64(len(mc.latencies)),
		TotalDuration: totalDuration,
	}
}

// GetThroughputMetrics returns throughput statistics
func (mc *MetricsCollector) GetThroughputMetrics() ThroughputMetrics {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	elapsed := time.Since(mc.startTime)
	seconds := elapsed.Seconds()

	var rps, rpm float64
	if seconds > 0 {
		rps = float64(mc.totalRequests) / seconds
		rpm = rps * 60
	}

	return ThroughputMetrics{
		RequestsPerSecond: rps,
		RequestsPerMinute: rpm,
		TotalRequests:     mc.totalRequests,
		Period:            elapsed,
	}
}

// GetCostMetrics returns cost statistics
func (mc *MetricsCollector) GetCostMetrics() CostMetrics {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	avgCost := float64(0)
	if mc.totalRequests > 0 {
		avgCost = mc.totalCost / float64(mc.totalRequests)
	}

	costByModel := make(map[string]float64)
	costByProvider := make(map[string]float64)

	for modelName, metrics := range mc.modelMetrics {
		costByModel[modelName] = metrics.TotalCost
		// Simplified provider extraction (you can enhance this)
		if contains(modelName, "gpt") {
			costByProvider["openai"] += metrics.TotalCost
		} else if contains(modelName, "claude") {
			costByProvider["anthropic"] += metrics.TotalCost
		} else if contains(modelName, "llama") {
			costByProvider["meta"] += metrics.TotalCost
		}
	}

	return CostMetrics{
		TotalCost:         mc.totalCost,
		AvgCostPerRequest: avgCost,
		CostByModel:       costByModel,
		CostByProvider:    costByProvider,
	}
}

// GetErrorMetrics returns error statistics
func (mc *MetricsCollector) GetErrorMetrics() ErrorMetrics {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	errorRate := float64(0)
	if mc.totalRequests > 0 {
		errorRate = float64(mc.totalErrors) / float64(mc.totalRequests) * 100
	}

	errorsByType := make(map[string]int64)
	for errType, count := range mc.errorCounts {
		errorsByType[errType] = count
	}

	return ErrorMetrics{
		TotalErrors:  mc.totalErrors,
		ErrorRate:    errorRate,
		ErrorsByType: errorsByType,
	}
}

// GetModelMetrics returns per-model statistics
func (mc *MetricsCollector) GetModelMetrics() map[string]*ModelMetrics {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	// Return a copy
	result := make(map[string]*ModelMetrics)
	for name, metrics := range mc.modelMetrics {
		metricsCopy := *metrics
		result[name] = &metricsCopy
	}

	return result
}

// GetSnapshot returns a complete performance snapshot
func (mc *MetricsCollector) GetSnapshot() PerformanceSnapshot {
	return PerformanceSnapshot{
		Timestamp:    time.Now(),
		Latency:      mc.GetLatencyMetrics(),
		Throughput:   mc.GetThroughputMetrics(),
		Cost:         mc.GetCostMetrics(),
		Errors:       mc.GetErrorMetrics(),
		ModelMetrics: mc.GetModelMetrics(),
	}
}

// Reset resets all metrics
func (mc *MetricsCollector) Reset() {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	mc.latencies = make([]time.Duration, 0, 1000)
	mc.costs = make([]float64, 0, 1000)
	mc.requestTimestamps = make([]time.Time, 0, 1000)
	mc.modelMetrics = make(map[string]*ModelMetrics)
	mc.errorCounts = make(map[string]int64)
	mc.requestLog = make([]RequestLogEntry, 0, 500)
	mc.totalRequests = 0
	mc.totalErrors = 0
	mc.totalCost = 0
	mc.startTime = time.Now()

	utils.Info("Metrics reset")
}

// cleanup removes old data points beyond retention period
func (mc *MetricsCollector) cleanup() {
	if !mc.config.EnableCollection {
		return
	}

	maxDataPoints := mc.config.MaxDataPoints

	// Trim latencies
	if len(mc.latencies) > maxDataPoints {
		mc.latencies = mc.latencies[len(mc.latencies)-maxDataPoints:]
	}

	// Trim costs
	if len(mc.costs) > maxDataPoints {
		mc.costs = mc.costs[len(mc.costs)-maxDataPoints:]
	}

	// Trim timestamps
	if len(mc.requestTimestamps) > maxDataPoints {
		mc.requestTimestamps = mc.requestTimestamps[len(mc.requestTimestamps)-maxDataPoints:]
	}
}

// GetTimeSeries returns real time-series data bucketed from stored request history.
// The three parallel arrays (requestTimestamps, latencies, costs) are scanned and
// assigned to one of numPoints buckets spanning [now-duration, now].
// Error counts come from the requestLog (which records per-request status).
func (mc *MetricsCollector) GetTimeSeries(duration time.Duration, numPoints int) map[string][]map[string]interface{} {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	now := time.Now()
	start := now.Add(-duration)
	interval := duration / time.Duration(numPoints)

	type bucket struct {
		count     int
		errors    int
		latencies []time.Duration
		cost      float64
	}
	buckets := make([]bucket, numPoints)

	// Bucket requests from the parallel arrays
	for i, ts := range mc.requestTimestamps {
		if ts.Before(start) {
			continue
		}
		elapsed := ts.Sub(start)
		idx := int(elapsed / interval)
		if idx >= numPoints {
			idx = numPoints - 1
		}
		buckets[idx].count++
		if i < len(mc.latencies) {
			buckets[idx].latencies = append(buckets[idx].latencies, mc.latencies[i])
		}
		if i < len(mc.costs) {
			buckets[idx].cost += mc.costs[i]
		}
	}

	// Add error counts from the request log (has per-request Status field)
	for _, entry := range mc.requestLog {
		if entry.Timestamp.Before(start) || entry.Status != "error" {
			continue
		}
		elapsed := entry.Timestamp.Sub(start)
		idx := int(elapsed / interval)
		if idx >= numPoints {
			idx = numPoints - 1
		}
		buckets[idx].errors++
	}

	requestSeries := make([]map[string]interface{}, 0, numPoints)
	latencySeries := make([]map[string]interface{}, 0, numPoints)
	costSeries := make([]map[string]interface{}, 0, numPoints)
	errorSeries := make([]map[string]interface{}, 0, numPoints)

	for i, b := range buckets {
		t := start.Add(interval * time.Duration(i))
		timeStr := t.Format(time.RFC3339)

		var p50, p90, p95, p99 int64
		if len(b.latencies) > 0 {
			sorted := make([]time.Duration, len(b.latencies))
			copy(sorted, b.latencies)
			sort.Slice(sorted, func(a, c int) bool { return sorted[a] < sorted[c] })
			p50 = calculatePercentile(sorted, 0.50).Milliseconds()
			p90 = calculatePercentile(sorted, 0.90).Milliseconds()
			p95 = calculatePercentile(sorted, 0.95).Milliseconds()
			p99 = calculatePercentile(sorted, 0.99).Milliseconds()
		}

		requestSeries = append(requestSeries, map[string]interface{}{
			"time":     timeStr,
			"requests": b.count,
		})
		latencySeries = append(latencySeries, map[string]interface{}{
			"time":   timeStr,
			"p50_ms": p50,
			"p90_ms": p90,
			"p95_ms": p95,
			"p99_ms": p99,
		})
		costSeries = append(costSeries, map[string]interface{}{
			"time": timeStr,
			"cost": b.cost,
		})
		errorSeries = append(errorSeries, map[string]interface{}{
			"time":   timeStr,
			"errors": b.errors,
		})
	}

	return map[string][]map[string]interface{}{
		"requests": requestSeries,
		"latency":  latencySeries,
		"cost":     costSeries,
		"errors":   errorSeries,
	}
}

// calculatePercentile calculates the given percentile from sorted data
func calculatePercentile(sorted []time.Duration, percentile float64) time.Duration {
	if len(sorted) == 0 {
		return 0
	}

	index := int(float64(len(sorted)-1) * percentile)
	return sorted[index]
}

// contains checks if string contains substring
func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		match := true
		for j := 0; j < len(substr); j++ {
			if s[i+j] != substr[j] {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}

// Global metrics collector
var globalMetricsCollector *MetricsCollector
var metricsOnce sync.Once

// InitGlobalMetricsCollector initializes the global metrics collector
func InitGlobalMetricsCollector(config MetricsConfig) {
	metricsOnce.Do(func() {
		globalMetricsCollector = NewMetricsCollector(config)
	})
}

// GetGlobalMetricsCollector returns the global metrics collector
func GetGlobalMetricsCollector() *MetricsCollector {
	if globalMetricsCollector == nil {
		InitGlobalMetricsCollector(DefaultMetricsConfig())
	}
	return globalMetricsCollector
}
