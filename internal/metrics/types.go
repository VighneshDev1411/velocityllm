package metrics

import (
	"sync"
	"time"
)

// MetricType represents different types of metrics
type MetricType string

const (
	MetricTypeCounter   MetricType = "counter"
	MetricTypeGauge     MetricType = "gauge"
	MetricTypeHistogram MetricType = "histogram"
	MetricTypeSummary   MetricType = "summary"
)

// Metric represents a single metric
type Metric struct {
	Name      string
	Type      MetricType
	Value     float64
	Labels    map[string]string
	Timestamp time.Time
}

// Counter tracks cumulative values
type Counter struct {
	value float64
	mu    sync.RWMutex
}

// Gauge tracks current value
type Gauge struct {
	value float64
	mu    sync.RWMutex
}

// Histogram tracks distribution of values
type Histogram struct {
	buckets []float64
	counts  []uint64
	sum     float64
	count   uint64
	mu      sync.RWMutex
}

// Summary tracks statistical summary (percentiles)
type Summary struct {
	values  []float64
	sorted  bool
	maxSize int
	mu      sync.RWMutex
}

// LatencyMetrics tracks request latency statistics
type LatencyMetrics struct {
	P50           time.Duration // 50th percentile (median)
	P90           time.Duration // 90th percentile
	P95           time.Duration // 95th percentile
	P99           time.Duration // 99th percentile
	Min           time.Duration
	Max           time.Duration
	Mean          time.Duration
	Count         int64
	TotalDuration time.Duration
}

// ThroughputMetrics tracks request throughput
type ThroughputMetrics struct {
	RequestsPerSecond float64
	RequestsPerMinute float64
	TotalRequests     int64
	Period            time.Duration
}

// CostMetrics tracks cost statistics
type CostMetrics struct {
	TotalCost         float64
	AvgCostPerRequest float64
	CostByModel       map[string]float64
	CostByProvider    map[string]float64
}

// ErrorMetrics tracks error statistics
type ErrorMetrics struct {
	TotalErrors   int64
	ErrorRate     float64
	ErrorsByType  map[string]int64
	LastError     string
	LastErrorTime time.Time
}

// ModelMetrics tracks per-model statistics
type ModelMetrics struct {
	ModelName    string
	RequestCount int64
	SuccessCount int64
	FailureCount int64
	TotalLatency time.Duration
	AvgLatency   time.Duration
	TotalCost    float64
	AvgCost      float64
	CacheHitRate float64
	LastUsed     time.Time
}

// PerformanceSnapshot represents system performance at a point in time
type PerformanceSnapshot struct {
	Timestamp         time.Time
	Latency           LatencyMetrics
	Throughput        ThroughputMetrics
	Cost              CostMetrics
	Errors            ErrorMetrics
	ModelMetrics      map[string]*ModelMetrics
	WorkerUtilization float64
	QueueUsage        float64
	CacheHitRate      float64
}

// TimeSeriesPoint represents a point in a time series
type TimeSeriesPoint struct {
	Timestamp time.Time
	Value     float64
	Labels    map[string]string
}

// TimeSeries represents a series of metric values over time
type TimeSeries struct {
	Name   string
	Points []TimeSeriesPoint
	mu     sync.RWMutex
}

// MetricsConfig holds metrics configuration
type MetricsConfig struct {
	EnableCollection   bool
	CollectionInterval time.Duration
	RetentionPeriod    time.Duration
	MaxDataPoints      int
	EnableTimeSeries   bool
}

// DefaultMetricsConfig returns default metrics configuration
func DefaultMetricsConfig() MetricsConfig {
	return MetricsConfig{
		EnableCollection:   true,
		CollectionInterval: 10 * time.Second,
		RetentionPeriod:    24 * time.Hour,
		MaxDataPoints:      1000,
		EnableTimeSeries:   true,
	}
}

// PercentileConfig holds percentile calculation configuration
type PercentileConfig struct {
	P50 float64 // 0.50
	P90 float64 // 0.90
	P95 float64 // 0.95
	P99 float64 // 0.99
}

// DefaultPercentileConfig returns default percentile configuration
func DefaultPercentileConfig() PercentileConfig {
	return PercentileConfig{
		P50: 0.50,
		P90: 0.90,
		P95: 0.95,
		P99: 0.99,
	}
}
