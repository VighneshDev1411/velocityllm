package worker

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// WorkerPool manages a pool of workers for job processing
type WorkerPool struct {
	config  *WorkerPoolConfig
	logger  *utils.Logger
	metrics *WorkerPoolMetrics

	// Workers
	workers map[string]*Worker
	mu      sync.RWMutex

	// Job queues (priority-based)
	criticalQueue chan *Job
	highQueue     chan *Job
	normalQueue   chan *Job
	lowQueue      chan *Job

	// Job tracking
	activeJobs map[string]*Job
	jobsMu     sync.RWMutex

	// Lifecycle
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	// Scaling
	lastScaleTime time.Time
	scaleMu       sync.Mutex
}

// NewWorkerPool creates a new worker pool
func NewWorkerPool(config *WorkerPoolConfig, logger *utils.Logger) *WorkerPool {
	if config == nil {
		config = DefaultWorkerPoolConfig()
	}

	ctx, cancel := context.WithCancel(context.Background())

	pool := &WorkerPool{
		config:        config,
		logger:        logger,
		metrics:       NewWorkerPoolMetrics(),
		workers:       make(map[string]*Worker),
		activeJobs:    make(map[string]*Job),
		criticalQueue: make(chan *Job, config.QueueSize/4),
		highQueue:     make(chan *Job, config.QueueSize/4),
		normalQueue:   make(chan *Job, config.QueueSize/4),
		lowQueue:      make(chan *Job, config.QueueSize/4),
		ctx:           ctx,
		cancel:        cancel,
		lastScaleTime: time.Now(),
	}

	// Start initial workers
	for i := 0; i < config.MinWorkers; i++ {
		pool.addWorker()
	}

	// Start background routines
	pool.wg.Add(3)
	go pool.scaleRoutine()
	go pool.healthCheckRoutine()
	go pool.metricsRoutine()

	pool.logger.Info("Worker pool initialized",
		"min_workers", config.MinWorkers,
		"max_workers", config.MaxWorkers,
		"queue_size", config.QueueSize,
	)

	return pool
}

// Submit submits a job to the pool
func (p *WorkerPool) Submit(job *Job) error {
	if job == nil {
		return fmt.Errorf("job cannot be nil")
	}

	// Set job status
	job.SetStatus(JobStatusQueued)

	// Track job
	p.jobsMu.Lock()
	p.activeJobs[job.ID] = job
	p.jobsMu.Unlock()

	// Update metrics
	p.metrics.Update("queued_jobs", 1)
	p.metrics.mu.Lock()
	p.metrics.JobsByPriority[job.Priority.String()]++
	p.metrics.mu.Unlock()

	// Submit to appropriate queue based on priority
	select {
	case <-p.ctx.Done():
		return fmt.Errorf("worker pool is shutting down")
	default:
		switch job.Priority {
		case PriorityCritical:
			select {
			case p.criticalQueue <- job:
				p.logger.Debug("Job queued", "job_id", job.ID, "priority", "critical")
			default:
				return fmt.Errorf("critical queue is full")
			}
		case PriorityHigh:
			select {
			case p.highQueue <- job:
				p.logger.Debug("Job queued", "job_id", job.ID, "priority", "high")
			default:
				return fmt.Errorf("high priority queue is full")
			}
		case PriorityNormal:
			select {
			case p.normalQueue <- job:
				p.logger.Debug("Job queued", "job_id", job.ID, "priority", "normal")
			default:
				return fmt.Errorf("normal queue is full")
			}
		case PriorityLow:
			select {
			case p.lowQueue <- job:
				p.logger.Debug("Job queued", "job_id", job.ID, "priority", "low")
			default:
				return fmt.Errorf("low priority queue is full")
			}
		}
	}

	return nil
}

