package worker

import (
	"context"
	"fmt"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/cache"
	"github.com/VighneshDev1411/velocityllm/internal/database"
	"github.com/VighneshDev1411/velocityllm/internal/router"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/google/uuid"
)

// NewWorker creates a new worker
func NewWorker(id int, jobsChan chan Job) *Worker {
	return &Worker{
		ID:          id,
		Status:      WorkerStatusIdle,
		JobsChan:    jobsChan,
		QuitChan:    make(chan bool),
		CurrentJob:  nil,
		JobsHandled: 0,
		StartedAt:   time.Now(),
	}
}

// Start begins the worker's processing loop
func (w *Worker) Start(ctx context.Context, resultQueue chan JobResult) {
	utils.Info("Worker %d started", w.ID)

	go func() {
		for {
			select {
			case <-ctx.Done():
				// Context cancelled - shutdown
				w.Status = WorkerStatusStopped
				utils.Info("Worker %d stopped (context cancelled)", w.ID)
				return

			case <-w.QuitChan:
				// Explicit quit signal
				w.Status = WorkerStatusStopped
				utils.Info("Worker %d stopped (quit signal)", w.ID)
				return

			case job := <-w.JobsChan:
				// Received a job to process
				w.Status = WorkerStatusProcessing
				w.CurrentJob = &job

				utils.Debug("Worker %d processing job %s", w.ID, job.ID)

				// Process the job
				result := w.processJob(ctx, job)

				// Send result back
				select {
				case resultQueue <- result:
					// Result sent successfully
				case <-time.After(5 * time.Second):
					// Timeout sending result
					utils.Error("Worker %d: timeout sending result for job %s", w.ID, job.ID)
				}

				// Update worker state
				w.JobsHandled++
				w.CurrentJob = nil
				w.Status = WorkerStatusIdle
			}
		}
	}()
}

// Stop signals the worker to stop
func (w *Worker) Stop() {
	select {
	case w.QuitChan <- true:
		utils.Info("Worker %d received stop signal", w.ID)
	default:
		// Channel might be full or closed
	}
}

// processJob processes a single job
func (w *Worker) processJob(ctx context.Context, job Job) JobResult {
	startTime := time.Now()

	// Create a timeout context for this job
	jobCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	// Calculate queue wait time
	queueWaitTime := time.Since(job.SubmittedAt)
	utils.Debug("Job %s waited in queue for %v", job.ID, queueWaitTime)

	// Initialize cache and router
	cacheService := cache.NewCacheService(24 * time.Hour)
	routerInstance := router.GetGlobalRouter()

	// Get routing decision
	routingDecision, err := routerInstance.Route(jobCtx, job.Request.Prompt)
	if err != nil {
		utils.Error("Worker %d: routing failed for job %s: %v", w.ID, job.ID, err)
		return JobResult{
			Response: types.CompletionResponse{},
			Error:    fmt.Errorf("routing failed: %w", err),
			Duration: time.Since(startTime),
		}
	}

	selectedModel := routingDecision.SelectedModel
	utils.Debug("Worker %d: selected model %s for job %s", w.ID, selectedModel.Name, job.ID)

	// Generate cache key
	cacheKey := cacheService.GenerateKey(job.Request.Prompt, selectedModel.Name)

	// Check cache if enabled
	if job.Request.UseCache {
		var cached types.CachedCompletion
		found, err := cacheService.Get(jobCtx, cacheKey, &cached)
		if err != nil {
			utils.Error("Cache get error: %v", err)
		}

		if found {
			// Cache HIT
			latency := int(time.Since(startTime).Milliseconds())
			response := types.CompletionResponse{
				ID:        uuid.New().String(),
				Model:     selectedModel.Name,
				Prompt:    job.Request.Prompt,
				Response:  cached.Response,
				Tokens:    cached.Tokens,
				Latency:   latency,
				Cost:      0.0, // No cost for cache hit
				CacheHit:  true,
				Provider:  cached.Provider,
				CreatedAt: time.Now().Format(time.RFC3339),
			}

			utils.Debug("Worker %d: cache HIT for job %s", w.ID, job.ID)

			// Log to database
			w.logRequestToDatabase(job.Request, response, true, routingDecision)

			return JobResult{
				Response: response,
				Error:    nil,
				Duration: time.Since(startTime),
			}
		}
	}

	// Cache MISS - generate new completion
	utils.Debug("Worker %d: cache MISS for job %s, generating completion", w.ID, job.ID)

	// Simulate LLM call (in production, this would be actual API call)
	generatedResponse := w.simulateCompletion(job.Request, selectedModel.Name)

	latency := int(time.Since(startTime).Milliseconds())
	cost := float64(generatedResponse.Tokens) * selectedModel.CostPerToken

	response := types.CompletionResponse{
		ID:        uuid.New().String(),
		Model:     selectedModel.Name,
		Prompt:    job.Request.Prompt,
		Response:  generatedResponse.Response,
		Tokens:    generatedResponse.Tokens,
		Latency:   latency,
		Cost:      cost,
		CacheHit:  false,
		Provider:  selectedModel.Provider,
		CreatedAt: time.Now().Format(time.RFC3339),
	}

	// Cache the response
	if job.Request.UseCache {
		cachedData := types.CachedCompletion{
			Response: generatedResponse.Response,
			Tokens:   generatedResponse.Tokens,
			Cost:     cost,
			Provider: selectedModel.Provider,
			Model:    selectedModel.Name,
			CachedAt: time.Now().Format(time.RFC3339),
		}

		if err := cacheService.Set(jobCtx, cacheKey, cachedData, 24*time.Hour); err != nil {
			utils.Error("Failed to cache response: %v", err)
		}
	}

	// Log to database
	w.logRequestToDatabase(job.Request, response, false, routingDecision)

	return JobResult{
		Response: response,
		Error:    nil,
		Duration: time.Since(startTime),
	}
}

