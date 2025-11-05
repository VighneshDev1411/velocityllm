package router

import (
	"context"
	"fmt"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/database"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// Router handles intelligent routing of requests to models
type Router struct {
	config             *RoutingConfig
	algorithm          RoutingAlgorithm
	complexityAnalyzer *ComplexityAnalyzer
	modelRepo          *database.ModelRepository
	stats              *RouterStats
	circuitBreakers    *CircuitBreakerManager
	retryStrategy      *RetryStrategy
	healthChecker      *HealthChecker
}

// RouterStats tracks routing statistics
type RouterStats struct {
	TotalRequests       int64
	RequestsByStrategy  map[RoutingStrategy]int64
	RequestsByModel     map[string]int64
	AvgRoutingTime      time.Duration
	FailedRequests      int64
	FallbackUsed        int64
	CircuitBreakerTrips int64
}

// NewRouter creates a new router instance
func NewRouter(config *RoutingConfig) *Router {
	if config == nil {
		config = DefaultConfig()
	}

	router := &Router{
		config:             config,
		algorithm:          GetAlgorithm(config.Strategy),
		complexityAnalyzer: NewComplexityAnalyzer(),
		modelRepo:          database.NewModelRepository(),
		stats: &RouterStats{
			RequestsByStrategy: make(map[RoutingStrategy]int64),
			RequestsByModel:    make(map[string]int64),
		},
	}

	// Initialize circuit breakers if enabled
	if config.EnableCircuitBreak {
		cbConfig := CircuitBreakerConfig{
			FailureThreshold: 5,
			SuccessThreshold: 2,
			Timeout:          30 * time.Second,
		}
		router.circuitBreakers = NewCircuitBreakerManager(cbConfig)
		utils.Info("Circuit breakers enabled")
	}

	// Initialize retry strategy if enabled
	if config.MaxRetries > 0 {
		retryConfig := RetryConfig{
			MaxAttempts:  config.MaxRetries,
			InitialDelay: config.RetryDelay,
			MaxDelay:     5 * time.Second,
			Multiplier:   2.0,
			Jitter:       true,
		}
		router.retryStrategy = NewRetryStrategy(retryConfig)
		utils.Info("Retry enabled (max attempts: %d)", config.MaxRetries)
	}

	// Initialize health checker if enabled
	if config.HealthCheckEnabled {
		healthConfig := HealthCheckConfig{
			CheckInterval:    config.HealthCheckInterval,
			FailureThreshold: 3,
			SuccessThreshold: 2,
			Enabled:          true,
		}
		router.healthChecker = NewHealthChecker(healthConfig)
		router.healthChecker.Start()
		utils.Info("Health checker started")
	}

	return router
}

// Route selects the best model for a request
func (r *Router) Route(ctx context.Context, prompt string) (*RoutingDecision, error) {
	startTime := time.Now()

	// Step 1: Analyze prompt complexity
	analysis := r.complexityAnalyzer.Analyze(prompt)
	utils.Debug("Prompt analysis: tokens=%d, complexity=%s, hasCode=%v, hasTechnical=%v",
		analysis.TokenCount, analysis.Complexity, analysis.HasCode, analysis.HasTechnical)

	// Step 2: Get available models from database
	models, err := r.modelRepo.GetAvailable()
	if err != nil {
		return nil, fmt.Errorf("failed to get available models: %w", err)
	}

	if len(models) == 0 {
		return nil, fmt.Errorf("no available models")
	}

	// Step 3: Filter out models with open circuit breakers
	if r.circuitBreakers != nil {
		models = r.filterHealthyModels(models)
		if len(models) == 0 {
			return nil, fmt.Errorf("no healthy models available (all circuit breakers open)")
		}
	}

	// Step 4: Select model using configured algorithm
	selectedModel, err := r.algorithm.SelectModel(models, analysis)
	if err != nil {
		return nil, fmt.Errorf("failed to select model: %w", err)
	}

	// Step 5: Calculate score for transparency
	scorer := DefaultScorer()
	score := scorer.ScoreModel(*selectedModel, analysis.TokenCount)

	// Step 6: Create routing decision
	decision := &RoutingDecision{
		SelectedModel: *selectedModel,
		Strategy:      r.config.Strategy,
		Complexity:    analysis.Complexity,
		Score:         score,
		Reason:        r.generateReason(analysis, *selectedModel),
		Timestamp:     time.Now(),
	}

	// Step 7: Update statistics
	routingTime := time.Since(startTime)
	r.updateStats(decision, routingTime)

	utils.Info("Routed request: strategy=%s, model=%s, complexity=%s, score=%.2f, time=%v",
		decision.Strategy, decision.SelectedModel.Name, decision.Complexity, decision.Score, routingTime)

	return decision, nil
}

// RouteWithFallback routes with automatic fallback on failure
func (r *Router) RouteWithFallback(ctx context.Context, prompt string, fn func(model types.Model) error) error {
	// Get routing decision
	decision, err := r.Route(ctx, prompt)
	if err != nil {
		return err
	}

	// Get all available models for fallback chain
	allModels, err := r.modelRepo.GetAvailable()
	if err != nil {
		return fmt.Errorf("failed to get models for fallback: %w", err)
	}

	// Build smart fallback chain
	fallbackChain := SmartFallbackChain(decision.SelectedModel, allModels)

	// Execute with fallback and retry
	if r.retryStrategy != nil && r.config.EnableFallback {
		return FallbackWithRetry(ctx, fallbackChain, r.retryStrategy.config, func(model types.Model) error {
			return r.executeWithCircuitBreaker(ctx, model, fn)
		})
	} else if r.config.EnableFallback {
		chain := NewFallbackChain(fallbackChain)
		return chain.Execute(ctx, func(model types.Model) error {
			return r.executeWithCircuitBreaker(ctx, model, fn)
		})
	} else {
		return r.executeWithCircuitBreaker(ctx, decision.SelectedModel, fn)
	}
}

// executeWithCircuitBreaker executes a function with circuit breaker protection
func (r *Router) executeWithCircuitBreaker(ctx context.Context, model types.Model, fn func(model types.Model) error) error {
	if r.circuitBreakers == nil {
		// No circuit breaker - execute directly
		return fn(model)
	}

	// Get circuit breaker for this model
	breaker := r.circuitBreakers.GetBreaker(model.Name)

	// Execute with circuit breaker protection
	err := breaker.Call(func() error {
		return fn(model)
	})

	if err != nil && err.Error() == "circuit breaker is OPEN" {
		r.stats.CircuitBreakerTrips++
		utils.Warn("Circuit breaker OPEN for model: %s", model.Name)
	}

	return err
}

// filterHealthyModels filters out models with open circuit breakers
func (r *Router) filterHealthyModels(models []types.Model) []types.Model {
	healthy := make([]types.Model, 0)
	for _, model := range models {
		breaker := r.circuitBreakers.GetBreaker(model.Name)
		if breaker.GetState() != StateOpen {
			healthy = append(healthy, model)
		}
	}
	return healthy
}

// RouteWithModel routes to a specific model (bypass algorithm)
func (r *Router) RouteWithModel(ctx context.Context, modelName string) (*RoutingDecision, error) {
	// Get specific model
	model, err := r.modelRepo.GetByName(modelName)
	if err != nil {
		return nil, fmt.Errorf("model not found: %s", modelName)
	}

	if !model.Available {
		return nil, fmt.Errorf("model not available: %s", modelName)
	}

	decision := &RoutingDecision{
		SelectedModel: *model,
		Strategy:      "manual",
		Complexity:    ComplexityMedium,
		Score:         100.0,
		Reason:        "Manually specified model",
		Timestamp:     time.Now(),
	}

	return decision, nil
}

// SetStrategy changes the routing strategy
func (r *Router) SetStrategy(strategy RoutingStrategy) {
	r.config.Strategy = strategy
	r.algorithm = GetAlgorithm(strategy)
	utils.Info("Routing strategy changed to: %s", strategy)
}

// GetStrategy returns the current routing strategy
func (r *Router) GetStrategy() RoutingStrategy {
	return r.config.Strategy
}

// GetConfig returns the current configuration
func (r *Router) GetConfig() *RoutingConfig {
	return r.config
}

// GetStats returns routing statistics
func (r *Router) GetStats() *RouterStats {
	return r.stats
}

// GetCircuitBreakerStats returns circuit breaker statistics
func (r *Router) GetCircuitBreakerStats() []map[string]interface{} {
	if r.circuitBreakers == nil {
		return nil
	}
	return r.circuitBreakers.GetAllStats()
}

// GetHealthStats returns health check statistics
func (r *Router) GetHealthStats() map[string]interface{} {
	if r.healthChecker == nil {
		return nil
	}
	return r.healthChecker.GetHealthStats()
}

// GetModelHealth returns health status for all models
func (r *Router) GetModelHealth() map[string]*ModelHealth {
	if r.healthChecker == nil {
		return nil
	}
	return r.healthChecker.GetAllHealth()
}

// ResetStats resets routing statistics
func (r *Router) ResetStats() {
	r.stats = &RouterStats{
		RequestsByStrategy: make(map[RoutingStrategy]int64),
		RequestsByModel:    make(map[string]int64),
	}
	utils.Info("Router statistics reset")
}

// AnalyzePrompt analyzes a prompt without routing
func (r *Router) AnalyzePrompt(prompt string) *PromptAnalysis {
	return r.complexityAnalyzer.Analyze(prompt)
}

// GetAvailableModels returns all available models
func (r *Router) GetAvailableModels() ([]types.Model, error) {
	return r.modelRepo.GetAvailable()
}

// Shutdown gracefully shuts down the router
func (r *Router) Shutdown() {
	if r.healthChecker != nil {
		r.healthChecker.Stop()
		utils.Info("Health checker stopped")
	}
}

// generateReason generates a human-readable reason for model selection
func (r *Router) generateReason(analysis *PromptAnalysis, model types.Model) string {
	switch r.config.Strategy {
	case StrategyRoundRobin:
		return "Selected via round-robin distribution"

	case StrategyLeastCost:
		return fmt.Sprintf("Selected as lowest cost option (%.6f per token)", model.CostPerToken)

	case StrategyLeastLatency:
		return "Selected as fastest available model"

	case StrategyBestQuality:
		return "Selected as highest quality model"

	case StrategySmart:
		switch analysis.Complexity {
		case ComplexityLow:
			return fmt.Sprintf("Low complexity prompt - selected cost-efficient model (%s)", model.Name)
		case ComplexityMedium:
			return fmt.Sprintf("Medium complexity prompt - selected balanced model (%s)", model.Name)
		case ComplexityHigh:
			return fmt.Sprintf("High complexity prompt - selected premium model (%s)", model.Name)
		}

	default:
		return "Selected by routing algorithm"
	}

	return "Model selected"
}

// updateStats updates routing statistics
func (r *Router) updateStats(decision *RoutingDecision, routingTime time.Duration) {
	r.stats.TotalRequests++
	r.stats.RequestsByStrategy[decision.Strategy]++
	r.stats.RequestsByModel[decision.SelectedModel.Name]++

	// Update average routing time
	if r.stats.TotalRequests == 1 {
		r.stats.AvgRoutingTime = routingTime
	} else {
		// Calculate running average
		totalTime := r.stats.AvgRoutingTime * time.Duration(r.stats.TotalRequests-1)
		r.stats.AvgRoutingTime = (totalTime + routingTime) / time.Duration(r.stats.TotalRequests)
	}
}

// ValidateConfig validates the routing configuration
func ValidateConfig(config *RoutingConfig) error {
	if config == nil {
		return fmt.Errorf("config cannot be nil")
	}

	// Validate strategy
	validStrategies := []RoutingStrategy{
		StrategyRoundRobin,
		StrategyLeastCost,
		StrategyLeastLatency,
		StrategyBestQuality,
		StrategySmart,
	}

	valid := false
	for _, s := range validStrategies {
		if config.Strategy == s {
			valid = true
			break
		}
	}

	if !valid {
		return fmt.Errorf("invalid strategy: %s", config.Strategy)
	}

	// Validate retry settings
	if config.MaxRetries < 0 {
		return fmt.Errorf("max retries cannot be negative")
	}

	if config.RetryDelay < 0 {
		return fmt.Errorf("retry delay cannot be negative")
	}

	if config.HealthCheckInterval < 0 {
		return fmt.Errorf("health check interval cannot be negative")
	}

	return nil
}
