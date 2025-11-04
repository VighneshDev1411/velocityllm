package router

import (
	"context"
	"fmt"

	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// FallbackChain represents a chain of fallback models
type FallbackChain struct {
	models []types.Model
}

// NewFallbackChain creates a new fallback chain
func NewFallbackChain(models []types.Model) *FallbackChain {
	return &FallbackChain{
		models: models,
	}
}

// Execute tries each model in the chain until one succeeds
func (fc *FallbackChain) Execute(ctx context.Context, fn func(model types.Model) error) error {
	if len(fc.models) == 0 {
		return fmt.Errorf("no models in fallback chain")
	}

	var lastErr error

	for i, model := range fc.models {
		utils.Info("Trying model %d/%d: %s", i+1, len(fc.models), model.Name)

		err := fn(model)
		if err == nil {
			// Success!
			if i > 0 {
				utils.Info("Fallback successful with model: %s", model.Name)
			}
			return nil
		}

		// This model failed
		lastErr = err
		utils.Warn("Model %s failed: %v", model.Name, err)

		// Check if context is cancelled
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
			// Continue to next model
		}
	}

	// All models failed
	return fmt.Errorf("all %d models in fallback chain failed, last error: %w", len(fc.models), lastErr)
}

// ExecuteWithResult tries each model until one succeeds and returns result
func (fc *FallbackChain) ExecuteWithResult(ctx context.Context, fn func(model types.Model) (interface{}, error)) (interface{}, error) {
	if len(fc.models) == 0 {
		return nil, fmt.Errorf("no models in fallback chain")
	}

	var lastErr error

	for i, model := range fc.models {
		utils.Info("Trying model %d/%d: %s", i+1, len(fc.models), model.Name)

		result, err := fn(model)
		if err == nil {
			// Success!
			if i > 0 {
				utils.Info("Fallback successful with model: %s", model.Name)
			}
			return result, nil
		}

		// This model failed
		lastErr = err
		utils.Warn("Model %s failed: %v", model.Name, err)

		// Check if context is cancelled
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
			// Continue to next model
		}
	}

	// All models failed
	return nil, fmt.Errorf("all %d models in fallback chain failed, last error: %w", len(fc.models), lastErr)
}

// FallbackStrategy manages fallback configurations
type FallbackStrategy struct {
	primaryModel   types.Model
	fallbackModels []types.Model
}

// NewFallbackStrategy creates a new fallback strategy
func NewFallbackStrategy(primary types.Model, fallbacks []types.Model) *FallbackStrategy {
	return &FallbackStrategy{
		primaryModel:   primary,
		fallbackModels: fallbacks,
	}
}

// GetChain returns the complete fallback chain
func (fs *FallbackStrategy) GetChain() []types.Model {
	chain := make([]types.Model, 0, 1+len(fs.fallbackModels))
	chain = append(chain, fs.primaryModel)
	chain = append(chain, fs.fallbackModels...)
	return chain
}

// Execute executes with fallback strategy
func (fs *FallbackStrategy) Execute(ctx context.Context, fn func(model types.Model) error) error {
	chain := NewFallbackChain(fs.GetChain())
	return chain.Execute(ctx, fn)
}

// ExecuteWithResult executes with fallback strategy and returns result
func (fs *FallbackStrategy) ExecuteWithResult(ctx context.Context, fn func(model types.Model) (interface{}, error)) (interface{}, error) {
	chain := NewFallbackChain(fs.GetChain())
	return chain.ExecuteWithResult(ctx, fn)
}

// BuildFallbackChain builds a fallback chain based on model characteristics
func BuildFallbackChain(primary types.Model, allModels []types.Model, maxFallbacks int) []types.Model {
	chain := []types.Model{primary}

	// Score other models as fallbacks
	scorer := DefaultScorer()
	scores := scorer.ScoreModels(allModels, 100) // Use 100 tokens for scoring

	// Filter out the primary model and unavailable models
	candidates := make([]ModelScore, 0)
	for _, score := range scores {
		if score.Model.Name != primary.Name && score.Model.Available {
			candidates = append(candidates, score)
		}
	}

	// Add top N candidates as fallbacks
	count := maxFallbacks
	if count > len(candidates) {
		count = len(candidates)
	}

	for i := 0; i < count; i++ {
		chain = append(chain, candidates[i].Model)
	}

	return chain
}

// SmartFallbackChain builds a smart fallback chain based on model tier
func SmartFallbackChain(primary types.Model, allModels []types.Model) []types.Model {
	chain := []types.Model{primary}

	// Categorize models by tier
	premiumModels := []types.Model{}
	midTierModels := []types.Model{}
	budgetModels := []types.Model{}

	for _, model := range allModels {
		if !model.Available || model.Name == primary.Name {
			continue
		}

		// Categorize based on cost
		if model.CostPerToken >= 0.00002 {
			premiumModels = append(premiumModels, model)
		} else if model.CostPerToken >= 0.000005 {
			midTierModels = append(midTierModels, model)
		} else {
			budgetModels = append(budgetModels, model)
		}
	}

	// Build fallback based on primary's tier
	if primary.CostPerToken >= 0.00002 {
		// Primary is premium → fallback to mid-tier then budget
		if len(midTierModels) > 0 {
			chain = append(chain, midTierModels[0])
		}
		if len(budgetModels) > 0 {
			chain = append(chain, budgetModels[0])
		}
	} else if primary.CostPerToken >= 0.000005 {
		// Primary is mid-tier → fallback to other mid-tier then budget
		if len(midTierModels) > 1 {
			chain = append(chain, midTierModels[1])
		}
		if len(budgetModels) > 0 {
			chain = append(chain, budgetModels[0])
		}
	} else {
		// Primary is budget → fallback to other budget
		if len(budgetModels) > 1 {
			chain = append(chain, budgetModels[1])
		}
	}

	return chain
}

// FallbackWithRetry combines fallback and retry strategies
func FallbackWithRetry(
	ctx context.Context,
	models []types.Model,
	retryConfig RetryConfig,
	fn func(model types.Model) error,
) error {
	chain := NewFallbackChain(models)
	retry := NewRetryStrategy(retryConfig)

	return chain.Execute(ctx, func(model types.Model) error {
		// Try this model with retry
		return retry.Execute(ctx, func() error {
			return fn(model)
		})
	})
}

// FallbackWithRetryAndResult combines fallback and retry with result
func FallbackWithRetryAndResult(
	ctx context.Context,
	models []types.Model,
	retryConfig RetryConfig,
	fn func(model types.Model) (interface{}, error),
) (interface{}, error) {
	chain := NewFallbackChain(models)
	retry := NewRetryStrategy(retryConfig)

	return chain.ExecuteWithResult(ctx, func(model types.Model) (interface{}, error) {
		// Try this model with retry
		return retry.ExecuteWithResult(ctx, func() (interface{}, error) {
			return fn(model)
		})
	})
}
