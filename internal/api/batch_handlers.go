package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/batch"
	"github.com/VighneshDev1411/velocityllm/internal/llm"
	"github.com/VighneshDev1411/velocityllm/internal/router"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/google/uuid"
)

// BatchCompletionHandler runs the same prompt against multiple models in parallel
func BatchCompletionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req types.BatchCompletionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Prompt == "" {
		types.WriteError(w, http.StatusBadRequest, "Prompt is required")
		return
	}
	if len(req.Models) < 2 {
		types.WriteError(w, http.StatusBadRequest, "At least 2 models are required")
		return
	}
	if len(req.Models) > 6 {
		types.WriteError(w, http.StatusBadRequest, "Maximum 6 models allowed")
		return
	}

	// Defaults
	if req.MaxTokens == 0 {
		req.MaxTokens = 1024
	}
	if req.Temperature == 0 {
		req.Temperature = 0.7
	}
	if req.TopP == 0 {
		req.TopP = 1.0
	}

	startTime := time.Now()

	routerInstance := router.GetGlobalRouter()
	provider := llm.GetProvider()

	// Run completions in parallel
	var wg sync.WaitGroup
	var mu sync.Mutex
	results := make([]types.BatchCompletionItem, len(req.Models))

	for i, modelName := range req.Models {
		wg.Add(1)
		go func(idx int, mName string) {
			defer wg.Done()

			item := types.BatchCompletionItem{
				Model: mName,
			}

			modelStart := time.Now()

			// Resolve model through router
			ctx := context.Background()
			decision, err := routerInstance.RouteWithModel(ctx, mName)
			if err != nil {
				item.Error = fmt.Sprintf("Model unavailable: %s", err.Error())
				item.Success = false
				mu.Lock()
				results[idx] = item
				mu.Unlock()
				return
			}

			selectedModel := decision.SelectedModel
			item.Provider = selectedModel.Provider

			// Try real LLM, fall back to simulation
			if provider.IsAvailable() {
				result, err := provider.Complete(req.Prompt, mName, req.Temperature, req.MaxTokens, req.TopP)
				if err != nil {
					utils.Error("Batch LLM error for %s, falling back to simulation", mName, err)
					simReq := types.CompletionRequest{
						Prompt:    req.Prompt,
						MaxTokens: req.MaxTokens,
					}
					simResult := simulateCompletion(simReq, mName)
					item.Response = simResult.Response
					item.Tokens = simResult.Tokens
				} else {
					item.Response = result.Response
					item.Tokens = result.TotalTokens
				}
			} else {
				simReq := types.CompletionRequest{
					Prompt:    req.Prompt,
					MaxTokens: req.MaxTokens,
				}
				simResult := simulateCompletion(simReq, mName)
				item.Response = simResult.Response
				item.Tokens = simResult.Tokens
			}

			item.Latency = int(time.Since(modelStart).Milliseconds())
			item.Cost = float64(item.Tokens) * selectedModel.CostPerToken
			item.Success = true

			mu.Lock()
			results[idx] = item
			mu.Unlock()
		}(i, modelName)
	}

	wg.Wait()

	totalTime := int(time.Since(startTime).Milliseconds())

	batchResult := &types.BatchCompletionResult{
		ID:          uuid.New().String(),
		Prompt:      req.Prompt,
		Models:      req.Models,
		Results:     results,
		TotalTimeMs: totalTime,
		CreatedAt:   time.Now().Format(time.RFC3339),
	}

	// Save to history
	svc := batch.GetService()
	svc.SaveRun(batchResult)

	utils.Info("Batch completion: %d models, total=%dms", len(req.Models), totalTime)

	types.WriteSuccess(w, "Batch completion finished", batchResult)
}

// BatchCompletionHistoryHandler returns past batch comparison runs
func BatchCompletionHistoryHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	limit := 20
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	svc := batch.GetService()
	history := svc.GetHistory(limit)

	types.WriteSuccess(w, "Batch history retrieved", map[string]interface{}{
		"runs":  history,
		"count": len(history),
	})
}
