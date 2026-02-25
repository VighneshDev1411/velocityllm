package worker

import (
	"context"
	"fmt"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/cache"
	"github.com/VighneshDev1411/velocityllm/internal/database"
	"github.com/VighneshDev1411/velocityllm/internal/llm"
	"github.com/VighneshDev1411/velocityllm/internal/metrics"
	"github.com/VighneshDev1411/velocityllm/internal/router"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/google/uuid"
)

// NewJobWorker creates a new worker for job processing
func NewJobWorker(id int, jobsChan chan Job) *Worker {
	return &Worker{
		ID:            fmt.Sprintf("worker-%d", id),
		Status:        WorkerStatusIdle,
		jobChan:       make(chan *Job, 10),
		stopChan:      make(chan struct{}),
		doneChan:      make(chan struct{}),
		StartTime:     time.Now(),
		LastHeartbeat: time.Now(),
		HealthScore:   100.0,
	}
}

// Start begins the worker's processing loop
func (w *Worker) Start(ctx context.Context, resultQueue chan JobResult) {
	utils.Info("Worker %d started", w.ID)

	go func() {
		heartbeat := time.NewTicker(10 * time.Second)
		defer heartbeat.Stop()

		for {
			select {
			case <-ctx.Done():
				w.Status = WorkerStatusStopped
				utils.Info("Worker %d stopped (context cancelled)", w.ID)
				return

			case <-w.QuitChan:
				w.Status = WorkerStatusStopped
				utils.Info("Worker %d stopped (quit signal)", w.ID)
				return

			case <-heartbeat.C:
				w.UpdateHealth(w.HealthScore)

			case job := <-w.JobsChan:
				w.Status = WorkerStatusProcessing
				w.CurrentJob = &job

				utils.Debug("Worker %d processing job %s", w.ID, job.ID)

				result := w.processJob(ctx, job)

				select {
				case resultQueue <- result:
				case <-time.After(5 * time.Second):
					utils.Error("Worker %d: timeout sending result for job %s", w.ID, job.ID)
				}

				w.JobsHandled++
				w.CurrentJob = nil
				w.Status = WorkerStatusIdle
				w.UpdateHealth(w.HealthScore)
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
	}
}

// processJob processes a single job by calling the real LLM API
func (w *Worker) processJob(ctx context.Context, job Job) JobResult {
	startTime := time.Now()

	jobCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()

	queueWaitTime := time.Since(job.SubmittedAt)
	utils.Debug("Job %s waited in queue for %v", job.ID, queueWaitTime)

	req, ok := job.Request.(types.CompletionRequest)
	if !ok {
		return JobResult{
			Response: types.CompletionResponse{},
			Error:    fmt.Errorf("invalid request type"),
			Duration: time.Since(startTime),
		}
	}

	cacheService := cache.NewCacheService(24 * time.Hour)
	routerInstance := router.GetGlobalRouter()

	routingDecision, err := routerInstance.Route(jobCtx, req.Prompt)
	if err != nil {
		utils.Error("Worker %s: routing failed for job %s: %v", w.ID, job.ID, err)
		collector := metrics.GetGlobalMetricsCollector()
		collector.RecordRequest("unknown", time.Since(startTime), 0.0, false, false)
		return JobResult{
			Response: types.CompletionResponse{},
			Error:    fmt.Errorf("routing failed: %w", err),
			Duration: time.Since(startTime),
		}
	}

	selectedModel := routingDecision.SelectedModel
	utils.Debug("Worker %s: selected model %s for job %s", w.ID, selectedModel.Name, job.ID)

	cacheKey := cacheService.GenerateKey(req.Prompt, selectedModel.Name)

	// ── Cache HIT ──────────────────────────────────────────────────────────
	if req.UseCache {
		var cached types.CachedCompletion
		found, cacheErr := cacheService.Get(jobCtx, cacheKey, &cached)
		if cacheErr != nil {
			utils.Error("Cache get error: %v", cacheErr)
		}

		if found {
			latency := int(time.Since(startTime).Milliseconds())
			response := types.CompletionResponse{
				ID:        uuid.New().String(),
				Model:     selectedModel.Name,
				Prompt:    req.Prompt,
				Response:  cached.Response,
				Tokens:    cached.Tokens,
				Latency:   latency,
				Cost:      0.0,
				CacheHit:  true,
				Provider:  cached.Provider,
				CreatedAt: time.Now().Format(time.RFC3339),
			}

			utils.Debug("Worker %s: cache HIT for job %s", w.ID, job.ID)
			w.logRequestToDatabase(req, response, true, routingDecision)

			collector := metrics.GetGlobalMetricsCollector()
			collector.RecordRequest(response.Model, time.Since(startTime), response.Cost, true, true)

			return JobResult{Response: response, Error: nil, Duration: time.Since(startTime)}
		}
	}

	// ── Cache MISS — call real LLM API ─────────────────────────────────────
	utils.Debug("Worker %s: cache MISS for job %s — calling %s API", w.ID, job.ID, selectedModel.Provider)

	llmResult, llmErr := llm.Call(
		jobCtx,
		selectedModel.Provider,
		selectedModel.Name,
		selectedModel.Endpoint,
		req.Prompt,
		req.MaxTokens,
		req.Temperature,
	)

	if llmErr != nil {
		utils.Error("Worker %s: LLM call failed for job %s: %v", w.ID, job.ID, llmErr)

		collector := metrics.GetGlobalMetricsCollector()
		collector.RecordRequest(selectedModel.Name, time.Since(startTime), 0.0, false, false)

		errResponse := types.CompletionResponse{
			ID:        uuid.New().String(),
			Model:     selectedModel.Name,
			Prompt:    req.Prompt,
			Response:  "",
			Tokens:    0,
			Latency:   int(time.Since(startTime).Milliseconds()),
			Cost:      0.0,
			CacheHit:  false,
			Provider:  selectedModel.Provider,
			CreatedAt: time.Now().Format(time.RFC3339),
		}
		w.logRequestToDatabase(req, errResponse, false, routingDecision)

		return JobResult{
			Response: types.CompletionResponse{},
			Error:    fmt.Errorf("LLM call failed: %w", llmErr),
			Duration: time.Since(startTime),
		}
	}

	latency := int(time.Since(startTime).Milliseconds())
	cost := float64(llmResult.TotalTokens) * selectedModel.CostPerToken

	response := types.CompletionResponse{
		ID:        uuid.New().String(),
		Model:     selectedModel.Name,
		Prompt:    req.Prompt,
		Response:  llmResult.Response,
		Tokens:    llmResult.TotalTokens,
		Latency:   latency,
		Cost:      cost,
		CacheHit:  false,
		Provider:  selectedModel.Provider,
		CreatedAt: time.Now().Format(time.RFC3339),
	}

	// Cache the successful response
	if req.UseCache {
		cachedData := types.CachedCompletion{
			Response: llmResult.Response,
			Tokens:   llmResult.TotalTokens,
			Cost:     cost,
			Provider: selectedModel.Provider,
			Model:    selectedModel.Name,
			CachedAt: time.Now().Format(time.RFC3339),
		}
		if err := cacheService.Set(jobCtx, cacheKey, cachedData, 24*time.Hour); err != nil {
			utils.Error("Failed to cache response: %v", err)
		}
	}

	w.logRequestToDatabase(req, response, false, routingDecision)

	collector := metrics.GetGlobalMetricsCollector()
	collector.RecordRequest(response.Model, time.Since(startTime), response.Cost, true, false)

	utils.Debug("Worker %s: job %s completed — %d tokens, %.4f cost, %dms",
		w.ID, job.ID, llmResult.TotalTokens, cost, latency)

	return JobResult{Response: response, Error: nil, Duration: time.Since(startTime)}
}

// logRequestToDatabase persists the request/response to PostgreSQL
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
		utils.Error("Worker %s: failed to log request: %v", w.ID, err)
	}
}

// GetStats returns worker statistics
func (w *Worker) GetStats() map[string]interface{} {
	uptime := time.Since(w.StartedAt)

	stats := map[string]interface{}{
		"id":              w.ID,
		"status":          w.Status,
		"jobs_handled":    w.JobsHandled,
		"uptime":          uptime.String(),
		"uptime_seconds":  int(uptime.Seconds()),
	}

	if w.CurrentJob != nil {
		stats["current_job_id"] = w.CurrentJob.ID
		stats["current_job_duration"] = time.Since(w.CurrentJob.SubmittedAt).String()
	}

	return stats
}
