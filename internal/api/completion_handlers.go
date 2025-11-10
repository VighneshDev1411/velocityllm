package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/cache"
	"github.com/VighneshDev1411/velocityllm/internal/database"
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
			utils.Error("Failed to route to specified model %s: %v", req.Model, err)
			types.WriteError(w, http.StatusBadRequest, "Invalid or unavailable model: "+req.Model)
			return
		}
	} else {
		// Use intelligent routing
		routingDecision, err = routerInstance.Route(ctx, req.Prompt)
		if err != nil {
			utils.Error("Failed to route request: %v", err)
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
			utils.Error("Cache get error: %v", err)
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

			// Log request to database
			logRequestToDatabase(req, response, true, routingDecision)

			types.WriteSuccess(w, "Completion retrieved from cache", response)
			return
		}
	}

	// Cache MISS - Generate new completion
	utils.Info("Cache MISS: model=%s, generating new completion", selectedModel.Name)

	// Generate response (simulated for now)
	generatedResponse := simulateCompletion(req, selectedModel.Name)

	latency := int(time.Since(startTime).Milliseconds())

	// Calculate cost
	cost := float64(generatedResponse.Tokens) * selectedModel.CostPerToken

	response = types.CompletionResponse{
		ID:        uuid.New().String(),
		Model:     selectedModel.Name,
		Prompt:    req.Prompt,
		Response:  generatedResponse.Response,
		Tokens:    generatedResponse.Tokens,
		Latency:   latency,
		Cost:      cost,
		CacheHit:  false,
		Provider:  selectedModel.Provider,
		CreatedAt: time.Now().Format(time.RFC3339),
	}

	// Cache the response for future requests
	if req.UseCache {
		cachedData := types.CachedCompletion{
			Response: generatedResponse.Response,
			Tokens:   generatedResponse.Tokens,
			Cost:     cost,
			Provider: selectedModel.Provider,
			Model:    selectedModel.Name,
			CachedAt: time.Now().Format(time.RFC3339),
		}

		if err := cacheService.Set(ctx, cacheKey, cachedData, 24*time.Hour); err != nil {
			utils.Error("Failed to cache response: %v", err)
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
		utils.Error("Failed to log request to database: %v", err)
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
