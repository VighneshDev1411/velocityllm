package loadtest

import (
	"time"

	"gorm.io/gorm"
)

// LoadPattern defines the type of load test pattern
type LoadPattern string

const (
	LoadPatternConstant LoadPattern = "constant" // Steady RPS
	LoadPatternRampUp   LoadPattern = "rampup"   // Gradually increase
	LoadPatternSpike    LoadPattern = "spike"    // Sudden burst
	LoadPatternWave     LoadPattern = "wave"     // Sine wave pattern
	LoadPatternBurst    LoadPattern = "burst"    // Periodic bursts
)

// TestStatus represents the current state of a load test
type TestStatus string

const (
	TestStatusQueued    TestStatus = "queued"
	TestStatusRunning   TestStatus = "running"
	TestStatusCompleted TestStatus = "completed"
	TestStatusFailed    TestStatus = "failed"
	TestStatusCancelled TestStatus = "cancelled"
)

// LoadTestConfig represents the configuration for a load test
type LoadTestConfig struct {
	ID              uint        `gorm:"primaryKey" json:"id"`
	Name            string      `gorm:"type:varchar(255);not null" json:"name"`
	Pattern         LoadPattern `gorm:"type:varchar(20);not null" json:"pattern"`
	TargetRPS       int         `gorm:"not null" json:"target_rps"`        // Requests per second
	Duration        int         `gorm:"not null" json:"duration"`          // Duration in seconds
	Concurrency     int         `gorm:"not null" json:"concurrency"`       // Number of concurrent workers
	RampUpTime      int         `gorm:"default:0" json:"ramp_up_time"`     // Ramp-up period in seconds
	Model           string      `gorm:"type:varchar(100)" json:"model"`    // Target model (optional)
	Provider        string      `gorm:"type:varchar(50)" json:"provider"`  // Target provider (optional)
	Prompt          string      `gorm:"type:text" json:"prompt"`           // Test prompt
	MaxTokens       int         `gorm:"default:100" json:"max_tokens"`
	EnableCache     bool        `gorm:"default:true" json:"enable_cache"`
	EnableBatching  bool        `gorm:"default:false" json:"enable_batching"`
	CreatedBy       uint        `json:"created_by"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
}

// LoadTestRun represents an execution of a load test
type LoadTestRun struct {
	ID               uint       `gorm:"primaryKey" json:"id"`
	ConfigID         uint       `gorm:"index;not null" json:"config_id"`
	Config           *LoadTestConfig `gorm:"foreignKey:ConfigID" json:"config,omitempty"`
	Status           TestStatus `gorm:"type:varchar(20);not null" json:"status"`
	StartedAt        *time.Time `json:"started_at,omitempty"`
	CompletedAt      *time.Time `json:"completed_at,omitempty"`
	DurationMs       int64      `json:"duration_ms"`

	// Summary metrics
	TotalRequests    int64   `json:"total_requests"`
	SuccessfulReqs   int64   `json:"successful_requests"`
	FailedReqs       int64   `json:"failed_requests"`
	TimeoutReqs      int64   `json:"timeout_requests"`
	AvgLatencyMs     float64 `json:"avg_latency_ms"`
	P50LatencyMs     float64 `json:"p50_latency_ms"`
	P95LatencyMs     float64 `json:"p95_latency_ms"`
	P99LatencyMs     float64 `json:"p99_latency_ms"`
	MinLatencyMs     float64 `json:"min_latency_ms"`
	MaxLatencyMs     float64 `json:"max_latency_ms"`
	ActualRPS        float64 `json:"actual_rps"`
	TotalTokens      int64   `json:"total_tokens"`
	TotalCost        float64 `json:"total_cost"`

	// Resource metrics
	AvgCPUPercent    float64 `json:"avg_cpu_percent"`
	AvgMemoryMB      float64 `json:"avg_memory_mb"`
	PeakCPUPercent   float64 `json:"peak_cpu_percent"`
	PeakMemoryMB     float64 `json:"peak_memory_mb"`

	ErrorMessage     string  `gorm:"type:text" json:"error_message,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// LoadTestMetric represents real-time metrics during a load test
type LoadTestMetric struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	RunID           uint      `gorm:"index;not null" json:"run_id"`
	Timestamp       time.Time `gorm:"index;not null" json:"timestamp"`
	ElapsedSeconds  int       `json:"elapsed_seconds"`
	CurrentRPS      float64   `json:"current_rps"`
	ActiveRequests  int       `json:"active_requests"`
	CompletedReqs   int64     `json:"completed_requests"`
	FailedReqs      int64     `json:"failed_requests"`
	AvgLatencyMs    float64   `json:"avg_latency_ms"`
	P95LatencyMs    float64   `json:"p95_latency_ms"`
	ErrorRate       float64   `json:"error_rate"`
	CPUPercent      float64   `json:"cpu_percent"`
	MemoryMB        float64   `json:"memory_mb"`
	CacheHitRate    float64   `json:"cache_hit_rate"`
}

// RequestResult represents the result of a single request in a load test
type RequestResult struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	RunID       uint      `gorm:"index;not null" json:"run_id"`
	RequestNum  int64     `json:"request_num"`
	Timestamp   time.Time `json:"timestamp"`
	LatencyMs   float64   `json:"latency_ms"`
	StatusCode  int       `json:"status_code"`
	Success     bool      `json:"success"`
	Tokens      int       `json:"tokens"`
	Cost        float64   `json:"cost"`
	Error       string    `gorm:"type:text" json:"error,omitempty"`
	CacheHit    bool      `json:"cache_hit"`
	Model       string    `gorm:"type:varchar(100)" json:"model"`
	Provider    string    `gorm:"type:varchar(50)" json:"provider"`
}

// BenchmarkComparison stores comparison data between different test runs
type BenchmarkComparison struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	Name            string    `gorm:"type:varchar(255);not null" json:"name"`
	Description     string    `gorm:"type:text" json:"description"`
	BaselineRunID   uint      `json:"baseline_run_id"`
	ComparisonRunID uint      `json:"comparison_run_id"`
	LatencyDelta    float64   `json:"latency_delta_percent"`    // % change
	TPSDelta        float64   `json:"tps_delta_percent"`        // % change
	ErrorRateDelta  float64   `json:"error_rate_delta_percent"` // % change
	CostDelta       float64   `json:"cost_delta_percent"`       // % change
	CreatedAt       time.Time `json:"created_at"`
}

// TableName overrides
func (LoadTestConfig) TableName() string {
	return "load_test_configs"
}

func (LoadTestRun) TableName() string {
	return "load_test_runs"
}

func (LoadTestMetric) TableName() string {
	return "load_test_metrics"
}

func (RequestResult) TableName() string {
	return "request_results"
}

func (BenchmarkComparison) TableName() string {
	return "benchmark_comparisons"
}

// AutoMigrate runs migrations for all load test tables
func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&LoadTestConfig{},
		&LoadTestRun{},
		&LoadTestMetric{},
		&RequestResult{},
		&BenchmarkComparison{},
	)
}
