package api

import (
	"fmt"
	"net/http"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/worker"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/gin-gonic/gin"
)

// WorkerHandlers handles worker pool related HTTP endpoints
type WorkerHandlers struct {
	pool   *worker.WorkerPool
	logger *utils.Logger
}

// NewWorkerHandlers creates new worker handlers
func NewWorkerHandlers(pool *worker.WorkerPool, logger *utils.Logger) *WorkerHandlers {
	return &WorkerHandlers{
		pool:   pool,
		logger: logger,
	}
}

// SubmitJob submits a new job to the worker pool
// POST /api/v1/worker/jobs
func (h *WorkerHandlers) SubmitJob(c *gin.Context) {
	var req struct {
		Type     string                 `json:"type" binding:"required"`
		Priority string                 `json:"priority"`
		Payload  map[string]interface{} `json:"payload" binding:"required"`
		Timeout  int                    `json:"timeout_seconds"`
		Metadata map[string]string      `json:"metadata"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Error:   "Invalid request body",
			Message: err.Error(),
		})
		return
	}

	// Create job
	job := worker.NewJob(req.Type, req.Payload)

	// Set priority
	if req.Priority != "" {
		switch req.Priority {
		case "low":
			job.SetPriority(worker.PriorityLow)
		case "normal":
			job.SetPriority(worker.PriorityNormal)
		case "high":
			job.SetPriority(worker.PriorityHigh)
		case "critical":
			job.SetPriority(worker.PriorityCritical)
		default:
			c.JSON(http.StatusBadRequest, types.ErrorResponse{
				Error:   "Invalid priority",
				Message: "Priority must be: low, normal, high, or critical",
			})
			return
		}
	}

	// Set timeout
	if req.Timeout > 0 {
		job.Timeout = time.Duration(req.Timeout) * time.Second
	}

	// Set metadata
	if req.Metadata != nil {
		job.Metadata = req.Metadata
	}

	// Submit to pool
	if err := h.pool.Submit(job); err != nil {
		c.JSON(http.StatusServiceUnavailable, types.ErrorResponse{
			Error:   "Failed to submit job",
			Message: err.Error(),
		})
		return
	}

	h.logger.Info("Job submitted",
		"job_id", job.ID,
		"type", job.Type,
		"priority", job.Priority.String(),
	)

	c.JSON(http.StatusAccepted, types.SuccessResponse{
		Success: true,
		Message: "Job submitted successfully",
		Data: map[string]interface{}{
			"job_id":     job.ID,
			"type":       job.Type,
			"priority":   job.Priority.String(),
			"status":     job.GetStatus(),
			"created_at": job.CreatedAt,
		},
	})
}

// GetJobStatus retrieves the status of a specific job
// GET /api/v1/worker/jobs/:id
func (h *WorkerHandlers) GetJobStatus(c *gin.Context) {
	jobID := c.Param("id")

	if jobID == "" {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Error:   "Invalid request",
			Message: "job_id is required",
		})
		return
	}

	// Get job
	job, exists := h.pool.GetJob(jobID)
	if !exists {
		c.JSON(http.StatusNotFound, types.ErrorResponse{
			Error:   "Job not found",
			Message: "No job found with the given ID",
		})
		return
	}

	// Build response
	jobData := map[string]interface{}{
		"job_id":       job.ID,
		"type":         job.Type,
		"priority":     job.Priority.String(),
		"status":       job.GetStatus(),
		"created_at":   job.CreatedAt,
		"queued_at":    job.QueuedAt,
		"started_at":   job.StartedAt,
		"completed_at": job.CompletedAt,
		"worker_id":    job.WorkerID,
		"retries":      job.Retries,
		"max_retries":  job.MaxRetries,
	}

	// Add timing info
	if !job.StartedAt.IsZero() {
		jobData["duration_ms"] = job.Duration().Milliseconds()
	}
	if !job.QueuedAt.IsZero() && !job.StartedAt.IsZero() {
		jobData["wait_time_ms"] = job.WaitTime().Milliseconds()
	}

	// Add result if completed
	if job.GetStatus() == worker.JobStatusCompleted {
		jobData["result"] = job.Result
	}

	// Add error if failed
	if job.GetStatus() == worker.JobStatusFailed || job.GetStatus() == worker.JobStatusTimeout {
		jobData["error"] = job.Error
	}

	c.JSON(http.StatusOK, types.SuccessResponse{
		Success: true,
		Data:    jobData,
	})
}

// GetPoolMetrics returns worker pool metrics
// GET /api/v1/worker/metrics
func (h *WorkerHandlers) GetPoolMetrics(c *gin.Context) {
	metrics := h.pool.GetMetrics()

	c.JSON(http.StatusOK, types.SuccessResponse{
		Success: true,
		Data:    metrics,
	})
}

// GetWorkerStats returns statistics for all workers
// GET /api/v1/worker/stats
func (h *WorkerHandlers) GetWorkerStats(c *gin.Context) {
	stats := h.pool.GetWorkerStats()

	c.JSON(http.StatusOK, types.SuccessResponse{
		Success: true,
		Data: map[string]interface{}{
			"worker_count": len(stats),
			"workers":      stats,
		},
	})
}

// GetPoolHealth returns health status of the worker pool
// GET /api/v1/worker/health
func (h *WorkerHandlers) GetPoolHealth(c *gin.Context) {
	metrics := h.pool.GetMetrics()

	// Determine health status
	status := "healthy"
	utilizationPercent := float64(metrics.BusyWorkers) / float64(metrics.TotalWorkers) * 100

	if metrics.UnhealthyWorkers > 0 {
		status = "degraded"
	}
	if utilizationPercent > 90 {
		status = "warning"
	}
	if metrics.TotalWorkers == 0 {
		status = "critical"
	}

	healthData := map[string]interface{}{
		"status":              status,
		"total_workers":       metrics.TotalWorkers,
		"idle_workers":        metrics.IdleWorkers,
		"busy_workers":        metrics.BusyWorkers,
		"unhealthy_workers":   metrics.UnhealthyWorkers,
		"utilization_percent": utilizationPercent,
		"queued_jobs":         metrics.QueuedJobs,
		"queue_utilization":   metrics.QueueUtilization,
		"jobs_in_progress":    metrics.JobsInProgress,
	}

	httpStatus := http.StatusOK
	if status == "critical" {
		httpStatus = http.StatusServiceUnavailable
	}

	c.JSON(httpStatus, types.SuccessResponse{
		Success: status != "critical",
		Data:    healthData,
	})
}

// GetPoolConfig returns worker pool configuration
// GET /api/v1/worker/config
func (h *WorkerHandlers) GetPoolConfig(c *gin.Context) {
	// Note: In production, you'd expose this from the pool
	config := map[string]interface{}{
		"min_workers":          5,
		"max_workers":          50,
		"queue_size":           1000,
		"scale_up_threshold":   0.8,
		"scale_down_threshold": 0.2,
		"job_timeout_seconds":  300,
	}

	c.JSON(http.StatusOK, types.SuccessResponse{
		Success: true,
		Data:    config,
	})
}

// GetQueueStats returns statistics about job queues
// GET /api/v1/worker/queues
func (h *WorkerHandlers) GetQueueStats(c *gin.Context) {
	metrics := h.pool.GetMetrics()

	queueStats := map[string]interface{}{
		"total_queued":     metrics.QueuedJobs,
		"queue_capacity":   metrics.QueueCapacity,
		"utilization":      metrics.QueueUtilization,
		"by_priority":      metrics.JobsByPriority,
		"jobs_in_progress": metrics.JobsInProgress,
	}

	c.JSON(http.StatusOK, types.SuccessResponse{
		Success: true,
		Data:    queueStats,
	})
}

// GetPerformanceStats returns performance statistics
// GET /api/v1/worker/performance
func (h *WorkerHandlers) GetPerformanceStats(c *gin.Context) {
	metrics := h.pool.GetMetrics()

	performanceStats := map[string]interface{}{
		"total_jobs_processed":    metrics.TotalJobsProcessed,
		"total_jobs_failed":       metrics.TotalJobsFailed,
		"avg_job_duration_ms":     metrics.AvgJobDuration,
		"avg_queue_wait_time_ms":  metrics.AvgQueueWaitTime,
		"throughput_jobs_per_sec": metrics.Throughput,
		"success_rate":            calculateSuccessRate(metrics),
	}

	c.JSON(http.StatusOK, types.SuccessResponse{
		Success: true,
		Data:    performanceStats,
	})
}

// BatchSubmitJobs submits multiple jobs at once
// POST /api/v1/worker/jobs/batch
func (h *WorkerHandlers) BatchSubmitJobs(c *gin.Context) {
	var req struct {
		Jobs []struct {
			Type     string                 `json:"type" binding:"required"`
			Priority string                 `json:"priority"`
			Payload  map[string]interface{} `json:"payload" binding:"required"`
			Timeout  int                    `json:"timeout_seconds"`
			Metadata map[string]string      `json:"metadata"`
		} `json:"jobs" binding:"required,min=1"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Error:   "Invalid request body",
			Message: err.Error(),
		})
		return
	}

	results := make([]map[string]interface{}, 0, len(req.Jobs))
	successCount := 0
	failureCount := 0

	for _, jobReq := range req.Jobs {
		job := worker.NewJob(jobReq.Type, jobReq.Payload)

		// Set priority
		if jobReq.Priority != "" {
			switch jobReq.Priority {
			case "low":
				job.SetPriority(worker.PriorityLow)
			case "high":
				job.SetPriority(worker.PriorityHigh)
			case "critical":
				job.SetPriority(worker.PriorityCritical)
			}
		}

		// Set timeout
		if jobReq.Timeout > 0 {
			job.Timeout = time.Duration(jobReq.Timeout) * time.Second
		}

		// Set metadata
		if jobReq.Metadata != nil {
			job.Metadata = jobReq.Metadata
		}

		// Submit job
		err := h.pool.Submit(job)

		result := map[string]interface{}{
			"job_id": job.ID,
			"type":   job.Type,
		}

		if err != nil {
			result["success"] = false
			result["error"] = err.Error()
			failureCount++
		} else {
			result["success"] = true
			result["status"] = job.GetStatus()
			successCount++
		}

		results = append(results, result)
	}

	h.logger.Info("Batch job submission",
		"total_jobs", len(req.Jobs),
		"successful", successCount,
		"failed", failureCount,
	)

	c.JSON(http.StatusOK, types.SuccessResponse{
		Success: true,
		Data: map[string]interface{}{
			"total_jobs": len(req.Jobs),
			"successful": successCount,
			"failed":     failureCount,
			"results":    results,
		},
	})
}

