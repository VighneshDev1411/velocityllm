package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/cache"
	"github.com/VighneshDev1411/velocityllm/internal/router"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/google/uuid"
)

// CompletionStreamHandler streams completion responses over Server-Sent Events (SSE)
func CompletionStreamHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Ensure the writer supports flushing (required for SSE)
	flusher, ok := w.(http.Flusher)
	if !ok {
		types.WriteError(w, http.StatusInternalServerError, "Streaming not supported by server")
		return
	}

	var req types.CompletionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Prompt == "" {
		types.WriteError(w, http.StatusBadRequest, "Prompt is required")
		return
	}

	// Default to using cache unless explicitly disabled
	if !req.UseCache {
		req.UseCache = true
	}

	ctx := r.Context()
	startTime := time.Now()

	// Prepare SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	cacheService := cache.NewCacheService(24 * time.Hour)
	routerInstance := router.GetGlobalRouter()

	// Route to appropriate model
	routingDecision, err := routeRequest(ctx, routerInstance, req)
	if err != nil {
		utils.Error("Streaming route failed: %v", err)
		types.WriteError(w, http.StatusInternalServerError, "Failed to select model for streaming")
		return
	}
	selectedModel := routingDecision.SelectedModel

	cacheKey := cacheService.GenerateKey(req.Prompt, selectedModel.Name)
	var fullResponse string
	var tokens int

	// If cached, stream cached response as a single chunk
	if req.UseCache {
		var cached types.CachedCompletion
		found, err := cacheService.Get(ctx, cacheKey, &cached)
		if err != nil {
			utils.Error("Cache get error (stream): %v", err)
		}

		if found {
			fullResponse = cached.Response
			tokens = cached.Tokens

			chunk := types.StreamChunk{
				ID:      uuid.NewString(),
				Model:   selectedModel.Name,
				Content: cached.Response,
				Index:   0,
				Done:    false,
			}
			_ = sendSSE(w, chunk, flusher)

			doneChunk := chunk
			doneChunk.Done = true
			doneChunk.Content = "[DONE]"
			_ = sendSSE(w, doneChunk, flusher)

			latency := int(time.Since(startTime).Milliseconds())
			resp := types.CompletionResponse{
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

			logRequestToDatabase(req, resp, true, routingDecision)
			return
		}
	}

	// Cache miss - simulate streaming tokens
	streamTokens := simulateStreaming(req, selectedModel.Name)
	var builder strings.Builder

	for idx, token := range streamTokens {
		select {
		case <-ctx.Done():
			utils.Warn("Streaming cancelled by client")
			return
		default:
		}

		builder.WriteString(token)
		if idx < len(streamTokens)-1 {
			builder.WriteString(" ")
		}

		chunk := types.StreamChunk{
			ID:      uuid.NewString(),
			Model:   selectedModel.Name,
			Content: token,
			Index:   idx,
			Done:    false,
		}

		if err := sendSSE(w, chunk, flusher); err != nil {
			utils.Error("Failed to stream chunk: %v", err)
			return
		}

		// Simulate real-time token generation
		time.Sleep(60 * time.Millisecond)
	}

	fullResponse = builder.String()
	tokens = len(strings.Fields(fullResponse))
	latency := int(time.Since(startTime).Milliseconds())
	cost := float64(tokens) * selectedModel.CostPerToken

	// Final done signal
	doneChunk := types.StreamChunk{
		ID:      uuid.NewString(),
		Model:   selectedModel.Name,
		Content: "[DONE]",
		Index:   len(streamTokens),
		Done:    true,
	}
	_ = sendSSE(w, doneChunk, flusher)

	resp := types.CompletionResponse{
		ID:        uuid.New().String(),
		Model:     selectedModel.Name,
		Prompt:    req.Prompt,
		Response:  fullResponse,
		Tokens:    tokens,
		Latency:   latency,
		Cost:      cost,
		CacheHit:  false,
		Provider:  selectedModel.Provider,
		CreatedAt: time.Now().Format(time.RFC3339),
	}

	// Cache final response for future non-streaming requests
	if req.UseCache {
		_ = cacheService.Set(ctx, cacheKey, types.CachedCompletion{
			Response: fullResponse,
			Tokens:   tokens,
			Cost:     cost,
			Provider: selectedModel.Provider,
			Model:    selectedModel.Name,
			CachedAt: time.Now().Format(time.RFC3339),
		}, 24*time.Hour)
	}

	logRequestToDatabase(req, resp, false, routingDecision)
}

// routeRequest selects model based on request parameters
func routeRequest(ctx context.Context, routerInstance *router.Router, req types.CompletionRequest) (*router.RoutingDecision, error) {
	if req.Model != "" {
		return routerInstance.RouteWithModel(ctx, req.Model)
	}
	return routerInstance.Route(ctx, req.Prompt)
}

// sendSSE writes a single SSE event to the response writer
func sendSSE(w http.ResponseWriter, data interface{}, flusher http.Flusher) error {
	payload, err := json.Marshal(data)
	if err != nil {
		return err
	}

	// SSE format: data: <json>\n\n
	if _, err := fmt.Fprintf(w, "data: %s\n\n", payload); err != nil {
		return err
	}

	flusher.Flush()
	return nil
}

// simulateStreaming returns tokenized response for streaming
func simulateStreaming(req types.CompletionRequest, modelName string) []string {
	base := fmt.Sprintf("This is a streamed %s response to: %s", modelName, req.Prompt)
	// Split into words to simulate token streaming
	return strings.Fields(base)
}