// addWorker adds a new worker to the pool
func (p *WorkerPool) addWorker() {
	p.mu.Lock()
	defer p.mu.Unlock()

	workerID := fmt.Sprintf("worker-%d", len(p.workers)+1)
	worker := NewWorker(workerID)

	p.workers[workerID] = worker
	p.metrics.Update("total_workers", int64(len(p.workers)))

	// Start worker
	p.wg.Add(1)
	go p.runWorker(worker)

	p.logger.Info("Worker added", "worker_id", workerID, "total_workers", len(p.workers))
}

// removeWorker removes a worker from the pool
func (p *WorkerPool) removeWorker(workerID string) {
	p.mu.Lock()
	defer p.mu.Unlock()

	worker, exists := p.workers[workerID]
	if !exists {
		return
	}

	// Signal worker to stop
	worker.SetStatus(WorkerStatusStopping)
	close(worker.stopChan)

	// Remove from pool
	delete(p.workers, workerID)
	p.metrics.Update("total_workers", int64(len(p.workers)))

	p.logger.Info("Worker removed", "worker_id", workerID, "total_workers", len(p.workers))
}

// runWorker runs a single worker
func (p *WorkerPool) runWorker(worker *Worker) {
	defer p.wg.Done()
	defer close(worker.doneChan)

	p.logger.Info("Worker started", "worker_id", worker.ID)

	for {
		// Update worker status
		worker.SetStatus(WorkerStatusIdle)
		p.updateIdleWorkers()

		// Get next job (priority-based)
		var job *Job
		select {
		case job = <-p.criticalQueue:
			// Critical priority
		case job = <-p.highQueue:
			// High priority
		case job = <-p.normalQueue:
			// Normal priority
		case job = <-p.lowQueue:
			// Low priority
		case <-worker.stopChan:
			// Worker stopped
			p.logger.Info("Worker stopped", "worker_id", worker.ID)
			worker.SetStatus(WorkerStatusStopped)
			return
		case <-p.ctx.Done():
			// Pool shutting down
			p.logger.Info("Worker shutting down", "worker_id", worker.ID)
			worker.SetStatus(WorkerStatusStopped)
			return
		}

		// Process job
		if job != nil {
			p.processJob(worker, job)
		}
	}
}

// processJob processes a single job
func (p *WorkerPool) processJob(worker *Worker, job *Job) {
	// Update worker status
	worker.SetStatus(WorkerStatusBusy)
	worker.mu.Lock()
	worker.CurrentJob = job
	worker.mu.Unlock()

	// Update job status
	job.SetStatus(JobStatusRunning)
	job.mu.Lock()
	job.WorkerID = worker.ID
	job.mu.Unlock()

	p.updateBusyWorkers()
	p.metrics.Update("jobs_in_progress", 1)

	p.logger.Info("Job started",
		"job_id", job.ID,
		"worker_id", worker.ID,
		"priority", job.Priority.String(),
	)

	// Create timeout context
	ctx := job.Ctx
	if job.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(job.Ctx, job.Timeout)
		defer cancel()
	}

	// Process job
	startTime := time.Now()
	err := p.executeJob(ctx, job)
	duration := time.Since(startTime)

	// Update job status
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			job.SetStatus(JobStatusTimeout)
			job.SetError(fmt.Errorf("job timeout after %v", job.Timeout))
		} else {
			job.SetStatus(JobStatusFailed)
			job.SetError(err)
		}
		worker.IncrementJobsFailed()
		p.metrics.Update("jobs_failed", 1)

		p.logger.Error("Job failed",
			"job_id", job.ID,
			"worker_id", worker.ID,
			"error", err,
			"duration_ms", duration.Milliseconds(),
		)
	} else {
		job.SetStatus(JobStatusCompleted)
		worker.IncrementJobsProcessed()
		p.metrics.Update("jobs_processed", 1)

		p.logger.Info("Job completed",
			"job_id", job.ID,
			"worker_id", worker.ID,
			"duration_ms", duration.Milliseconds(),
		)
	}

	// Clear current job
	worker.mu.Lock()
	worker.CurrentJob = nil
	worker.mu.Unlock()

	// Remove from active jobs
	p.jobsMu.Lock()
	delete(p.activeJobs, job.ID)
	p.jobsMu.Unlock()
}

