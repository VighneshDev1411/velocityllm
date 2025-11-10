package worker

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/google/uuid"
)

// NewWorkerPool creates a new worker pool
func NewWorkerPool(config PoolConfig) *WorkerPool {
	ctx, cancel := context.WithCancel(context.Background())

	pool := &WorkerPool{
		workers:     make([]*Worker, 0, config.WorkerCount),
		jobQueue:    make(chan Job, config.QueueSize),
		resultQueue: make(chan JobResult, config.QueueSize),
		workerCount: config.WorkerCount,
		queueSize:   config.QueueSize,
		ctx:         ctx,
		cancel:      cancel,
		stats: &PoolStats{
			TotalJobsSubmitted:  0,
			TotalJobsCompleted:  0,
			TotalJobsFailed:     0,
			TotalJobsInProgress: 0,
			TotalJobsQueued:     0,
			ActiveWorkers:       0,
			IdleWorkers:         0,
		},
	}

	utils.Info("Worker pool created: %d workers, queue size %d", config.WorkerCount, config.QueueSize)
	return pool
}

// Start initializes and starts all workers
func (wp *WorkerPool) Start() error {
	utils.Info("Starting worker pool with %d workers", wp.workerCount)

	// Create and start workers
	for i := 1; i <= wp.workerCount; i++ {
		worker := NewWorker(i, wp.jobQueue)
		wp.workers = append(wp.workers, worker)
		worker.Start(wp.ctx, wp.resultQueue)
	}

	utils.Info("Worker pool started successfully")
	return nil
}

// Submit submits a job to the worker pool
func (wp *WorkerPool) Submit(request types.CompletionRequest) (types.CompletionResponse, error) {
	// Create job
	job := Job{
		ID:           uuid.New().String(),
		Request:      request,
		ResponseChan: make(chan JobResult, 1),
		SubmittedAt:  time.Now(),
		Priority:     PriorityNormal,
	}

	// Update stats
	wp.updateStats(func(stats *PoolStats) {
		stats.TotalJobsSubmitted++
		stats.TotalJobsQueued++
	})

	// Try to submit to queue
	select {
	case wp.jobQueue <- job:
		// Job submitted successfully
		utils.Debug("Job %s submitted to queue", job.ID)

	case <-time.After(5 * time.Second):
		// Queue is full, timeout
		wp.updateStats(func(stats *PoolStats) {
			stats.TotalJobsQueued--
			stats.TotalJobsFailed++
		})
		return types.CompletionResponse{}, fmt.Errorf("job queue is full, try again later")
	}

	// Wait for result
	select {
	case result := <-wp.resultQueue:
		// Job completed
		wp.updateStats(func(stats *PoolStats) {
			stats.TotalJobsQueued--
			stats.TotalJobsCompleted++

			// Update average processing time
			if stats.TotalJobsCompleted == 1 {
				stats.AvgProcessingTime = result.Duration
			} else {
				totalTime := stats.AvgProcessingTime * time.Duration(stats.TotalJobsCompleted-1)
				stats.AvgProcessingTime = (totalTime + result.Duration) / time.Duration(stats.TotalJobsCompleted)
			}

			stats.TotalProcessingTime += result.Duration
		})

		if result.Error != nil {
			wp.updateStats(func(stats *PoolStats) {
				stats.TotalJobsFailed++
			})
			return types.CompletionResponse{}, result.Error
		}

		return result.Response, nil

	case <-time.After(60 * time.Second):
		// Job processing timeout
		wp.updateStats(func(stats *PoolStats) {
			stats.TotalJobsQueued--
			stats.TotalJobsFailed++
		})
		return types.CompletionResponse{}, fmt.Errorf("job processing timeout")
	}
}

// SubmitAsync submits a job asynchronously and returns immediately
func (wp *WorkerPool) SubmitAsync(request types.CompletionRequest) (string, chan JobResult, error) {
	// Create job
	job := Job{
		ID:           uuid.New().String(),
		Request:      request,
		ResponseChan: make(chan JobResult, 1),
		SubmittedAt:  time.Now(),
		Priority:     PriorityNormal,
	}

	// Update stats
	wp.updateStats(func(stats *PoolStats) {
		stats.TotalJobsSubmitted++
		stats.TotalJobsQueued++
	})

	// Try to submit to queue
	select {
	case wp.jobQueue <- job:
		utils.Debug("Job %s submitted asynchronously", job.ID)

		// Start a goroutine to handle the result
		go func() {
			result := <-wp.resultQueue
			job.ResponseChan <- result

			// Update stats
			wp.updateStats(func(stats *PoolStats) {
				stats.TotalJobsQueued--
				if result.Error != nil {
					stats.TotalJobsFailed++
				} else {
					stats.TotalJobsCompleted++
				}
			})
		}()

		return job.ID, job.ResponseChan, nil

	case <-time.After(5 * time.Second):
		wp.updateStats(func(stats *PoolStats) {
			stats.TotalJobsQueued--
			stats.TotalJobsFailed++
		})
		return "", nil, fmt.Errorf("job queue is full")
	}
}

// Stop gracefully shuts down the worker pool
func (wp *WorkerPool) Stop() {
	utils.Info("Stopping worker pool...")

	// Cancel context to signal all workers
	wp.cancel()

	// Stop all workers
	for _, worker := range wp.workers {
		worker.Stop()
	}

	// Wait a bit for workers to finish current jobs
	time.Sleep(2 * time.Second)

	// Close channels
	close(wp.jobQueue)
	close(wp.resultQueue)

	utils.Info("Worker pool stopped")
}

