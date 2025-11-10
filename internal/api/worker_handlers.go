package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/worker"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// GetWorkerPoolStatsHandler returns worker pool statistics
func GetWorkerPoolStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	pool := worker.GetGlobalPool()
	stats := pool.GetStats()

	response := map[string]interface{}{
		"total_jobs_submitted":   stats.TotalJobsSubmitted,
		"total_jobs_completed":   stats.TotalJobsCompleted,
		"total_jobs_failed":      stats.TotalJobsFailed,
		"total_jobs_in_progress": stats.TotalJobsInProgress,
		"total_jobs_queued":      stats.TotalJobsQueued,
		"active_workers":         stats.ActiveWorkers,
		"idle_workers":           stats.IdleWorkers,
		"avg_processing_time":    stats.AvgProcessingTime.String(),
		"total_processing_time":  stats.TotalProcessingTime.String(),
	}

	types.WriteSuccess(w, "Worker pool statistics retrieved", response)
}

// GetWorkerPoolHealthHandler returns worker pool health status
func GetWorkerPoolHealthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	pool := worker.GetGlobalPool()
	health := pool.GetHealthStatus()

	types.WriteSuccess(w, "Worker pool health retrieved", health)
}

// GetWorkersHandler returns individual worker statistics
func GetWorkersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	pool := worker.GetGlobalPool()
	workers := pool.GetWorkerStats()

	types.WriteSuccess(w, "Worker statistics retrieved", workers)
}

// GetQueueInfoHandler returns queue information
func GetQueueInfoHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	pool := worker.GetGlobalPool()

	response := map[string]interface{}{
		"current_size":  pool.GetQueueSize(),
		"capacity":      pool.GetQueueCapacity(),
		"is_full":       pool.IsQueueFull(),
		"usage_percent": calculateQueueUsage(pool),
	}

	types.WriteSuccess(w, "Queue information retrieved", response)
}

// ResizeWorkerPoolHandler dynamically resizes the worker pool
func ResizeWorkerPoolHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodPut {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		WorkerCount int `json:"worker_count"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.WorkerCount < 1 {
		types.WriteError(w, http.StatusBadRequest, "Worker count must be at least 1")
		return
	}

	if req.WorkerCount > 100 {
		types.WriteError(w, http.StatusBadRequest, "Worker count cannot exceed 100")
		return
	}

	pool := worker.GetGlobalPool()
	if err := pool.Resize(req.WorkerCount); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to resize pool: "+err.Error())
		return
	}

	response := map[string]interface{}{
		"worker_count": req.WorkerCount,
		"message":      "Worker pool resized successfully",
	}

	types.WriteSuccess(w, "Pool resized", response)
}

// GetWorkerPoolMetricsHandler returns detailed metrics
func GetWorkerPoolMetricsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	pool := worker.GetGlobalPool()
	stats := pool.GetStats()
	health := pool.GetHealthStatus()

	// Calculate additional metrics
	successRate := float64(0)
	if stats.TotalJobsCompleted+stats.TotalJobsFailed > 0 {
		successRate = float64(stats.TotalJobsCompleted) / float64(stats.TotalJobsCompleted+stats.TotalJobsFailed) * 100
	}

	throughput := float64(0)
	if stats.TotalProcessingTime > 0 {
		throughput = float64(stats.TotalJobsCompleted) / stats.TotalProcessingTime.Seconds()
	}

	response := map[string]interface{}{
		"statistics": map[string]interface{}{
			"total_submitted": stats.TotalJobsSubmitted,
			"total_completed": stats.TotalJobsCompleted,
			"total_failed":    stats.TotalJobsFailed,
			"in_progress":     stats.TotalJobsInProgress,
			"queued":          stats.TotalJobsQueued,
		},
		"workers": map[string]interface{}{
			"total":  pool.GetWorkerCount(),
			"active": stats.ActiveWorkers,
			"idle":   stats.IdleWorkers,
		},
		"queue": map[string]interface{}{
			"size":     pool.GetQueueSize(),
			"capacity": pool.GetQueueCapacity(),
			"usage":    health["queue_usage"],
		},
		"performance": map[string]interface{}{
			"avg_processing_time":   stats.AvgProcessingTime.String(),
			"total_processing_time": stats.TotalProcessingTime.String(),
			"success_rate":          successRate,
			"throughput_per_sec":    throughput,
		},
		"health": map[string]interface{}{
			"status":             health["status"],
			"worker_utilization": health["worker_utilization"],
			"queue_usage":        health["queue_usage"],
		},
	}

	types.WriteSuccess(w, "Metrics retrieved", response)
}

// Helper function
func calculateQueueUsage(pool *worker.WorkerPool) float64 {
	if pool.GetQueueCapacity() == 0 {
		return 0
	}
	return float64(pool.GetQueueSize()) / float64(pool.GetQueueCapacity()) * 100
}
