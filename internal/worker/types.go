package worker

import (
	"context"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// Job represents a work unit to be processed
type Job struct {
	ID           string
	Request      types.CompletionRequest
	ResponseChan chan JobResult
	SubmittedAt  time.Time
	Priority     int // Higher = more important
}

// JobResult represents the result of processing a job
type JobResult struct {
	Response types.CompletionResponse
	Error    error
	Duration time.Duration
}

// WorkerStatus represents the current state of a worker
type WorkerStatus string

const (
	WorkerStatusIdle       WorkerStatus = "idle"
	WorkerStatusProcessing WorkerStatus = "processing"
	WorkerStatusStopped    WorkerStatus = "stopped"
)

// Worker represents a single worker in the pool
type Worker struct {
	ID          int
	Status      WorkerStatus
	JobsChan    chan Job
	QuitChan    chan bool
	CurrentJob  *Job
	JobsHandled int64
	StartedAt   time.Time
}

// WorkerPool represents a pool of workers
type WorkerPool struct {
	workers     []*Worker
	jobQueue    chan Job
	resultQueue chan JobResult
	workerCount int
	queueSize   int
	ctx         context.Context
	cancel      context.CancelFunc
	stats       *PoolStats
}

// PoolStats tracks pool statistics
type PoolStats struct {
	TotalJobsSubmitted  int64
	TotalJobsCompleted  int64
	TotalJobsFailed     int64
	TotalJobsInProgress int64
	TotalJobsQueued     int64
	ActiveWorkers       int64
	IdleWorkers         int64
	AvgProcessingTime   time.Duration
	AvgQueueWaitTime    time.Duration
	TotalProcessingTime time.Duration
	TotalQueueWaitTime  time.Duration
}

// PoolConfig holds worker pool configuration
type PoolConfig struct {
	WorkerCount int           // Number of workers
	QueueSize   int           // Size of job queue
	Timeout     time.Duration // Job processing timeout
}

// DefaultPoolConfig returns default configuration
func DefaultPoolConfig() PoolConfig {
	return PoolConfig{
		WorkerCount: 10,               // 10 concurrent workers
		QueueSize:   100,              // Queue up to 100 jobs
		Timeout:     30 * time.Second, // 30 second timeout
	}
}

// Priority levels
const (
	PriorityLow    = 1
	PriorityNormal = 5
	PriorityHigh   = 10
)