// GetStats returns pool statistics
func (wp *WorkerPool) GetStats() *PoolStats {
	// Update worker stats
	activeWorkers := int64(0)
	idleWorkers := int64(0)

	for _, worker := range wp.workers {
		if worker.Status == WorkerStatusProcessing {
			activeWorkers++
		} else if worker.Status == WorkerStatusIdle {
			idleWorkers++
		}
	}

	wp.updateStats(func(stats *PoolStats) {
		stats.ActiveWorkers = activeWorkers
		stats.IdleWorkers = idleWorkers
	})

	// Return a copy to avoid race conditions
	statsCopy := *wp.stats
	return &statsCopy
}

// GetWorkerStats returns statistics for all workers
func (wp *WorkerPool) GetWorkerStats() []map[string]interface{} {
	stats := make([]map[string]interface{}, 0, len(wp.workers))
	for _, worker := range wp.workers {
		stats = append(stats, worker.GetStats())
	}
	return stats
}

// GetQueueSize returns current queue size
func (wp *WorkerPool) GetQueueSize() int {
	return len(wp.jobQueue)
}

// GetQueueCapacity returns maximum queue capacity
func (wp *WorkerPool) GetQueueCapacity() int {
	return wp.queueSize
}

// IsQueueFull returns true if queue is full
func (wp *WorkerPool) IsQueueFull() bool {
	return len(wp.jobQueue) >= wp.queueSize
}

// GetWorkerCount returns number of workers
func (wp *WorkerPool) GetWorkerCount() int {
	return wp.workerCount
}

// updateStats safely updates pool statistics
func (wp *WorkerPool) updateStats(fn func(*PoolStats)) {
	// Simple atomic update (in production, use sync.Mutex)
	fn(wp.stats)
}

// GetHealthStatus returns pool health status
func (wp *WorkerPool) GetHealthStatus() map[string]interface{} {
	stats := wp.GetStats()
	queueUsage := float64(len(wp.jobQueue)) / float64(wp.queueSize) * 100
	workerUtilization := float64(stats.ActiveWorkers) / float64(wp.workerCount) * 100

	status := "healthy"
	if queueUsage > 80 {
		status = "degraded"
	}
	if queueUsage > 95 {
		status = "critical"
	}

	return map[string]interface{}{
		"status":              status,
		"worker_count":        wp.workerCount,
		"active_workers":      stats.ActiveWorkers,
		"idle_workers":        stats.IdleWorkers,
		"worker_utilization":  fmt.Sprintf("%.2f%%", workerUtilization),
		"queue_size":          len(wp.jobQueue),
		"queue_capacity":      wp.queueSize,
		"queue_usage":         fmt.Sprintf("%.2f%%", queueUsage),
		"jobs_submitted":      stats.TotalJobsSubmitted,
		"jobs_completed":      stats.TotalJobsCompleted,
		"jobs_failed":         stats.TotalJobsFailed,
		"jobs_in_progress":    stats.TotalJobsInProgress,
		"avg_processing_time": stats.AvgProcessingTime.String(),
		"success_rate":        wp.calculateSuccessRate(stats),
	}
}

// calculateSuccessRate calculates the job success rate
func (wp *WorkerPool) calculateSuccessRate(stats *PoolStats) string {
	total := stats.TotalJobsCompleted + stats.TotalJobsFailed
	if total == 0 {
		return "N/A"
	}
	rate := float64(stats.TotalJobsCompleted) / float64(total) * 100
	return fmt.Sprintf("%.2f%%", rate)
}

// Resize dynamically changes the number of workers (advanced feature)
func (wp *WorkerPool) Resize(newWorkerCount int) error {
	if newWorkerCount < 1 {
		return fmt.Errorf("worker count must be at least 1")
	}

	currentCount := len(wp.workers)

	if newWorkerCount > currentCount {
		// Add more workers
		for i := currentCount + 1; i <= newWorkerCount; i++ {
			worker := NewWorker(i, wp.jobQueue)
			wp.workers = append(wp.workers, worker)
			worker.Start(wp.ctx, wp.resultQueue)
			utils.Info("Added worker %d (pool now has %d workers)", i, len(wp.workers))
		}
	} else if newWorkerCount < currentCount {
		// Remove workers
		workersToRemove := currentCount - newWorkerCount
		for i := 0; i < workersToRemove; i++ {
			if len(wp.workers) > 0 {
				worker := wp.workers[len(wp.workers)-1]
				worker.Stop()
				wp.workers = wp.workers[:len(wp.workers)-1]
				utils.Info("Removed worker %d (pool now has %d workers)", worker.ID, len(wp.workers))
			}
		}
	}

	wp.workerCount = len(wp.workers)
	utils.Info("Worker pool resized to %d workers", wp.workerCount)
	return nil
}

// Global worker pool instance
var globalPool *WorkerPool
var poolOnce sync.Once

// InitGlobalPool initializes the global worker pool
func InitGlobalPool(config PoolConfig) error {
	var err error
	poolOnce.Do(func() {
		globalPool = NewWorkerPool(config)
		err = globalPool.Start()
	})
	return err
}

// GetGlobalPool returns the global worker pool
func GetGlobalPool() *WorkerPool {
	if globalPool == nil {
		// Initialize with default config if not already initialized
		_ = InitGlobalPool(DefaultPoolConfig())
	}
	return globalPool
}

// ShutdownGlobalPool stops the global worker pool
func ShutdownGlobalPool() {
	if globalPool != nil {
		globalPool.Stop()
	}
}
