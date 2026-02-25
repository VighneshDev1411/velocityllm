package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/llm"
	"github.com/VighneshDev1411/velocityllm/internal/streaming"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// StreamingCompletionHandler handles streaming completion requests (standard http)
func StreamingCompletionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req types.CompletionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate
	if req.Prompt == "" {
		http.Error(w, "Prompt is required", http.StatusBadRequest)
		return
	}

	// Set default model
	if req.Model == "" {
		req.Model = "gpt-3.5-turbo"
	}

	utils.Info("Starting streaming completion (model: %s, prompt length: %d)",
		req.Model, len(req.Prompt))

	// Create SSE handler
	sseHandler, err := streaming.NewSSEHandler(w)
	if err != nil {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}
	defer sseHandler.Close()

	// Try real LLM streaming first (routes to OpenAI or Anthropic)
	provider := llm.GetProvider()
	if provider.IsAvailable() {
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

		index := 0
		_, err := provider.StreamComplete(req.Prompt, req.Model, temperature, maxTokens, topP, func(token string) error {
			if writeErr := sseHandler.WriteToken(token, index); writeErr != nil {
				return writeErr
			}
			index++
			return nil
		})

		if err != nil {
			utils.Error("LLM streaming error", "value", err)
			// Send error event so the frontend knows what happened
			sseHandler.WriteError("LLM_ERROR", err.Error(), "provider_error")
		}

		if writeErr := sseHandler.WriteDone(); writeErr != nil {
			utils.Error("Failed to write done", "value", writeErr)
		}
		return
	}

	// Fallback: simulate token stream
	tokenChan := streaming.SimulateTokenStream(req.Prompt, req.Model)

	index := 0
	for {
		select {
		case token, ok := <-tokenChan:
			if !ok {
				if err := sseHandler.WriteDone(); err != nil {
					utils.Error("Failed to write done", "value", err)
				}
				utils.Debug("Streaming completed successfully")
				return
			}

			if err := sseHandler.WriteToken(token, index); err != nil {
				utils.Error("Failed to write token", "value", err)
				return
			}
			index++

		case <-r.Context().Done():
			utils.Info("Client disconnected")
			return
		}
	}
}

// SimpleStreamingHandler handles simple streaming (no buffering)
func SimpleStreamingHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req types.CompletionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate
	if req.Prompt == "" {
		http.Error(w, "Prompt is required", http.StatusBadRequest)
		return
	}

	// Set default model
	if req.Model == "" {
		req.Model = "gpt-3.5-turbo"
	}

	utils.Info("Starting simple streaming (model: %s)", req.Model)

	// Create SSE handler
	sseHandler, err := streaming.NewSSEHandler(w)
	if err != nil {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}
	defer sseHandler.Close()

	// Simulate streaming
	response := "This is a simple streaming response. Each word will be sent as a token. "
	response += "You can see the text appearing word by word in real-time!"

	words := []string{}
	word := ""

	for _, char := range response {
		if char == ' ' {
			if word != "" {
				words = append(words, word)
				word = ""
			}
			words = append(words, " ")
		} else {
			word += string(char)
		}
	}

	if word != "" {
		words = append(words, word)
	}

	// Stream each word
	for i, token := range words {
		if err := sseHandler.WriteToken(token, i); err != nil {
			utils.Error("Failed to write token", "value", err)
			return
		}
		time.Sleep(50 * time.Millisecond)
	}

	if err := sseHandler.WriteDone(); err != nil {
		utils.Error("Failed to write done", "value", err)
	}
}

// GetStreamStatsHandler returns streaming statistics
func GetStreamStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	manager := streaming.GetGlobalStreamManager()
	if manager == nil {
		http.Error(w, "Stream manager not initialized", http.StatusInternalServerError)
		return
	}

	stats := manager.GetStats()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(types.SuccessResponse{
		Message: "Stream statistics retrieved",
		Data:    stats,
	})
}

// TestSSEHandler is a simple test endpoint for SSE
func TestSSEHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	utils.Info("Starting test SSE stream")

	// Create SSE handler
	sseHandler, err := streaming.NewSSEHandler(w)
	if err != nil {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}
	defer sseHandler.Close()

	// Send test messages
	messages := []string{
		"Hello",
		"from",
		"Server-Sent",
		"Events!",
		"This",
		"is",
		"a",
		"test",
		"stream.",
	}

	for i, msg := range messages {
		if err := sseHandler.WriteToken(msg, i); err != nil {
			utils.Error("Failed to write token", "value", err)
			return
		}
		time.Sleep(100 * time.Millisecond)
	}

	if err := sseHandler.WriteDone(); err != nil {
		utils.Error("Failed to write done", "value", err)
		return
	}

	utils.Debug("Test SSE stream completed")
}
