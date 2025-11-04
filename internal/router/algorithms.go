package router

import (
	"errors"
	"sync"

	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// RoutingAlgorithm interface for different routing strategies
type RoutingAlgorithm interface {
	SelectModel(models []types.Model, analysis *PromptAnalysis) (*types.Model, error)
}

// RoundRobinAlgorithm distributes requests evenly across models
type RoundRobinAlgorithm struct {
	currentIndex int
	mu           sync.Mutex
}

// NewRoundRobinAlgorithm creates a new round-robin algorithm
func NewRoundRobinAlgorithm() *RoundRobinAlgorithm {
	return &RoundRobinAlgorithm{
		currentIndex: 0,
	}
}

// SelectModel selects the next model in round-robin fashion
func (rr *RoundRobinAlgorithm) SelectModel(models []types.Model, analysis *PromptAnalysis) (*types.Model, error) {
	rr.mu.Lock()
	defer rr.mu.Unlock()

	// Filter available models
	availableModels := filterAvailableModels(models)
	if len(availableModels) == 0 {
		return nil, errors.New("no available models")
	}

	// Select current model
	model := availableModels[rr.currentIndex]

	// Move to next index
	rr.currentIndex = (rr.currentIndex + 1) % len(availableModels)

	return &model, nil
}

// LeastCostAlgorithm selects the cheapest available model
type LeastCostAlgorithm struct {
	scorer *ModelScorer
}

// NewLeastCostAlgorithm creates a new least-cost algorithm
func NewLeastCostAlgorithm() *LeastCostAlgorithm {
	return &LeastCostAlgorithm{
		scorer: CostOptimizedScorer(),
	}
}

// SelectModel selects the model with lowest cost
func (lc *LeastCostAlgorithm) SelectModel(models []types.Model, analysis *PromptAnalysis) (*types.Model, error) {
	availableModels := filterAvailableModels(models)
	if len(availableModels) == 0 {
		return nil, errors.New("no available models")
	}

	// Score all models (cost-optimized)
	scores := lc.scorer.ScoreModels(availableModels, analysis.TokenCount)
	if len(scores) == 0 {
		return nil, errors.New("no models could be scored")
	}

	// Return model with highest score (cheapest)
	return &scores[0].Model, nil
}

// LeastLatencyAlgorithm selects the fastest available model
type LeastLatencyAlgorithm struct {
	scorer *ModelScorer
}

// NewLeastLatencyAlgorithm creates a new least-latency algorithm
func NewLeastLatencyAlgorithm() *LeastLatencyAlgorithm {
	return &LeastLatencyAlgorithm{
		scorer: SpeedOptimizedScorer(),
	}
}

// SelectModel selects the model with lowest latency
func (ll *LeastLatencyAlgorithm) SelectModel(models []types.Model, analysis *PromptAnalysis) (*types.Model, error) {
	availableModels := filterAvailableModels(models)
	if len(availableModels) == 0 {
		return nil, errors.New("no available models")
	}

	// Score all models (speed-optimized)
	scores := ll.scorer.ScoreModels(availableModels, analysis.TokenCount)
	if len(scores) == 0 {
		return nil, errors.New("no models could be scored")
	}

	// Return model with highest score (fastest)
	return &scores[0].Model, nil
}

// BestQualityAlgorithm selects the highest quality available model
type BestQualityAlgorithm struct {
	scorer *ModelScorer
}

// NewBestQualityAlgorithm creates a new best-quality algorithm
func NewBestQualityAlgorithm() *BestQualityAlgorithm {
	return &BestQualityAlgorithm{
		scorer: QualityOptimizedScorer(),
	}
}

// SelectModel selects the model with highest quality
func (bq *BestQualityAlgorithm) SelectModel(models []types.Model, analysis *PromptAnalysis) (*types.Model, error) {
	availableModels := filterAvailableModels(models)
	if len(availableModels) == 0 {
		return nil, errors.New("no available models")
	}

	// Score all models (quality-optimized)
	scores := bq.scorer.ScoreModels(availableModels, analysis.TokenCount)
	if len(scores) == 0 {
		return nil, errors.New("no models could be scored")
	}

	// Return model with highest score (best quality)
	return &scores[0].Model, nil
}

// SmartAlgorithm selects model based on prompt complexity
type SmartAlgorithm struct {
	costScorer     *ModelScorer
	balancedScorer *ModelScorer
	qualityScorer  *ModelScorer
}

// NewSmartAlgorithm creates a new smart algorithm
func NewSmartAlgorithm() *SmartAlgorithm {
	return &SmartAlgorithm{
		costScorer:     CostOptimizedScorer(),
		balancedScorer: DefaultScorer(),
		qualityScorer:  QualityOptimizedScorer(),
	}
}

// SelectModel selects model based on complexity analysis
func (sa *SmartAlgorithm) SelectModel(models []types.Model, analysis *PromptAnalysis) (*types.Model, error) {
	availableModels := filterAvailableModels(models)
	if len(availableModels) == 0 {
		return nil, errors.New("no available models")
	}

	var scores []ModelScore

	// Select scoring strategy based on complexity
	switch analysis.Complexity {
	case ComplexityLow:
		// For simple prompts, prioritize cost
		scores = sa.costScorer.ScoreModels(availableModels, analysis.TokenCount)

	case ComplexityMedium:
		// For medium prompts, use balanced approach
		scores = sa.balancedScorer.ScoreModels(availableModels, analysis.TokenCount)

	case ComplexityHigh:
		// For complex prompts, prioritize quality
		scores = sa.qualityScorer.ScoreModels(availableModels, analysis.TokenCount)

	default:
		// Default to balanced
		scores = sa.balancedScorer.ScoreModels(availableModels, analysis.TokenCount)
	}

	if len(scores) == 0 {
		return nil, errors.New("no models could be scored")
	}

	// Return highest scoring model
	return &scores[0].Model, nil
}

// WeightedRoundRobinAlgorithm distributes based on model weights
type WeightedRoundRobinAlgorithm struct {
	weights      map[string]int // Model name -> weight
	currentIndex int
	sequence     []string // Expanded sequence based on weights
	mu           sync.Mutex
}

// NewWeightedRoundRobinAlgorithm creates a weighted round-robin algorithm
func NewWeightedRoundRobinAlgorithm(weights map[string]int) *WeightedRoundRobinAlgorithm {
	// Build sequence based on weights
	sequence := make([]string, 0)
	for modelName, weight := range weights {
		for i := 0; i < weight; i++ {
			sequence = append(sequence, modelName)
		}
	}

	return &WeightedRoundRobinAlgorithm{
		weights:      weights,
		currentIndex: 0,
		sequence:     sequence,
	}
}

// SelectModel selects model based on weighted distribution
func (wrr *WeightedRoundRobinAlgorithm) SelectModel(models []types.Model, analysis *PromptAnalysis) (*types.Model, error) {
	wrr.mu.Lock()
	defer wrr.mu.Unlock()

	availableModels := filterAvailableModels(models)
	if len(availableModels) == 0 {
		return nil, errors.New("no available models")
	}

	if len(wrr.sequence) == 0 {
		return nil, errors.New("no weighted sequence configured")
	}

	// Get model name from sequence
	targetModelName := wrr.sequence[wrr.currentIndex]

	// Find matching model
	for _, model := range availableModels {
		if model.Name == targetModelName {
			// Move to next in sequence
			wrr.currentIndex = (wrr.currentIndex + 1) % len(wrr.sequence)
			return &model, nil
		}
	}

	// If target model not available, fall back to first available
	wrr.currentIndex = (wrr.currentIndex + 1) % len(wrr.sequence)
	return &availableModels[0], nil
}

// Helper functions

// filterAvailableModels returns only available models
func filterAvailableModels(models []types.Model) []types.Model {
	available := make([]types.Model, 0)
	for _, model := range models {
		if model.Available {
			available = append(available, model)
		}
	}
	return available
}

// GetAlgorithm returns the appropriate algorithm for a strategy
func GetAlgorithm(strategy RoutingStrategy) RoutingAlgorithm {
	switch strategy {
	case StrategyRoundRobin:
		return NewRoundRobinAlgorithm()
	case StrategyLeastCost:
		return NewLeastCostAlgorithm()
	case StrategyLeastLatency:
		return NewLeastLatencyAlgorithm()
	case StrategyBestQuality:
		return NewBestQualityAlgorithm()
	case StrategySmart:
		return NewSmartAlgorithm()
	default:
		return NewSmartAlgorithm() // Default to smart
	}
}
