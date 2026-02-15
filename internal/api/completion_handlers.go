package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
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

// CompletionHandler handles LLM completion requests with intelligent routing
func CompletionHandler(w http.ResponseWriter, r *http.Request) {
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

	ctx := context.Background()
	startTime := time.Now()

	// Initialize cache service
	cacheService := cache.NewCacheService(24 * time.Hour)

	// Get router
	routerInstance := router.GetGlobalRouter()

	// Determine which model to use
	var routingDecision *router.RoutingDecision
	var err error

	if req.Model != "" {
		// User specified a model - use it directly
		routingDecision, err = routerInstance.RouteWithModel(ctx, req.Model)
		if err != nil {
			utils.Error("Failed to route to specified model %s", "value", req.Model, err)
			types.WriteError(w, http.StatusBadRequest, "Invalid or unavailable model: "+req.Model)
			return
		}
	} else {
		// Use intelligent routing
		routingDecision, err = routerInstance.Route(ctx, req.Prompt)
		if err != nil {
			utils.Error("Failed to route request", "value", err)
			types.WriteError(w, http.StatusInternalServerError, "Failed to select model")
			return
		}
	}

	selectedModel := routingDecision.SelectedModel
	utils.Info("Selected model: %s (strategy: %s, reason: %s)",
		selectedModel.Name, routingDecision.Strategy, routingDecision.Reason)

	// Generate cache key
	cacheKey := cacheService.GenerateKey(req.Prompt, selectedModel.Name)

	var response types.CompletionResponse

	// Check cache if enabled (default true)
	if req.UseCache {
		var cached types.CachedCompletion
		found, err := cacheService.Get(ctx, cacheKey, &cached)
		if err != nil {
			utils.Error("Cache get error", "value", err)
		}

		if found {
			// Cache HIT - return cached response
			latency := int(time.Since(startTime).Milliseconds())

			response = types.CompletionResponse{
				ID:        uuid.New().String(),
				Model:     selectedModel.Name,
				Prompt:    req.Prompt,
				Response:  cached.Response,
				Tokens:    cached.Tokens,
				Latency:   latency,
				Cost:      0.0, // No cost for cached response
				CacheHit:  true,
				Provider:  cached.Provider,
				CreatedAt: time.Now().Format(time.RFC3339),
			}

			utils.Info("Cache HIT: model=%s, latency=%dms", selectedModel.Name, latency)

			// Record cache hit in detailed request log
			cachePromptPreview := req.Prompt
			if len(cachePromptPreview) > 100 {
				cachePromptPreview = cachePromptPreview[:100] + "..."
			}
			cacheCollector := metrics.GetGlobalMetricsCollector()
			cacheCollector.RecordRequest(selectedModel.Name, time.Duration(latency)*time.Millisecond, 0, true, true)
			cacheCollector.RecordDetailedRequest(metrics.RequestLogEntry{
				ID:        uuid.New().String(),
				Timestamp: time.Now(),
				Model:     selectedModel.Name,
				Provider:  cached.Provider,
				Prompt:    cachePromptPreview,
				Latency:   time.Duration(latency) * time.Millisecond,
				Cost:      0,
				Tokens:    cached.Tokens,
				Status:    "cache_hit",
				CacheHit:  true,
			})

			// Log request to database
			logRequestToDatabase(req, response, true, routingDecision)

			types.WriteSuccess(w, "Completion retrieved from cache", response)
			return
		}
	}

	// Cache MISS - Generate new completion
	utils.Info("Cache MISS: model=%s, generating new completion", selectedModel.Name)

	// Try real LLM API first, fall back to simulation
	provider := llm.GetProvider()

	var responseText string
	var totalTokens int
	var cost float64

	temperature := req.Temperature
	if temperature == 0 {
		temperature = 0.7
	}
	maxTokens := req.MaxTokens
	if maxTokens == 0 {
		maxTokens = 1024
	}
	topP := req.TopP
	if topP == 0 {
		topP = 1.0
	}

	if provider.IsAvailable() {
		// Real LLM API call (routes to OpenAI or Anthropic based on model)
		utils.Info("Calling LLM provider for model=%s", selectedModel.Name)
		result, err := provider.Complete(req.Prompt, selectedModel.Name, temperature, maxTokens, topP)
		if err != nil {
			utils.Error("LLM API error, falling back to simulation", "value", err)
			simResult := simulateCompletion(req, selectedModel.Name)
			responseText = simResult.Response
			totalTokens = simResult.Tokens
		} else {
			responseText = result.Response
			totalTokens = result.TotalTokens
			utils.Info("LLM response received: model=%s, %d tokens in %dms", result.Model, result.TotalTokens, result.LatencyMs)
		}
	} else {
		// No API keys - use simulation
		simResult := simulateCompletion(req, selectedModel.Name)
		responseText = simResult.Response
		totalTokens = simResult.Tokens
	}

	latency := int(time.Since(startTime).Milliseconds())

	// Calculate cost based on actual tokens
	cost = float64(totalTokens) * selectedModel.CostPerToken

	// Record metrics
	collector := metrics.GetGlobalMetricsCollector()
	collector.RecordRequest(selectedModel.Name, time.Duration(latency)*time.Millisecond, cost, true, false)

	// Record detailed request log entry
	promptPreview := req.Prompt
	if len(promptPreview) > 100 {
		promptPreview = promptPreview[:100] + "..."
	}
	collector.RecordDetailedRequest(metrics.RequestLogEntry{
		ID:        uuid.New().String(),
		Timestamp: time.Now(),
		Model:     selectedModel.Name,
		Provider:  selectedModel.Provider,
		Prompt:    promptPreview,
		Latency:   time.Duration(latency) * time.Millisecond,
		Cost:      cost,
		Tokens:    totalTokens,
		Status:    "completed",
		CacheHit:  false,
	})

	response = types.CompletionResponse{
		ID:        uuid.New().String(),
		Model:     selectedModel.Name,
		Prompt:    req.Prompt,
		Response:  responseText,
		Tokens:    totalTokens,
		Latency:   latency,
		Cost:      cost,
		CacheHit:  false,
		Provider:  selectedModel.Provider,
		CreatedAt: time.Now().Format(time.RFC3339),
	}

	// Cache the response for future requests
	if req.UseCache {
		cachedData := types.CachedCompletion{
			Response: responseText,
			Tokens:   totalTokens,
			Cost:     cost,
			Provider: selectedModel.Provider,
			Model:    selectedModel.Name,
			CachedAt: time.Now().Format(time.RFC3339),
		}

		if err := cacheService.Set(ctx, cacheKey, cachedData, 24*time.Hour); err != nil {
			utils.Error("Failed to cache response", "value", err)
		} else {
			utils.Info("Response cached: key=%s", cacheKey)
		}
	}

	// Log request to database
	logRequestToDatabase(req, response, false, routingDecision)

	types.WriteSuccess(w, "Completion generated successfully", response)
}

// simulateCompletion simulates an LLM response (placeholder)
func simulateCompletion(req types.CompletionRequest, modelName string) struct {
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

	// Generate a simple response based on the model
	response := fmt.Sprintf("This is a simulated %s response to: %s", modelName, req.Prompt)

	// Simulate token count (simple approximation)
	tokens := len(req.Prompt)/4 + len(response)/4

	return struct {
		Response string
		Tokens   int
	}{
		Response: response,
		Tokens:   tokens,
	}
}

// logRequestToDatabase logs the completion request to database
func logRequestToDatabase(req types.CompletionRequest, resp types.CompletionResponse, cacheHit bool, _ *router.RoutingDecision) {
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
		utils.Error("Failed to log request to database", "value", err)
	}
}

// contains checks if string contains substring (helper)
func contains(s, substr string) bool {
	return indexOf(s, substr) >= 0
}

// indexOf finds index of substring
func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		match := true
		for j := 0; j < len(substr); j++ {
			if s[i+j] != substr[j] {
				match = false
				break
			}
		}
		if match {
			return i
		}
	}
	return -1
}
