package api

import (
	"encoding/json"
	"net/http"
	"sync"

	"github.com/VighneshDev1411/velocityllm/internal/cache"
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

	// Get worker pool
	pool := worker.GetGlobalPool()

	// Submit job asynchronously
	jobID, resultChan, err := pool.SubmitAsync(req)
	if err != nil {
		utils.Error("Failed to submit async request: %v", err)
		types.WriteError(w, http.StatusInternalServerError, "Failed to submit request: "+err.Error())
		return
	}

	// Return job ID immediately
	response := map[string]interface{}{
		"job_id":  jobID,
		"status":  "processing",
		"message": "Job submitted successfully. Use /api/v1/jobs/{job_id} to check status",
	}

	// Store result channel for later retrieval
	storeJobResultChannel(jobID, resultChan)

	types.WriteSuccess(w, "Job submitted", response)
}

// Job result storage (in production, use Redis or database)
var jobResults = make(map[string]chan worker.JobResult)
var jobResultsMutex sync.RWMutex

func storeJobResultChannel(jobID string, resultChan chan worker.JobResult) {
	jobResultsMutex.Lock()
	defer jobResultsMutex.Unlock()
	jobResults[jobID] = resultChan
}

func getJobResultChannel(jobID string) (chan worker.JobResult, bool) {
	jobResultsMutex.RLock()
	defer jobResultsMutex.RUnlock()
	ch, exists := jobResults[jobID]
	return ch, exists
}

// JobStatusHandler checks the status of an async job
func JobStatusHandler(w http.ResponseWriter, r *http.Request) {
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

	// Get result channel
	resultChan, exists := getJobResultChannel(jobID)
	if !exists {
		types.WriteError(w, http.StatusNotFound, "Job not found")
		return
	}

	// Check if result is ready (non-blocking)
	select {
	case result := <-resultChan:
		// Job completed
		if result.Error != nil {
			types.WriteError(w, http.StatusInternalServerError, "Job failed: "+result.Error.Error())
			return
		}

		response := map[string]interface{}{
			"job_id":   jobID,
			"status":   "completed",
			"result":   result.Response,
			"duration": result.Duration.String(),
		}

		types.WriteSuccess(w, "Job completed", response)

	default:
		// Job still processing
		response := map[string]interface{}{
			"job_id": jobID,
			"status": "processing",
		}
		types.WriteSuccess(w, "Job in progress", response)
	}
}

// GetCacheStatsHandler returns cache statistics
func GetCacheStatsHandler(w http.ResponseWriter, r *http.Request) {
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
func ClearCacheHandler(w http.ResponseWriter, r *http.Request) {
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
