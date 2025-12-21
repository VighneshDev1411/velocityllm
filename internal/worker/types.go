package worker

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// JobPriority represents the priority level of a job
type JobPriority int

const (
	PriorityLow JobPriority = iota
	PriorityNormal
	PriorityHigh
	PriorityCritical
)

// String returns string representation of priority
func (p JobPriority) String() string {
	switch p {
	case PriorityLow:
		return "low"
	case PriorityNormal:
		return "normal"
	case PriorityHigh:
		return "high"
	case PriorityCritical:
		return "critical"
	default:
		return "unknown"
	}
}

// JobStatus represents the current status of a job
type JobStatus string

const (
	JobStatusPending   JobStatus = "pending"
	JobStatusQueued    JobStatus = "queued"
	JobStatusRunning   JobStatus = "running"
	JobStatusCompleted JobStatus = "completed"
	JobStatusFailed    JobStatus = "failed"
	JobStatusCancelled JobStatus = "cancelled"
	JobStatusTimeout   JobStatus = "timeout"
)

// WorkerStatus represents the status of a worker
type WorkerStatus string

const (
	WorkerStatusIdle       WorkerStatus = "idle"
	WorkerStatusBusy       WorkerStatus = "busy"
	WorkerStatusProcessing WorkerStatus = "processing"
	WorkerStatusStopping   WorkerStatus = "stopping"
	WorkerStatusStopped    WorkerStatus = "stopped"
	WorkerStatusUnhealthy  WorkerStatus = "unhealthy"
)

// Job represents a unit of work to be processed
type Job struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"`
	Priority JobPriority            `json:"priority"`
	Status   JobStatus              `json:"status"`
	Payload  map[string]interface{} `json:"payload"`
	Result   interface{}            `json:"result,omitempty"`
	Error    string                 `json:"error,omitempty"`

	// Timing
	CreatedAt   time.Time `json:"created_at"`
	SubmittedAt time.Time `json:"submitted_at,omitempty"`
	QueuedAt    time.Time `json:"queued_at,omitempty"`
	StartedAt   time.Time `json:"started_at,omitempty"`
	CompletedAt time.Time `json:"completed_at,omitempty"`

	// Configuration
	Timeout    time.Duration `json:"timeout"`
	Retries    int           `json:"retries"`
	MaxRetries int           `json:"max_retries"`

	// Context
	Ctx    context.Context    `json:"-"`
	Cancel context.CancelFunc `json:"-"`

	// Metadata
	WorkerID string            `json:"worker_id,omitempty"`
	Metadata map[string]string `json:"metadata,omitempty"`

	// Request data for processing
	Request interface{} `json:"request,omitempty"`

	mu sync.RWMutex `json:"-"`
}

// NewJob creates a new job
func NewJob(jobType string, payload map[string]interface{}) *Job {
	ctx, cancel := context.WithCancel(context.Background())

	return &Job{
		ID:         generateJobID(),
		Type:       jobType,
		Priority:   PriorityNormal,
		Status:     JobStatusPending,
		Payload:    payload,
		CreatedAt:  time.Now(),
		Timeout:    5 * time.Minute,
		MaxRetries: 3,
		Retries:    0,
		Ctx:        ctx,
		Cancel:     cancel,
		Metadata:   make(map[string]string),
	}
}

// SetPriority sets the job priority
func (j *Job) SetPriority(priority JobPriority) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.Priority = priority
}

// SetStatus updates the job status
func (j *Job) SetStatus(status JobStatus) {
	j.mu.Lock()
	defer j.mu.Unlock()

	j.Status = status

	switch status {
	case JobStatusQueued:
		j.QueuedAt = time.Now()
	case JobStatusRunning:
		j.StartedAt = time.Now()
	case JobStatusCompleted, JobStatusFailed, JobStatusCancelled, JobStatusTimeout:
		j.CompletedAt = time.Now()
	}
}

// GetStatus returns the current job status
func (j *Job) GetStatus() JobStatus {
	j.mu.RLock()
	defer j.mu.RUnlock()
	return j.Status
}

// SetResult sets the job result
func (j *Job) SetResult(result interface{}) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.Result = result
}

// SetError sets the job error
func (j *Job) SetError(err error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.Error = err.Error()
}

