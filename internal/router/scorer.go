package router

import (
	"math"

	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// ModelScorer scores models based on various criteria
type ModelScorer struct {
	weights ScoreWeights
}

// ScoreWeights defines weights for different scoring factors
type ScoreWeights struct {
	Cost    float64 // Weight for cost (0-1)
	Latency float64 // Weight for latency (0-1)
	Quality float64 // Weight for quality (0-1)
}

// NewModelScorer creates a new model scorer
func NewModelScorer(weights ScoreWeights) *ModelScorer {
	// Normalize weights to sum to 1.0
	total := weights.Cost + weights.Latency + weights.Quality
	if total > 0 {
		weights.Cost /= total
		weights.Latency /= total
		weights.Quality /= total
	}

	return &ModelScorer{
		weights: weights,
	}
}

// DefaultScorer returns a scorer with balanced weights
func DefaultScorer() *ModelScorer {
	return NewModelScorer(ScoreWeights{
		Cost:    0.33,
		Latency: 0.33,
		Quality: 0.34,
	})
}

// CostOptimizedScorer prioritizes low cost
func CostOptimizedScorer() *ModelScorer {
	return NewModelScorer(ScoreWeights{
		Cost:    0.70,
		Latency: 0.15,
		Quality: 0.15,
	})
}

// SpeedOptimizedScorer prioritizes low latency
func SpeedOptimizedScorer() *ModelScorer {
	return NewModelScorer(ScoreWeights{
		Cost:    0.15,
		Latency: 0.70,
		Quality: 0.15,
	})
}

// QualityOptimizedScorer prioritizes high quality
func QualityOptimizedScorer() *ModelScorer {
	return NewModelScorer(ScoreWeights{
		Cost:    0.15,
		Latency: 0.15,
		Quality: 0.70,
	})
}

// ScoreModel scores a single model based on weights
func (ms *ModelScorer) ScoreModel(model types.Model, estimatedTokens int) float64 {
	costScore := ms.calculateCostScore(model, estimatedTokens)
	latencyScore := ms.calculateLatencyScore(model)
	qualityScore := ms.calculateQualityScore(model)

	// Weighted average
	totalScore := (costScore * ms.weights.Cost) +
		(latencyScore * ms.weights.Latency) +
		(qualityScore * ms.weights.Quality)

	return totalScore * 100 // Scale to 0-100
}

// ScoreModels scores all models and returns sorted by score
func (ms *ModelScorer) ScoreModels(models []types.Model, estimatedTokens int) []ModelScore {
	scores := make([]ModelScore, 0, len(models))

	for _, model := range models {
		if !model.Available {
			continue // Skip unavailable models
		}

		score := ms.ScoreModel(model, estimatedTokens)
		scores = append(scores, ModelScore{
			Model: model,
			Score: score,
		})
	}

	// Sort by score (descending - higher is better)
	for i := 0; i < len(scores); i++ {
		for j := i + 1; j < len(scores); j++ {
			if scores[j].Score > scores[i].Score {
				scores[i], scores[j] = scores[j], scores[i]
			}
		}
	}

	return scores
}

// calculateCostScore calculates cost score (0-1, higher is better = cheaper)
func (ms *ModelScorer) calculateCostScore(model types.Model, estimatedTokens int) float64 {
	// Estimate cost for this request
	estimatedCost := float64(estimatedTokens) * model.CostPerToken

	// Define cost ranges for normalization
	// Very expensive: > $0.01, Very cheap: < $0.0001
	maxCost := 0.01
	minCost := 0.0001

	// Normalize: cheaper = higher score
	if estimatedCost <= minCost {
		return 1.0 // Best score for very cheap
	}
	if estimatedCost >= maxCost {
		return 0.0 // Worst score for very expensive
	}

	// Linear interpolation (inverted - cheaper is better)
	normalized := 1.0 - ((estimatedCost - minCost) / (maxCost - minCost))
	return math.Max(0, math.Min(1, normalized))
}

// calculateLatencyScore calculates latency score (0-1, higher is better = faster)
func (ms *ModelScorer) calculateLatencyScore(model types.Model) float64 {
	// Estimate typical latency based on model provider and name
	// This is a simplified estimation - in production, you'd track real latency
	estimatedLatency := ms.estimateLatency(model)

	// Define latency ranges (in milliseconds)
	// Very slow: > 2000ms, Very fast: < 200ms
	maxLatency := 2000.0
	minLatency := 200.0

	// Normalize: faster = higher score
	if estimatedLatency <= minLatency {
		return 1.0 // Best score for very fast
	}
	if estimatedLatency >= maxLatency {
		return 0.0 // Worst score for very slow
	}

	// Linear interpolation (inverted - faster is better)
	normalized := 1.0 - ((estimatedLatency - minLatency) / (maxLatency - minLatency))
	return math.Max(0, math.Min(1, normalized))
}

// calculateQualityScore calculates quality score (0-1, higher is better)
func (ms *ModelScorer) calculateQualityScore(model types.Model) float64 {
	// Quality estimation based on model name and provider
	// This is simplified - in production, you'd have quality benchmarks

	qualityMap := map[string]float64{
		// OpenAI models
		"gpt-4":         1.0, // Best quality
		"gpt-4-turbo":   0.95,
		"gpt-3.5-turbo": 0.70,
		"gpt-3.5":       0.65,

		// Anthropic models
		"claude-3-opus":   0.98,
		"claude-3-sonnet": 0.85,
		"claude-3-haiku":  0.75,

		// Local/Open source models
		"llama-3-70b": 0.80,
		"llama-3-8b":  0.60,
		"mistral-7b":  0.55,
	}

	// Check if we have a quality score for this model
	for key, quality := range qualityMap {
		if contains(model.Name, key) {
			return quality
		}
	}

	// Default quality score based on provider
	switch model.Provider {
	case "openai":
		return 0.75
	case "anthropic":
		return 0.80
	case "local":
		return 0.60
	default:
		return 0.50
	}
}

// estimateLatency estimates typical latency for a model
func (ms *ModelScorer) estimateLatency(model types.Model) float64 {
	// Latency estimation based on model characteristics
	latencyMap := map[string]float64{
		// OpenAI models (API latency)
		"gpt-4":         1500, // Slower but better
		"gpt-4-turbo":   800,
		"gpt-3.5-turbo": 400, // Faster

		// Anthropic models (API latency)
		"claude-3-opus":   1200,
		"claude-3-sonnet": 600,
		"claude-3-haiku":  300,

		// Local models (depends on hardware, assuming good GPU)
		"llama-3-70b": 2000, // Large model, slower
		"llama-3-8b":  400,  // Smaller, faster
	}

	// Check if we have latency data for this model
	for key, latency := range latencyMap {
		if contains(model.Name, key) {
			return latency
		}
	}

	// Default latency based on provider
	switch model.Provider {
	case "openai":
		return 800
	case "anthropic":
		return 700
	case "local":
		return 1000
	default:
		return 1500
	}
}