// CancelJob cancels a pending or running job
// DELETE /api/v1/worker/jobs/:id
func (h *WorkerHandlers) CancelJob(c *gin.Context) {
	jobID := c.Param("id")

	if jobID == "" {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Error:   "Invalid request",
			Message: "job_id is required",
		})
		return
	}

	// Get job
	job, exists := h.pool.GetJob(jobID)
	if !exists {
		c.JSON(http.StatusNotFound, types.ErrorResponse{
			Error:   "Job not found",
			Message: "No job found with the given ID",
		})
		return
	}

	// Cancel job
	job.Cancel()
	job.SetStatus(worker.JobStatusCancelled)

	h.logger.Info("Job cancelled", "job_id", jobID)

	c.JSON(http.StatusOK, types.SuccessResponse{
		Success: true,
		Message: "Job cancelled successfully",
		Data: map[string]interface{}{
			"job_id":       jobID,
			"status":       job.GetStatus(),
			"cancelled_at": time.Now(),
		},
	})
}

// GetWorkerDetails returns detailed information about a specific worker
// GET /api/v1/worker/workers/:id
func (h *WorkerHandlers) GetWorkerDetails(c *gin.Context) {
	workerID := c.Param("id")

	if workerID == "" {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Error:   "Invalid request",
			Message: "worker_id is required",
		})
		return
	}

	// Get all worker stats
	stats := h.pool.GetWorkerStats()

	// Find specific worker
	var workerStats map[string]interface{}
	for _, stat := range stats {
		if stat["id"] == workerID {
			workerStats = stat
			break
		}
	}

	if workerStats == nil {
		c.JSON(http.StatusNotFound, types.ErrorResponse{
			Error:   "Worker not found",
			Message: "No worker found with the given ID",
		})
		return
	}

	c.JSON(http.StatusOK, types.SuccessResponse{
		Success: true,
		Data:    workerStats,
	})
}

// Helper function to calculate success rate
func calculateSuccessRate(metrics worker.WorkerPoolMetrics) string {
	total := metrics.TotalJobsProcessed + metrics.TotalJobsFailed
	if total == 0 {
		return "N/A"
	}

	rate := float64(metrics.TotalJobsProcessed) / float64(total) * 100
	return fmt.Sprintf("%.2f%%", rate)
}
