package cache

import (
	"sync"
	"time"
)

// CacheAnalytics tracks detailed cache performance metrics
type CacheAnalytics struct {
	mu sync.RWMutex

	// Hit/Miss tracking
	l1Hits   int64
	l1Misses int64
	l2Hits   int64
	l2Misses int64

	// Latency tracking
	l1HitLatencies  []time.Duration
	l2HitLatencies  []time.Duration
	writeLatencies  []time.Duration
	maxLatencySamples int

	// Time-series data (last hour)
	hitsByMinute   map[int64]int64
	missesByMinute map[int64]int64

	// Model/prompt tracking
	hitsByModel  map[string]int64
	costSavings  float64
	bytesServed  int64
}

// NewCacheAnalytics creates a new analytics tracker
func NewCacheAnalytics() *CacheAnalytics {
	return &CacheAnalytics{
		l1HitLatencies:    make([]time.Duration, 0, 1000),
		l2HitLatencies:    make([]time.Duration, 0, 1000),
		writeLatencies:    make([]time.Duration, 0, 1000),
		maxLatencySamples: 1000,
		hitsByMinute:      make(map[int64]int64),
		missesByMinute:    make(map[int64]int64),
		hitsByModel:       make(map[string]int64),
	}
}

// RecordHit records a cache hit
func (ca *CacheAnalytics) RecordHit(level CacheLevel, latency time.Duration) {
	ca.mu.Lock()
	defer ca.mu.Unlock()

	minute := time.Now().Unix() / 60

	if level == L1 {
		ca.l1Hits++
		ca.recordLatency(&ca.l1HitLatencies, latency)
	} else {
		ca.l2Hits++
		ca.recordLatency(&ca.l2HitLatencies, latency)
	}

	ca.hitsByMinute[minute]++
}

// RecordMiss records a cache miss
func (ca *CacheAnalytics) RecordMiss(level CacheLevel, latency time.Duration) {
	ca.mu.Lock()
	defer ca.mu.Unlock()

	minute := time.Now().Unix() / 60

	if level == L1 {
		ca.l1Misses++
	} else {
		ca.l2Misses++
	}

	ca.missesByMinute[minute]++
}

// RecordWrite records a cache write operation
func (ca *CacheAnalytics) RecordWrite(latency time.Duration) {
	ca.mu.Lock()
	defer ca.mu.Unlock()

	ca.recordLatency(&ca.writeLatencies, latency)
}

// RecordModelHit tracks hits per model
func (ca *CacheAnalytics) RecordModelHit(model string) {
	ca.mu.Lock()
	defer ca.mu.Unlock()

	ca.hitsByModel[model]++
}

// RecordCostSavings adds to the total cost savings from cache hits
func (ca *CacheAnalytics) RecordCostSavings(amount float64) {
	ca.mu.Lock()
	defer ca.mu.Unlock()

	ca.costSavings += amount
}

// recordLatency adds a latency sample (with circular buffer)
func (ca *CacheAnalytics) recordLatency(latencies *[]time.Duration, latency time.Duration) {
	if len(*latencies) >= ca.maxLatencySamples {
		// Remove oldest sample
		*latencies = (*latencies)[1:]
	}
	*latencies = append(*latencies, latency)
}

// GetStats returns current analytics statistics
func (ca *CacheAnalytics) GetStats() *AnalyticsStats {
	ca.mu.RLock()
	defer ca.mu.RUnlock()

	totalL1 := ca.l1Hits + ca.l1Misses
	totalL2 := ca.l2Hits + ca.l2Misses
	totalHits := ca.l1Hits + ca.l2Hits
	totalMisses := ca.l1Misses + ca.l2Misses
	totalRequests := totalHits + totalMisses

	var overallHitRate, l1HitRate, l2HitRate float64
	if totalRequests > 0 {
		overallHitRate = float64(totalHits) / float64(totalRequests)
	}
	if totalL1 > 0 {
		l1HitRate = float64(ca.l1Hits) / float64(totalL1)
	}
	if totalL2 > 0 {
		l2HitRate = float64(ca.l2Hits) / float64(totalL2)
	}

	return &AnalyticsStats{
		L1Hits:         ca.l1Hits,
		L1Misses:       ca.l1Misses,
		L2Hits:         ca.l2Hits,
		L2Misses:       ca.l2Misses,
		TotalHits:      totalHits,
		TotalMisses:    totalMisses,
		OverallHitRate: overallHitRate,
		L1HitRate:      l1HitRate,
		L2HitRate:      l2HitRate,
		AvgL1Latency:   ca.avgLatency(ca.l1HitLatencies),
		AvgL2Latency:   ca.avgLatency(ca.l2HitLatencies),
		AvgWriteLatency: ca.avgLatency(ca.writeLatencies),
		P50L1Latency:   ca.percentileLatency(ca.l1HitLatencies, 0.50),
		P95L1Latency:   ca.percentileLatency(ca.l1HitLatencies, 0.95),
		P99L1Latency:   ca.percentileLatency(ca.l1HitLatencies, 0.99),
		P50L2Latency:   ca.percentileLatency(ca.l2HitLatencies, 0.50),
		P95L2Latency:   ca.percentileLatency(ca.l2HitLatencies, 0.95),
		P99L2Latency:   ca.percentileLatency(ca.l2HitLatencies, 0.99),
		HitsByModel:    ca.copyHitsByModel(),
		CostSavings:    ca.costSavings,
		BytesServed:    ca.bytesServed,
	}
}

