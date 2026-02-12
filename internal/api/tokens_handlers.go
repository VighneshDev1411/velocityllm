package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/VighneshDev1411/velocityllm/internal/tokens"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// CountTokensHandler counts tokens in text (Day 10)
func CountTokensHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	counter := tokens.GetGlobalCounter()
	count := counter.Count(req.Text)

	types.WriteSuccess(w, "Tokens counted", map[string]interface{}{
		"text":   req.Text,
		"tokens": count,
		"words":  len(req.Text),
	})
}

// CreateContextHandler creates a new conversation context
func CreateContextHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		ContextID    string `json:"context_id"`
		MaxTokens    int    `json:"max_tokens"`
		SystemPrompt string `json:"system_prompt"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.ContextID == "" {
		types.WriteError(w, http.StatusBadRequest, "context_id is required")
		return
	}

	cm := tokens.GetGlobalContextManager()
	if cm == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Context manager not initialized")
		return
	}

	ctx, err := cm.CreateContext(req.ContextID, req.MaxTokens, req.SystemPrompt)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	types.WriteSuccess(w, "Context created", map[string]interface{}{
		"context_id":    ctx.ID,
		"max_tokens":    ctx.MaxTokens,
		"total_tokens":  ctx.TotalTokens,
		"created_at":    ctx.CreatedAt,
	})
}

// AddMessageHandler adds a message to context
func AddMessageHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		ContextID string `json:"context_id"`
		Role      string `json:"role"`
		Content   string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	cm := tokens.GetGlobalContextManager()
	if cm == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Context manager not initialized")
		return
	}

	if err := cm.AddMessage(req.ContextID, req.Role, req.Content); err != nil {
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	tokenCount, _ := cm.GetTokenCount(req.ContextID)
	remaining, _ := cm.RemainingTokens(req.ContextID)

	types.WriteSuccess(w, "Message added", map[string]interface{}{
		"context_id":      req.ContextID,
		"total_tokens":    tokenCount,
		"remaining_tokens": remaining,
	})
}

// GetContextHandler retrieves context messages
func GetContextHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	contextID := r.URL.Query().Get("id")
	if contextID == "" {
		types.WriteError(w, http.StatusBadRequest, "context_id is required")
		return
	}

	cm := tokens.GetGlobalContextManager()
	if cm == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Context manager not initialized")
		return
	}

	messages, err := cm.GetMessages(contextID)
	if err != nil {
		types.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	tokenCount, _ := cm.GetTokenCount(contextID)
	remaining, _ := cm.RemainingTokens(contextID)

	types.WriteSuccess(w, "Context retrieved", map[string]interface{}{
		"context_id":       contextID,
		"messages":         messages,
		"message_count":    len(messages),
		"total_tokens":     tokenCount,
		"remaining_tokens": remaining,
	})
}

// ClearContextHandler clears context messages
func ClearContextHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		ContextID string `json:"context_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	cm := tokens.GetGlobalContextManager()
	if cm == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Context manager not initialized")
		return
	}

	if err := cm.ClearContext(req.ContextID); err != nil {
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	types.WriteSuccess(w, "Context cleared", nil)
}

// DeleteContextHandler deletes a context
func DeleteContextHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	contextID := r.URL.Query().Get("id")
	if contextID == "" {
		types.WriteError(w, http.StatusBadRequest, "context_id is required")
		return
	}

	cm := tokens.GetGlobalContextManager()
	if cm == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Context manager not initialized")
		return
	}

	if err := cm.DeleteContext(contextID); err != nil {
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	types.WriteSuccess(w, "Context deleted", nil)
}

// GetContextStatsHandler retrieves context manager statistics
func GetContextStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	cm := tokens.GetGlobalContextManager()
	if cm == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Context manager not initialized")
		return
	}

	stats := cm.GetStats()
	types.WriteSuccess(w, "Context stats retrieved", stats)
}

// ListContextsHandler lists all active contexts
func ListContextsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	cm := tokens.GetGlobalContextManager()
	if cm == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Context manager not initialized")
		return
	}

	contexts := cm.ListContexts()
	types.WriteSuccess(w, "Contexts listed", map[string]interface{}{
		"contexts": contexts,
		"count":    len(contexts),
	})
}

