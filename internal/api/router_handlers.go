package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/router"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// GetRouterStatsHandler returns routing statistics
func GetRouterStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	routerInstance := router.GetGlobalRouter()
	stats := routerInstance.GetStats()

	response := map[string]interface{}{
		"total_requests":        stats.TotalRequests,
		"requests_by_strategy":  stats.RequestsByStrategy,
		"requests_by_model":     stats.RequestsByModel,
		"avg_routing_time":      stats.AvgRoutingTime.String(),
		"failed_requests":       stats.FailedRequests,
		"fallback_used":         stats.FallbackUsed,
		"circuit_breaker_trips": stats.CircuitBreakerTrips,
	}

	types.WriteSuccess(w, "Router statistics retrieved", response)
}

// GetRouterConfigHandler returns current router configuration
func GetRouterConfigHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	routerInstance := router.GetGlobalRouter()
	config := routerInstance.GetConfig()

	response := map[string]interface{}{
		"strategy":              config.Strategy,
		"enable_fallback":       config.EnableFallback,
		"enable_circuit_break":  config.EnableCircuitBreak,
		"max_retries":           config.MaxRetries,
		"retry_delay":           config.RetryDelay.String(),
		"health_check_enabled":  config.HealthCheckEnabled,
		"health_check_interval": config.HealthCheckInterval.String(),
	}

	types.WriteSuccess(w, "Router configuration retrieved", response)
}

// UpdateRouterStrategyHandler updates the routing strategy
func UpdateRouterStrategyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodPut {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		Strategy string `json:"strategy"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate strategy
	validStrategies := []router.RoutingStrategy{
		router.StrategyRoundRobin,
		router.StrategyLeastCost,
		router.StrategyLeastLatency,
		router.StrategyBestQuality,
		router.StrategySmart,
	}

	valid := false
	for _, s := range validStrategies {
		if string(s) == req.Strategy {
			valid = true
			break
		}
	}

	if !valid {
		types.WriteError(w, http.StatusBadRequest, "Invalid strategy. Valid options: round-robin, least-cost, least-latency, best-quality, smart")
		return
	}

	// Update strategy
	routerInstance := router.GetGlobalRouter()
	routerInstance.SetStrategy(router.RoutingStrategy(req.Strategy))

	response := map[string]interface{}{
		"strategy": req.Strategy,
		"message":  "Routing strategy updated successfully",
	}

	types.WriteSuccess(w, "Strategy updated", response)
}

// GetCircuitBreakerStatsHandler returns circuit breaker statistics
func GetCircuitBreakerStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	routerInstance := router.GetGlobalRouter()
	stats := routerInstance.GetCircuitBreakerStats()

	if stats == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Circuit breakers not enabled")
		return
	}

	types.WriteSuccess(w, "Circuit breaker statistics retrieved", stats)
}

// GetHealthStatsHandler returns health check statistics
func GetHealthStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	routerInstance := router.GetGlobalRouter()
	stats := routerInstance.GetHealthStats()

	if stats == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Health checking not enabled")
		return
	}

	types.WriteSuccess(w, "Health statistics retrieved", stats)
}

// GetModelHealthHandler returns health status for all models
func GetModelHealthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	routerInstance := router.GetGlobalRouter()
	health := routerInstance.GetModelHealth()

	if health == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Health checking not enabled")
		return
	}

	// Convert to JSON-friendly format
	response := make([]map[string]interface{}, 0)
	for modelName, modelHealth := range health {
		response = append(response, map[string]interface{}{
			"model_name":            modelName,
			"available":             modelHealth.Available,
			"last_check_time":       modelHealth.LastCheckTime.Format("2006-01-02T15:04:05Z"),
			"last_success_time":     modelHealth.LastSuccessTime.Format("2006-01-02T15:04:05Z"),
			"last_failure_time":     modelHealth.LastFailureTime.Format("2006-01-02T15:04:05Z"),
			"consecutive_failures":  modelHealth.ConsecutiveFailures,
			"consecutive_successes": modelHealth.ConsecutiveSuccesses,
			"total_checks":          modelHealth.TotalChecks,
			"successful_checks":     modelHealth.SuccessfulChecks,
			"failed_checks":         modelHealth.FailedChecks,
			"avg_response_time":     modelHealth.AvgResponseTime.String(),
			"success_rate":          calculateSuccessRate(modelHealth),
		})
	}

	types.WriteSuccess(w, "Model health retrieved", response)
}

// AnalyzePromptHandler analyzes a prompt without routing
func AnalyzePromptHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		Prompt string `json:"prompt"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Prompt == "" {
		types.WriteError(w, http.StatusBadRequest, "Prompt is required")
		return
	}

	routerInstance := router.GetGlobalRouter()
	analysis := routerInstance.AnalyzePrompt(req.Prompt)

	response := map[string]interface{}{
		"prompt":              req.Prompt,
		"token_count":         analysis.TokenCount,
		"complexity":          analysis.Complexity,
		"has_code":            analysis.HasCode,
		"has_technical_terms": analysis.HasTechnical,
		"recommended_tier":    getRecommendedTier(analysis.Complexity),
	}

	types.WriteSuccess(w, "Prompt analyzed", response)
}

// ResetRouterStatsHandler resets routing statistics
func ResetRouterStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	routerInstance := router.GetGlobalRouter()
	routerInstance.ResetStats()

	types.WriteSuccess(w, "Router statistics reset successfully", nil)
}

// GetRoutingDecisionHandler simulates a routing decision for a prompt
func GetRoutingDecisionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		Prompt string `json:"prompt"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Prompt == "" {
		types.WriteError(w, http.StatusBadRequest, "Prompt is required")
		return
	}

	routerInstance := router.GetGlobalRouter()
	ctx := r.Context()

	decision, err := routerInstance.Route(ctx, req.Prompt)
	if err != nil {
		utils.Error("Failed to route: %v", err)
		types.WriteError(w, http.StatusInternalServerError, "Failed to determine routing: "+err.Error())
		return
	}

	response := map[string]interface{}{
		"selected_model": map[string]interface{}{
			"name":           decision.SelectedModel.Name,
			"provider":       decision.SelectedModel.Provider,
			"cost_per_token": decision.SelectedModel.CostPerToken,
			"available":      decision.SelectedModel.Available,
		},
		"strategy":   decision.Strategy,
		"complexity": decision.Complexity,
		"score":      decision.Score,
		"reason":     decision.Reason,
		"timestamp":  decision.Timestamp.Format("2006-01-02T15:04:05Z"),
	}

	types.WriteSuccess(w, "Routing decision determined", response)
}

// Helper functions

func calculateSuccessRate(health *router.ModelHealth) float64 {
	if health.TotalChecks == 0 {
		return 0.0
	}
	return float64(health.SuccessfulChecks) / float64(health.TotalChecks) * 100
}

func getRecommendedTier(complexity router.ComplexityLevel) string {
	switch complexity {
	case router.ComplexityLow:
		return "budget (e.g., gpt-3.5-turbo, llama-3-8b)"
	case router.ComplexityMedium:
		return "mid-tier (e.g., claude-3-sonnet, gpt-3.5-turbo-16k)"
	case router.ComplexityHigh:
		return "premium (e.g., gpt-4, claude-3-opus)"
	default:
		return "mid-tier"
	}
}
