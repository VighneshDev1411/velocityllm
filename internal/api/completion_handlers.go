package api

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/cache"
	"github.com/VighneshDev1411/velocityllm/internal/database"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/google/uuid"
)

// CompletionHandler handles LLM completion requests with caching
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
	if req.Model == "" || req.Prompt == "" {
		types.WriteError(w, http.StatusBadRequest, "Model and prompt are required")
		return
	}

	ctx := context.Background()
	startTime := time.Now()

	// Initialize cache service
	cacheService := cache.NewCacheService(24 * time.Hour) // 24 hour cache TTL

	// Generate cache key
	cacheKey := cacheService.GenerateKey(req.Prompt, req.Model)

	var response types.CompletionResponse

	// Check cache (defaults to enabled unless explicitly disabled)
	if req.UseCache != false {
		var cached types.CachedCompletion
		found, err := cacheService.Get(ctx, cacheKey, &cached)
		if err != nil {
			utils.Error("Cache get error: %v", err)
		}

		if found {
			// Cache HIT - return cached response
			latency := int(time.Since(startTime).Milliseconds())

			response = types.CompletionResponse{
				ID:        uuid.New().String(),
				Model:     req.Model,
				Prompt:    req.Prompt,
				Response:  cached.Response,
				Tokens:    cached.Tokens,
				Latency:   latency,
				Cost:      0.0, // No cost for cached response
				CacheHit:  true,
				Provider:  cached.Provider,
				CreatedAt: time.Now().Format(time.RFC3339),
			}

			utils.Info("Cache HIT: model=%s, latency=%dms", req.Model, latency)

			// Log request to database
			logRequestToDatabase(req, response, true)

			types.WriteSuccess(w, "Completion retrieved from cache", response)
			return
		}
	}

	// Cache MISS - Generate new completion
	utils.Info("Cache MISS: model=%s, generating new completion", req.Model)

	// TODO: In future, this will call actual LLM API (OpenAI, Anthropic, etc.)
	// For now, we'll simulate a response
	generatedResponse := simulateCompletion(req)

	latency := int(time.Since(startTime).Milliseconds())

	// Calculate cost based on model
	modelRepo := database.NewModelRepository()
	modelInfo, err := modelRepo.GetByName(req.Model)
	var cost float64
	var provider string

	if err == nil {
		cost = float64(generatedResponse.Tokens) * modelInfo.CostPerToken
		provider = modelInfo.Provider
	} else {
		cost = 0.0
		provider = "unknown"
	}

	response = types.CompletionResponse{
		ID:        uuid.New().String(),
		Model:     req.Model,
		Prompt:    req.Prompt,
		Response:  generatedResponse.Response,
		Tokens:    generatedResponse.Tokens,
		Latency:   latency,
		Cost:      cost,
		CacheHit:  false,
		Provider:  provider,
		CreatedAt: time.Now().Format(time.RFC3339),
	}

	// Cache the response for future requests (defaults to enabled)
	if req.UseCache != false {
		cachedData := types.CachedCompletion{
			Response: generatedResponse.Response,
			Tokens:   generatedResponse.Tokens,
			Cost:     cost,
			Provider: provider,
			Model:    req.Model,
			CachedAt: time.Now().Format(time.RFC3339),
		}

		if err := cacheService.Set(ctx, cacheKey, cachedData, 24*time.Hour); err != nil {
			utils.Error("Failed to cache response: %v", err)
		} else {
			utils.Info("Response cached: key=%s", cacheKey)
		}
	}

	// Log request to database
	logRequestToDatabase(req, response, false)

	types.WriteSuccess(w, "Completion generated successfully", response)
}

// simulateCompletion simulates an LLM response (placeholder)
func simulateCompletion(req types.CompletionRequest) struct {
	Response string
	Tokens   int
} {
	// Simulate processing time
	time.Sleep(100 * time.Millisecond)

	// Generate a simple response based on the model
	var response string
	switch req.Model {
	case "gpt-4":
		response = "This is a simulated GPT-4 response to: " + req.Prompt
	case "gpt-3.5-turbo":
		response = "This is a simulated GPT-3.5 Turbo response to: " + req.Prompt
	case "claude-3-opus":
		response = "This is a simulated Claude 3 Opus response to: " + req.Prompt
	case "claude-3-sonnet":
		response = "This is a simulated Claude 3 Sonnet response to: " + req.Prompt
	default:
		response = "This is a simulated response from " + req.Model + " to: " + req.Prompt
	}

	// Simulate token count (simple word count approximation)
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
func logRequestToDatabase(req types.CompletionRequest, resp types.CompletionResponse, cacheHit bool) {
	request := types.Request{
		Model:          req.Model,
		Prompt:         req.Prompt,
		Response:       resp.Response,
		TokensPrompt:   len(req.Prompt) / 4, // Rough approximation
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
		utils.Error("Failed to log request to database: %v", err)
	}
}