// AllocateBudgetHandler creates a token budget allocation
func AllocateBudgetHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		RequestID   string  `json:"request_id"`
		TotalTokens int     `json:"total_tokens"`
		System      float64 `json:"system_ratio,omitempty"`
		Prompt      float64 `json:"prompt_ratio,omitempty"`
		Context     float64 `json:"context_ratio,omitempty"`
		Response    float64 `json:"response_ratio,omitempty"`
		Reserve     float64 `json:"reserve_ratio,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	allocator := tokens.GetGlobalAllocator()

	var ratio *tokens.AllocationRatio
	if req.System > 0 || req.Prompt > 0 {
		ratio = &tokens.AllocationRatio{
			System:   req.System,
			Prompt:   req.Prompt,
			Context:  req.Context,
			Response: req.Response,
			Reserve:  req.Reserve,
		}
	}

	alloc, err := allocator.AllocateBudget(req.RequestID, req.TotalTokens, ratio)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	breakdown, _ := allocator.GetAllocationBreakdown(req.RequestID)
	types.WriteSuccess(w, "Budget allocated", map[string]interface{}{
		"request_id": alloc.RequestID,
		"breakdown":  breakdown,
	})
}

// GetBudgetHandler retrieves budget allocation
func GetBudgetHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	requestID := r.URL.Query().Get("id")
	if requestID == "" {
		types.WriteError(w, http.StatusBadRequest, "request_id is required")
		return
	}

	allocator := tokens.GetGlobalAllocator()
	breakdown, err := allocator.GetAllocationBreakdown(requestID)
	if err != nil {
		types.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	types.WriteSuccess(w, "Budget retrieved", breakdown)
}

// UseTokensHandler marks tokens as used
func UseTokensHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		RequestID string `json:"request_id"`
		Tokens    int    `json:"tokens"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	allocator := tokens.GetGlobalAllocator()
	if err := allocator.UseTokens(req.RequestID, req.Tokens); err != nil {
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	remaining, _ := allocator.RemainingBudget(req.RequestID)
	types.WriteSuccess(w, "Tokens used", map[string]interface{}{
		"request_id":      req.RequestID,
		"tokens_used":     req.Tokens,
		"remaining_budget": remaining,
	})
}

// GetTokenCounterCacheHandler retrieves token counter cache stats
func GetTokenCounterCacheHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	counter := tokens.GetGlobalCounter()
	cacheSize := counter.GetCacheSize()

	types.WriteSuccess(w, "Token counter cache stats", map[string]interface{}{
		"cache_size": cacheSize,
	})
}

// TruncateTextHandler truncates text to fit token limit
func TruncateTextHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		Text  string `json:"text"`
		Limit int    `json:"limit"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Limit <= 0 {
		types.WriteError(w, http.StatusBadRequest, "limit must be positive")
		return
	}

	counter := tokens.GetGlobalCounter()
	originalTokens := counter.Count(req.Text)
	truncated := counter.TruncateToFit(req.Text, req.Limit)
	newTokens := counter.Count(truncated)

	types.WriteSuccess(w, "Text truncated", map[string]interface{}{
		"original_text":   req.Text,
		"truncated_text":  truncated,
		"original_tokens": originalTokens,
		"new_tokens":      newTokens,
		"limit":           req.Limit,
		"truncated":       originalTokens > req.Limit,
	})
}

// EstimateResponseTokensHandler estimates response token requirements
func EstimateResponseTokensHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	promptTokensStr := r.URL.Query().Get("prompt_tokens")
	maxTokensStr := r.URL.Query().Get("max_tokens")

	promptTokens, err := strconv.Atoi(promptTokensStr)
	if err != nil || promptTokens <= 0 {
		types.WriteError(w, http.StatusBadRequest, "valid prompt_tokens required")
		return
	}

	maxTokens := 0
	if maxTokensStr != "" {
		maxTokens, err = strconv.Atoi(maxTokensStr)
		if err != nil {
			types.WriteError(w, http.StatusBadRequest, "invalid max_tokens")
			return
		}
	}

	counter := tokens.GetGlobalCounter()
	estimated := counter.EstimateResponseTokens(promptTokens, maxTokens)

	types.WriteSuccess(w, "Response tokens estimated", map[string]interface{}{
		"prompt_tokens":    promptTokens,
		"max_tokens":       maxTokens,
		"estimated_tokens": estimated,
	})
}
