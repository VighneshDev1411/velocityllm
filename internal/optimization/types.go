package optimization

import (
	"time"
)

// PoolConfig holds connection pool configuration
type PoolConfig struct {
	MinConnections    int           // Minimum connections to maintain
	MaxConnections    int           // Maximum connections allowed
	MaxIdleTime       time.Duration // Max time connection can be idle
	MaxLifetime       time.Duration // Max lifetime of a connection
	HealthCheckPeriod time.Duration // How often to check connection health
	AcquireTimeout    time.Duration // Timeout for acquiring connection
}

// DefaultPoolConfig returns default pool configuration
func DefaultPoolConfig() PoolConfig {
	return PoolConfig{
		MinConnections:    5,
		MaxConnections:    20,
		MaxIdleTime:       5 * time.Minute,
		MaxLifetime:       30 * time.Minute,
		HealthCheckPeriod: 1 * time.Minute,
		AcquireTimeout:    5 * time.Second,
	}
}

// Connection represents a pooled connection
type Connection interface {
	// IsHealthy checks if connection is still healthy
	IsHealthy() bool

	// Close closes the connection
	Close() error

	// GetCreatedAt returns when connection was created
	GetCreatedAt() time.Time

	// GetLastUsed returns when connection was last used
	GetLastUsed() time.Time

	// MarkUsed updates last used time
	MarkUsed()
}

// ConnectionFactory creates new connections
type ConnectionFactory interface {
	// Create creates a new connection
	Create() (Connection, error)
}

// PoolStats holds pool statistics
type PoolStats struct {
	TotalConnections   int
	IdleConnections    int
	ActiveConnections  int
	WaitCount          int64
	WaitDuration       time.Duration
	ConnectionsCreated int64
	ConnectionsClosed  int64
	Errors             int64
}

// BatchConfig holds batching configuration
type BatchConfig struct {
	Enabled             bool
	MaxBatchSize        int           // Max requests per batch
	MaxWaitTime         time.Duration // Max time to wait for batch
	MaxTokens           int           // Max tokens per batch
	SimilarityThreshold float64       // Similarity threshold (0-1)
}

// DefaultBatchConfig returns default batch configuration
func DefaultBatchConfig() BatchConfig {
	return BatchConfig{
		Enabled:             true,
		MaxBatchSize:        10,
		MaxWaitTime:         100 * time.Millisecond,
		MaxTokens:           4000,
		SimilarityThreshold: 0.8,
	}
}

// BatchRequest represents a request that can be batched
type BatchRequest struct {
	ID         string
	Prompt     string
	Model      string
	Timestamp  time.Time
	Priority   int
	Tokens     int
	ResultChan chan BatchResult
}

// BatchResult represents the result of a batched request
type BatchResult struct {
	ID       string
	Response string
	Cost     float64
	Error    error
}

// Batch represents a group of requests processed together
type Batch struct {
	ID        string
	Requests  []*BatchRequest
	Model     string
	CreatedAt time.Time
}

// BatcherStats holds batching statistics
type BatcherStats struct {
	TotalRequests     int64
	TotalBatches      int64
	AvgBatchSize      float64
	TotalTokens       int64
	TotalCost         float64
	CostSavings       float64
	SavingsPercentage float64
	AvgWaitTime       time.Duration
}

// OptimizationConfig holds all optimization configurations
type OptimizationConfig struct {
	EnableConnectionPooling bool
	EnableRequestBatching   bool
	DBPoolConfig            PoolConfig
	RedisPoolConfig         PoolConfig
	HTTPPoolConfig          PoolConfig
	BatchConfig             BatchConfig
}

// DefaultOptimizationConfig returns default optimization configuration
func DefaultOptimizationConfig() OptimizationConfig {
	return OptimizationConfig{
		EnableConnectionPooling: true,
		EnableRequestBatching:   true,
		DBPoolConfig:            DefaultPoolConfig(),
		RedisPoolConfig:         DefaultPoolConfig(),
		HTTPPoolConfig:          DefaultPoolConfig(),
		BatchConfig:             DefaultBatchConfig(),
	}
}