// Duration returns how long the job took to complete
func (j *Job) Duration() time.Duration {
	j.mu.RLock()
	defer j.mu.RUnlock()

	if j.StartedAt.IsZero() {
		return 0
	}

	if j.CompletedAt.IsZero() {
		return time.Since(j.StartedAt)
	}

	return j.CompletedAt.Sub(j.StartedAt)
}

// WaitTime returns how long the job waited in queue
func (j *Job) WaitTime() time.Duration {
	j.mu.RLock()
	defer j.mu.RUnlock()

	if j.QueuedAt.IsZero() || j.StartedAt.IsZero() {
		return 0
	}

	return j.StartedAt.Sub(j.QueuedAt)
}

// Worker represents a single worker in the pool
type Worker struct {
	ID     string       `json:"id"`
	Status WorkerStatus `json:"status"`

	// Statistics
	JobsProcessed int64     `json:"jobs_processed"`
	JobsFailed    int64     `json:"jobs_failed"`
	LastJobTime   time.Time `json:"last_job_time"`
	StartTime     time.Time `json:"start_time"`

	// Current job
	CurrentJob *Job `json:"current_job,omitempty"`

	// Health
	HealthScore   float64   `json:"health_score"`
	LastHeartbeat time.Time `json:"last_heartbeat"`

	// Channels
	jobChan  chan *Job
	JobsChan chan Job
	QuitChan chan bool
	stopChan chan struct{}
	doneChan chan struct{}

	// Additional fields for compatibility
	JobsHandled int64
	StartedAt   time.Time

	mu sync.RWMutex
}

// NewWorker creates a new worker
func NewWorker(id string) *Worker {
	return &Worker{
		ID:            id,
		Status:        WorkerStatusIdle,
		StartTime:     time.Now(),
		LastHeartbeat: time.Now(),
		HealthScore:   100.0,
		jobChan:       make(chan *Job, 10),
		stopChan:      make(chan struct{}),
		doneChan:      make(chan struct{}),
	}
}

// SetStatus updates worker status
func (w *Worker) SetStatus(status WorkerStatus) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.Status = status
}

// GetStatus returns worker status
func (w *Worker) GetStatus() WorkerStatus {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.Status
}

// IncrementJobsProcessed increments the jobs processed counter
func (w *Worker) IncrementJobsProcessed() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.JobsProcessed++
	w.LastJobTime = time.Now()
}

// IncrementJobsFailed increments the jobs failed counter
func (w *Worker) IncrementJobsFailed() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.JobsFailed++
}

// UpdateHealth updates the worker's health score
func (w *Worker) UpdateHealth(score float64) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.HealthScore = score
	w.LastHeartbeat = time.Now()
}

// IsHealthy returns whether the worker is healthy
func (w *Worker) IsHealthy() bool {
	w.mu.RLock()
	defer w.mu.RUnlock()

	// Check health score
	if w.HealthScore < 50.0 {
		return false
	}

	// Check last heartbeat (unhealthy if no heartbeat in 30 seconds)
	if time.Since(w.LastHeartbeat) > 30*time.Second {
		return false
	}

	return true
}

// GetMetrics returns worker metrics
func (w *Worker) GetMetrics() map[string]interface{} {
	w.mu.RLock()
	defer w.mu.RUnlock()

	uptime := time.Since(w.StartTime)

	metrics := map[string]interface{}{
		"id":             w.ID,
		"status":         w.Status,
		"jobs_processed": w.JobsProcessed,
		"jobs_failed":    w.JobsFailed,
		"health_score":   w.HealthScore,
		"uptime_seconds": uptime.Seconds(),
		"last_heartbeat": w.LastHeartbeat,
	}

	if w.CurrentJob != nil {
		metrics["current_job"] = map[string]interface{}{
			"id":       w.CurrentJob.ID,
			"type":     w.CurrentJob.Type,
			"status":   w.CurrentJob.Status,
			"duration": w.CurrentJob.Duration().Seconds(),
		}
	}

	return metrics
}