// executeJob executes the actual job logic
func (p *WorkerPool) executeJob(ctx context.Context, job *Job) error {
	// This is a placeholder - in production, this would call your LLM inference
	// For now, simulate work
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(100 * time.Millisecond):
		// Simulate job execution
		job.SetResult(map[string]interface{}{
			"status": "success",
			"output": fmt.Sprintf("Processed job %s", job.ID),
		})
		return nil
	}
}

// scaleRoutine automatically scales the worker pool
func (p *WorkerPool) scaleRoutine() {
	defer p.wg.Done()

	ticker := time.NewTicker(p.config.ScaleInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			p.autoScale()
		case <-p.ctx.Done():
			return
		}
	}
}

// autoScale automatically scales workers based on queue utilization
func (p *WorkerPool) autoScale() {
	p.scaleMu.Lock()
	defer p.scaleMu.Unlock()

	// Calculate queue utilization
	totalQueued := len(p.criticalQueue) + len(p.highQueue) + len(p.normalQueue) + len(p.lowQueue)
	queueCapacity := cap(p.criticalQueue) + cap(p.highQueue) + cap(p.normalQueue) + cap(p.lowQueue)
	utilization := float64(totalQueued) / float64(queueCapacity)

	p.mu.RLock()
	currentWorkers := len(p.workers)
	p.mu.RUnlock()

	// Scale up if utilization is high
	if utilization > p.config.ScaleUpThreshold && currentWorkers < p.config.MaxWorkers {
		workersToAdd := min((p.config.MaxWorkers-currentWorkers)/2, 5) // Add max 5 at a time
		if workersToAdd < 1 {
			workersToAdd = 1
		}

		for i := 0; i < workersToAdd; i++ {
			p.addWorker()
		}

		p.logger.Info("Scaled up worker pool",
			"added", workersToAdd,
			"total_workers", currentWorkers+workersToAdd,
			"utilization", fmt.Sprintf("%.2f%%", utilization*100),
		)
	}

	// Scale down if utilization is low
	if utilization < p.config.ScaleDownThreshold && currentWorkers > p.config.MinWorkers {
		workersToRemove := min((currentWorkers-p.config.MinWorkers)/2, 5) // Remove max 5 at a time
		if workersToRemove < 1 {
			workersToRemove = 1
		}

		// Get idle workers
		p.mu.RLock()
		idleWorkers := []string{}
		for id, worker := range p.workers {
			if worker.GetStatus() == WorkerStatusIdle {
				idleWorkers = append(idleWorkers, id)
				if len(idleWorkers) >= workersToRemove {
					break
				}
			}
		}
		p.mu.RUnlock()

		// Remove idle workers
		for _, workerID := range idleWorkers {
			p.removeWorker(workerID)
		}

		if len(idleWorkers) > 0 {
			p.logger.Info("Scaled down worker pool",
				"removed", len(idleWorkers),
				"total_workers", currentWorkers-len(idleWorkers),
				"utilization", fmt.Sprintf("%.2f%%", utilization*100),
			)
		}
	}
}

// healthCheckRoutine performs periodic health checks on workers
func (p *WorkerPool) healthCheckRoutine() {
	defer p.wg.Done()

	ticker := time.NewTicker(p.config.HealthCheckInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			p.performHealthChecks()
		case <-p.ctx.Done():
			return
		}
	}
}

// performHealthChecks checks health of all workers
func (p *WorkerPool) performHealthChecks() {
	p.mu.RLock()
	workers := make([]*Worker, 0, len(p.workers))
	for _, worker := range p.workers {
		workers = append(workers, worker)
	}
	p.mu.RUnlock()

	unhealthyCount := 0
	for _, worker := range workers {
		if !worker.IsHealthy() {
			worker.SetStatus(WorkerStatusUnhealthy)
			unhealthyCount++

			p.logger.Warn("Unhealthy worker detected",
				"worker_id", worker.ID,
				"health_score", worker.HealthScore,
				"last_heartbeat", worker.LastHeartbeat,
			)
		}
	}

	p.metrics.mu.Lock()
	p.metrics.UnhealthyWorkers = int64(unhealthyCount)
	p.metrics.mu.Unlock()
}

