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
}

// RouterStats tracks routing statistics
type RouterStats struct {
	TotalRequests      int64
	RequestsByStrategy map[RoutingStrategy]int64
	RequestsByModel    map[string]int64
	AvgRoutingTime     time.Duration
}

// NewRouter creates a new router instance
func NewRouter(config *RoutingConfig) *Router {
	if config == nil {
		config = DefaultConfig()
	}

	return &Router{
		config:             config,
		algorithm:          GetAlgorithm(config.Strategy),
		complexityAnalyzer: NewComplexityAnalyzer(),
		modelRepo:          database.NewModelRepository(),
		stats: &RouterStats{
			RequestsByStrategy: make(map[RoutingStrategy]int64),
			RequestsByModel:    make(map[string]int64),
		},
	}
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

	// Step 3: Select model using configured algorithm
	selectedModel, err := r.algorithm.SelectModel(models, analysis)
	if err != nil {
		return nil, fmt.Errorf("failed to select model: %w", err)
	}

	// Step 4: Calculate score for transparency
	scorer := DefaultScorer()
	score := scorer.ScoreModel(*selectedModel, analysis.TokenCount)

	// Step 5: Create routing decision
	decision := &RoutingDecision{
		SelectedModel: *selectedModel,
		Strategy:      r.config.Strategy,
		Complexity:    analysis.Complexity,
		Score:         score,
		Reason:        r.generateReason(analysis, *selectedModel),
		Timestamp:     time.Now(),
	}

	// Step 6: Update statistics
	routingTime := time.Since(startTime)
	r.updateStats(decision, routingTime)

	utils.Info("Routed request: strategy=%s, model=%s, complexity=%s, score=%.2f, time=%v",
		decision.Strategy, decision.SelectedModel.Name, decision.Complexity, decision.Score, routingTime)

	return decision, nil
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