// WorkerPoolConfig holds configuration for the worker pool
type WorkerPoolConfig struct {
	// Pool sizing
	MinWorkers  int           `json:"min_workers"`
	MaxWorkers  int           `json:"max_workers"`
	IdleTimeout time.Duration `json:"idle_timeout"`

	// Queue settings
	QueueSize  int           `json:"queue_size"`
	JobTimeout time.Duration `json:"job_timeout"`

	// Scaling
	ScaleUpThreshold   float64       `json:"scale_up_threshold"`
	ScaleDownThreshold float64       `json:"scale_down_threshold"`
	ScaleInterval      time.Duration `json:"scale_interval"`

	// Health
	HealthCheckInterval time.Duration `json:"health_check_interval"`
	UnhealthyThreshold  int           `json:"unhealthy_threshold"`
}

// DefaultWorkerPoolConfig returns default configuration
func DefaultWorkerPoolConfig() *WorkerPoolConfig {
	return &WorkerPoolConfig{
		MinWorkers:          5,
		MaxWorkers:          50,
		IdleTimeout:         5 * time.Minute,
		QueueSize:           1000,
		JobTimeout:          5 * time.Minute,
		ScaleUpThreshold:    0.8, // Scale up at 80% capacity
		ScaleDownThreshold:  0.2, // Scale down at 20% capacity
		ScaleInterval:       30 * time.Second,
		HealthCheckInterval: 10 * time.Second,
		UnhealthyThreshold:  3, // Mark unhealthy after 3 failed checks
	}
}

// WorkerPoolMetrics holds metrics for the worker pool
type WorkerPoolMetrics struct {
	// Current state
	TotalWorkers     int64 `json:"total_workers"`
	IdleWorkers      int64 `json:"idle_workers"`
	BusyWorkers      int64 `json:"busy_workers"`
	UnhealthyWorkers int64 `json:"unhealthy_workers"`

	// Queue metrics
	QueuedJobs       int64   `json:"queued_jobs"`
	QueueCapacity    int64   `json:"queue_capacity"`
	QueueUtilization float64 `json:"queue_utilization"`

	// Job metrics
	TotalJobsProcessed int64 `json:"total_jobs_processed"`
	TotalJobsFailed    int64 `json:"total_jobs_failed"`
	JobsInProgress     int64 `json:"jobs_in_progress"`

	// Performance
	AvgJobDuration   float64 `json:"avg_job_duration_ms"`
	AvgQueueWaitTime float64 `json:"avg_queue_wait_time_ms"`
	Throughput       float64 `json:"throughput_jobs_per_sec"`

	// By priority
	JobsByPriority map[string]int64 `json:"jobs_by_priority"`

	// Timing
	LastUpdated time.Time `json:"last_updated"`

	mu sync.RWMutex `json:"-"`
}

// NewWorkerPoolMetrics creates new metrics
func NewWorkerPoolMetrics() *WorkerPoolMetrics {
	return &WorkerPoolMetrics{
		JobsByPriority: make(map[string]int64),
		LastUpdated:    time.Now(),
	}
}

// Update updates the metrics
func (m *WorkerPoolMetrics) Update(field string, value int64) {
	m.mu.Lock()
	defer m.mu.Unlock()

	switch field {
	case "total_workers":
		m.TotalWorkers = value
	case "idle_workers":
		m.IdleWorkers = value
	case "busy_workers":
		m.BusyWorkers = value
	case "queued_jobs":
		m.QueuedJobs = value
	case "jobs_processed":
		m.TotalJobsProcessed += value
	case "jobs_failed":
		m.TotalJobsFailed += value
	}

	m.LastUpdated = time.Now()
}

// GetSnapshot returns a snapshot of current metrics
func (m *WorkerPoolMetrics) GetSnapshot() WorkerPoolMetrics {
	m.mu.RLock()
	defer m.mu.RUnlock()

	snapshot := *m
	snapshot.JobsByPriority = make(map[string]int64)
	for k, v := range m.JobsByPriority {
		snapshot.JobsByPriority[k] = v
	}

	return snapshot
}

// Helper function to generate job IDs
func generateJobID() string {
	return fmt.Sprintf("job_%d_%d", time.Now().Unix(), time.Now().Nanosecond())
}

// JobResult represents the result of a job execution
type JobResult struct {
	Response interface{}
	Error    error
	Duration time.Duration
}