// simulateCompletion simulates an LLM response
func (w *Worker) simulateCompletion(req types.CompletionRequest, modelName string) struct {
	Response string
	Tokens   int
} {
	// Simulate processing time based on model
	var delay time.Duration
	if contains(modelName, "gpt-4") {
		delay = 150 * time.Millisecond
	} else if contains(modelName, "claude") {
		delay = 120 * time.Millisecond
	} else {
		delay = 80 * time.Millisecond
	}
	time.Sleep(delay)

	// Generate response
	response := fmt.Sprintf("This is a simulated %s response to: %s", modelName, req.Prompt)
	tokens := len(req.Prompt)/4 + len(response)/4

	return struct {
		Response string
		Tokens   int
	}{
		Response: response,
		Tokens:   tokens,
	}
}

// logRequestToDatabase logs the request to database
func (w *Worker) logRequestToDatabase(req types.CompletionRequest, resp types.CompletionResponse, cacheHit bool, decision *router.RoutingDecision) {
	request := types.Request{
		Model:          resp.Model,
		Prompt:         req.Prompt,
		Response:       resp.Response,
		TokensPrompt:   len(req.Prompt) / 4,
		TokensResponse: resp.Tokens,
		TokensTotal:    resp.Tokens,
		Latency:        resp.Latency,
		Cost:           resp.Cost,
		Status:         "completed",
		CacheHit:       cacheHit,
		Provider:       resp.Provider,
	}

	repo := database.NewRequestRepository()
	if err := repo.Create(&request); err != nil {
		utils.Error("Worker %d: failed to log request: %v", w.ID, err)
	}
}

// GetStatus returns the current worker status
func (w *Worker) GetStatus() WorkerStatus {
	return w.Status
}

// GetStats returns worker statistics
func (w *Worker) GetStats() map[string]interface{} {
	uptime := time.Since(w.StartedAt)

	stats := map[string]interface{}{
		"id":             w.ID,
		"status":         w.Status,
		"jobs_handled":   w.JobsHandled,
		"uptime":         uptime.String(),
		"uptime_seconds": int(uptime.Seconds()),
	}

	if w.CurrentJob != nil {
		stats["current_job_id"] = w.CurrentJob.ID
		stats["current_job_duration"] = time.Since(w.CurrentJob.SubmittedAt).String()
	}

	return stats
}

// Helper function
func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		match := true
		for j := 0; j < len(substr); j++ {
			if s[i+j] != substr[j] {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}
