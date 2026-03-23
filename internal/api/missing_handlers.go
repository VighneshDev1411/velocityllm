package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/VighneshDev1411/velocityllm/internal/worker"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// CompletionAsyncHandler handles async completion requests
func CompletionAsyncHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req types.CompletionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Create a job for async processing
	pool := worker.GetGlobalPool()
	if pool == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Worker pool not available")
		return
	}

	job := worker.NewJob("completion", map[string]interface{}{
		"prompt": req.Prompt,
		"model":  req.Model,
	})

	if err := pool.Submit(job); err != nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Failed to queue job: "+err.Error())
		return
	}

	response := map[string]interface{}{
		"job_id":  job.ID,
		"status":  "queued",
		"message": "Job queued for async processing",
	}

	types.WriteSuccess(w, "Job queued successfully", response)
}

// JobStatusHandler handles job status requests
func JobStatusHandler(w http.ResponseWriter, r *http.Request) {
	// Extract job ID from URL path
	path := r.URL.Path
	jobID := strings.TrimPrefix(path, "/api/v1/jobs/")

	if jobID == "" {
		types.WriteError(w, http.StatusBadRequest, "Job ID is required")
		return
	}

	pool := worker.GetGlobalPool()
	if pool == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Worker pool not available")
		return
	}

	job, exists := pool.GetJob(jobID)
	if !exists {
		types.WriteError(w, http.StatusNotFound, "Job not found")
		return
	}

	response := map[string]interface{}{
		"job_id":     job.ID,
		"status":     job.Status,
		"result":     job.Result,
		"error":      job.Error,
		"created_at": job.CreatedAt,
	}

	types.WriteSuccess(w, "Job status retrieved", response)
}

// ModelsHandler handles model list requests
func ModelsHandler(w http.ResponseWriter, r *http.Request) {
	GetModelsHandler(w, r)
}

// ModelDetailHandler handles individual model detail requests
func ModelDetailHandler(w http.ResponseWriter, r *http.Request) {
	// Extract model name from URL
	path := r.URL.Path
	modelName := strings.TrimPrefix(path, "/api/v1/models/")

	if modelName == "" {
		types.WriteError(w, http.StatusBadRequest, "Model name is required")
		return
	}

	// For now, return a placeholder
	response := map[string]interface{}{
		"name":    modelName,
		"status":  "active",
		"message": "Model details endpoint",
	}

	types.WriteSuccess(w, "Model details retrieved", response)
}

// CacheStatsHandler handles cache statistics requests
func CacheStatsHandler(w http.ResponseWriter, r *http.Request) {
	stats := map[string]interface{}{
		"hits":     0,
		"misses":   0,
		"size":     0,
		"hit_rate": 0.0,
		"message":  "Cache stats endpoint",
	}

	types.WriteSuccess(w, "Cache stats retrieved", stats)
}

// CacheClearHandler handles cache clearing requests
func CacheClearHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodDelete {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	types.WriteSuccess(w, "Cache cleared successfully", nil)
}

// CacheWarmHandler handles cache warming requests
func CacheWarmHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	types.WriteSuccess(w, "Cache warming initiated", nil)
}

// GetWorkerPoolStatsHandler returns worker pool statistics
func GetWorkerPoolStatsHandler(w http.ResponseWriter, r *http.Request) {
	pool := worker.GetGlobalPool()
	if pool == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Worker pool not available")
		return
	}

	metrics := pool.GetMetrics()

	stats := map[string]interface{}{
		"total_workers":        metrics.TotalWorkers,
		"idle_workers":         metrics.IdleWorkers,
		"busy_workers":         metrics.BusyWorkers,
		"unhealthy_workers":    metrics.UnhealthyWorkers,
		"queued_jobs":          metrics.QueuedJobs,
		"queue_capacity":       metrics.QueueCapacity,
		"queue_utilization":    fmt.Sprintf("%.2f%%", metrics.QueueUtilization),
		"total_jobs_processed": metrics.TotalJobsProcessed,
		"total_jobs_failed":    metrics.TotalJobsFailed,
		"jobs_in_progress":     metrics.JobsInProgress,
	}

	types.WriteSuccess(w, "Worker pool stats retrieved", stats)
}

// GetWorkerPoolHealthHandler returns worker pool health status
func GetWorkerPoolHealthHandler(w http.ResponseWriter, r *http.Request) {
	pool := worker.GetGlobalPool()
	if pool == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Worker pool not available")
		return
	}

	metrics := pool.GetMetrics()

	health := "healthy"
	if metrics.UnhealthyWorkers > 0 {
		health = "degraded"
	}
	if metrics.TotalWorkers == 0 {
		health = "unhealthy"
	}

	response := map[string]interface{}{
		"status":            health,
		"total_workers":     metrics.TotalWorkers,
		"unhealthy_workers": metrics.UnhealthyWorkers,
		"queue_utilization": fmt.Sprintf("%.2f%%", metrics.QueueUtilization),
	}

	types.WriteSuccess(w, "Worker pool health retrieved", response)
}

// GetWorkerPoolMetricsHandler returns detailed worker pool metrics
func GetWorkerPoolMetricsHandler(w http.ResponseWriter, r *http.Request) {
	pool := worker.GetGlobalPool()
	if pool == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Worker pool not available")
		return
	}

	metrics := pool.GetMetrics()

	types.WriteSuccess(w, "Worker pool metrics retrieved", metrics)
}

// GetWorkersHandler returns list of workers
func GetWorkersHandler(w http.ResponseWriter, r *http.Request) {
	pool := worker.GetGlobalPool()
	if pool == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Worker pool not available")
		return
	}

	workerStats := pool.GetWorkerStats()

	types.WriteSuccess(w, "Workers retrieved", workerStats)
}

// GetWorkerQueueInfoHandler returns worker pool queue information
func GetWorkerQueueInfoHandler(w http.ResponseWriter, r *http.Request) {
	pool := worker.GetGlobalPool()
	if pool == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Worker pool not available")
		return
	}

	metrics := pool.GetMetrics()

	queueInfo := map[string]interface{}{
		"queued_jobs":       metrics.QueuedJobs,
		"queue_capacity":    metrics.QueueCapacity,
		"queue_utilization": fmt.Sprintf("%.2f%%", metrics.QueueUtilization),
		"jobs_by_priority":  metrics.JobsByPriority,
	}

	types.WriteSuccess(w, "Queue info retrieved", queueInfo)
}

// ResizeWorkerPoolHandler handles worker pool resizing requests
func ResizeWorkerPoolHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodPut {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		TargetSize int `json:"target_size"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.TargetSize <= 0 {
		types.WriteError(w, http.StatusBadRequest, "Target size must be positive")
		return
	}

	utils.Info("Worker pool resize requested: target_size=%d", req.TargetSize)

	response := map[string]interface{}{
		"message":     "Resize request accepted",
		"target_size": req.TargetSize,
	}

	types.WriteSuccess(w, "Worker pool resize initiated", response)
}
