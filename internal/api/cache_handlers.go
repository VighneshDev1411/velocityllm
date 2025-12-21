package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/cache"
	"github.com/VighneshDev1411/velocityllm/internal/worker"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// CacheHandlers handles cache-related HTTP endpoints
type CacheHandlers struct {
	pool   *worker.WorkerPool
	logger *utils.Logger
}

// NewCacheHandlers creates new cache handlers
func NewCacheHandlers(pool *worker.WorkerPool, logger *utils.Logger) *CacheHandlers {
	return &CacheHandlers{
		pool:   pool,
		logger: logger,
	}
}

// CompletionAsyncHandler handles async completion requests
func (h *CacheHandlers) CompletionAsyncHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Parse request
	var req types.CompletionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate required fields
	if req.Prompt == "" {
		types.WriteError(w, http.StatusBadRequest, "Prompt is required")
		return
	}

	// Set default for UseCache
	if !req.UseCache {
		req.UseCache = true
	}

	// Create job payload
	payload := map[string]interface{}{
		"request": req,
		"type":    "completion",
	}

	// Create and submit job
	job := worker.NewJob("completion", payload)
	job.SetPriority(worker.PriorityNormal)

	if err := h.pool.Submit(job); err != nil {
		utils.Error("Failed to submit async request: %v", err)
		types.WriteError(w, http.StatusInternalServerError, "Failed to submit request: "+err.Error())
		return
	}

	// Return job ID immediately
	response := map[string]interface{}{
		"job_id":  job.ID,
		"status":  string(job.GetStatus()),
		"message": "Job submitted successfully. Use /api/v1/jobs/{job_id} to check status",
	}

	types.WriteSuccess(w, "Job submitted", response)
}

// JobStatusHandler checks the status of an async job
func (h *CacheHandlers) JobStatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Extract job ID from URL
	path := r.URL.Path
	jobID := path[len("/api/v1/jobs/"):]

	if jobID == "" {
		types.WriteError(w, http.StatusBadRequest, "Job ID is required")
		return
	}

	// Get job from worker pool
	job, exists := h.pool.GetJob(jobID)
	if !exists {
		types.WriteError(w, http.StatusNotFound, "Job not found")
		return
	}

	// Build response based on job status
	status := job.GetStatus()
	response := map[string]interface{}{
		"job_id":     jobID,
		"status":     string(status),
		"created_at": job.CreatedAt,
	}

	// Add timing information if available
	if !job.StartedAt.IsZero() {
		response["started_at"] = job.StartedAt
		response["duration_ms"] = job.Duration().Milliseconds()
	}
	if !job.QueuedAt.IsZero() {
		response["queued_at"] = job.QueuedAt
	}
	if !job.CompletedAt.IsZero() {
		response["completed_at"] = job.CompletedAt
	}

	// Add result or error based on status
	switch status {
	case worker.JobStatusCompleted:
		response["result"] = job.Result
		types.WriteSuccess(w, "Job completed", response)
	case worker.JobStatusFailed, worker.JobStatusTimeout:
		response["error"] = job.Error
		types.WriteError(w, http.StatusInternalServerError, "Job failed: "+job.Error)
	case worker.JobStatusCancelled:
		types.WriteSuccess(w, "Job cancelled", response)
	default:
		// Job still processing
		types.WriteSuccess(w, "Job in progress", response)
	}
}

// GetCacheStatsHandler returns cache statistics
func (h *CacheHandlers) GetCacheStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	stats, err := cache.GetStats()
	if err != nil {
		utils.Error("Failed to get cache stats: %v", err)
		types.WriteError(w, http.StatusInternalServerError, "Failed to retrieve cache statistics")
		return
	}

	types.WriteSuccess(w, "Cache statistics retrieved", stats)
}

// ClearCacheHandler clears the cache
func (h *CacheHandlers) ClearCacheHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodDelete {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	if err := cache.FlushAll(); err != nil {
		utils.Error("Failed to clear cache: %v", err)
		types.WriteError(w, http.StatusInternalServerError, "Failed to clear cache")
		return
	}

	types.WriteSuccess(w, "Cache cleared successfully", nil)
}