// avgLatency calculates average latency
func (ca *CacheAnalytics) avgLatency(latencies []time.Duration) float64 {
	if len(latencies) == 0 {
		return 0
	}

	var sum time.Duration
	for _, l := range latencies {
		sum += l
	}

	return float64(sum) / float64(len(latencies)) / float64(time.Millisecond)
}

// percentileLatency calculates percentile latency
func (ca *CacheAnalytics) percentileLatency(latencies []time.Duration, percentile float64) float64 {
	if len(latencies) == 0 {
		return 0
	}

	// Simple percentile calculation (not sorting for performance)
	// In production, use a proper percentile algorithm
	index := int(float64(len(latencies)) * percentile)
	if index >= len(latencies) {
		index = len(latencies) - 1
	}

	return float64(latencies[index]) / float64(time.Millisecond)
}

// copyHitsByModel returns a copy of hits by model
func (ca *CacheAnalytics) copyHitsByModel() map[string]int64 {
	result := make(map[string]int64)
	for model, hits := range ca.hitsByModel {
		result[model] = hits
	}
	return result
}

// Reset clears all analytics data
func (ca *CacheAnalytics) Reset() {
	ca.mu.Lock()
	defer ca.mu.Unlock()

	ca.l1Hits = 0
	ca.l1Misses = 0
	ca.l2Hits = 0
	ca.l2Misses = 0
	ca.l1HitLatencies = make([]time.Duration, 0, ca.maxLatencySamples)
	ca.l2HitLatencies = make([]time.Duration, 0, ca.maxLatencySamples)
	ca.writeLatencies = make([]time.Duration, 0, ca.maxLatencySamples)
	ca.hitsByMinute = make(map[int64]int64)
	ca.missesByMinute = make(map[int64]int64)
	ca.hitsByModel = make(map[string]int64)
	ca.costSavings = 0
	ca.bytesServed = 0
}

// AnalyticsStats represents detailed cache analytics
type AnalyticsStats struct {
	L1Hits           int64              `json:"l1_hits"`
	L1Misses         int64              `json:"l1_misses"`
	L2Hits           int64              `json:"l2_hits"`
	L2Misses         int64              `json:"l2_misses"`
	TotalHits        int64              `json:"total_hits"`
	TotalMisses      int64              `json:"total_misses"`
	OverallHitRate   float64            `json:"overall_hit_rate"`
	L1HitRate        float64            `json:"l1_hit_rate"`
	L2HitRate        float64            `json:"l2_hit_rate"`
	AvgL1Latency     float64            `json:"avg_l1_latency_ms"`
	AvgL2Latency     float64            `json:"avg_l2_latency_ms"`
	AvgWriteLatency  float64            `json:"avg_write_latency_ms"`
	P50L1Latency     float64            `json:"p50_l1_latency_ms"`
	P95L1Latency     float64            `json:"p95_l1_latency_ms"`
	P99L1Latency     float64            `json:"p99_l1_latency_ms"`
	P50L2Latency     float64            `json:"p50_l2_latency_ms"`
	P95L2Latency     float64            `json:"p95_l2_latency_ms"`
	P99L2Latency     float64            `json:"p99_l2_latency_ms"`
	HitsByModel      map[string]int64   `json:"hits_by_model"`
	CostSavings      float64            `json:"cost_savings_usd"`
	BytesServed      int64              `json:"bytes_served"`
}