// metricsRoutine updates pool metrics periodically
func (p *WorkerPool) metricsRoutine() {
	defer p.wg.Done()

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			p.updateMetrics()
		case <-p.ctx.Done():
			return
		}
	}
}

// updateMetrics updates pool metrics
func (p *WorkerPool) updateMetrics() {
	p.mu.RLock()
	totalWorkers := len(p.workers)
	idleCount := 0
	busyCount := 0

	for _, worker := range p.workers {
		status := worker.GetStatus()
		if status == WorkerStatusIdle {
			idleCount++
		} else if status == WorkerStatusBusy {
			busyCount++
		}
	}
	p.mu.RUnlock()

	queuedJobs := len(p.criticalQueue) + len(p.highQueue) + len(p.normalQueue) + len(p.lowQueue)
	queueCapacity := cap(p.criticalQueue) + cap(p.highQueue) + cap(p.normalQueue) + cap(p.lowQueue)

	p.metrics.mu.Lock()
	p.metrics.TotalWorkers = int64(totalWorkers)
	p.metrics.IdleWorkers = int64(idleCount)
	p.metrics.BusyWorkers = int64(busyCount)
	p.metrics.QueuedJobs = int64(queuedJobs)
	p.metrics.QueueCapacity = int64(queueCapacity)
	if queueCapacity > 0 {
		p.metrics.QueueUtilization = float64(queuedJobs) / float64(queueCapacity) * 100
	}
	p.metrics.LastUpdated = time.Now()
	p.metrics.mu.Unlock()
}

// updateIdleWorkers updates idle worker count
func (p *WorkerPool) updateIdleWorkers() {
	p.mu.RLock()
	defer p.mu.RUnlock()

	idleCount := 0
	for _, worker := range p.workers {
		if worker.GetStatus() == WorkerStatusIdle {
			idleCount++
		}
	}

	p.metrics.mu.Lock()
	p.metrics.IdleWorkers = int64(idleCount)
	p.metrics.mu.Unlock()
}

// updateBusyWorkers updates busy worker count
func (p *WorkerPool) updateBusyWorkers() {
	p.mu.RLock()
	defer p.mu.RUnlock()

	busyCount := 0
	for _, worker := range p.workers {
		if worker.GetStatus() == WorkerStatusBusy {
			busyCount++
		}
	}

	p.metrics.mu.Lock()
	p.metrics.BusyWorkers = int64(busyCount)
	p.metrics.mu.Unlock()
}

// GetMetrics returns current pool metrics
func (p *WorkerPool) GetMetrics() WorkerPoolMetrics {
	return p.metrics.GetSnapshot()
}

// GetWorkerStats returns statistics for all workers
func (p *WorkerPool) GetWorkerStats() []map[string]interface{} {
	p.mu.RLock()
	defer p.mu.RUnlock()

	stats := make([]map[string]interface{}, 0, len(p.workers))
	for _, worker := range p.workers {
		stats = append(stats, worker.GetMetrics())
	}

	return stats
}

// GetJob returns a job by ID
func (p *WorkerPool) GetJob(jobID string) (*Job, bool) {
	p.jobsMu.RLock()
	defer p.jobsMu.RUnlock()

	job, exists := p.activeJobs[jobID]
	return job, exists
}

// Shutdown gracefully shuts down the worker pool
func (p *WorkerPool) Shutdown(ctx context.Context) error {
	p.logger.Info("Shutting down worker pool", "workers", len(p.workers))

	// Stop accepting new jobs
	p.cancel()

	// Wait for all workers to finish with timeout
	done := make(chan struct{})
	go func() {
		p.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		p.logger.Info("Worker pool shutdown complete")
		return nil
	case <-ctx.Done():
		p.logger.Warn("Worker pool shutdown timeout")
		return ctx.Err()
	}
}

// Helper function
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
