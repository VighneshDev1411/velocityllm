package router

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// ModelComposer handles composition of multiple model outputs
type ModelComposer struct {
	strategies map[string]CompositionStrategy
	stats      *CompositionStats
	mu         sync.RWMutex
}

// CompositionStrategy defines how to combine model outputs
type CompositionStrategy interface {
	Compose(results []ModelResult) (string, error)
	Name() string
}

// ModelResult represents a result from a single model
type ModelResult struct {
	ModelID  string
	Input    string
	Output   string
	Error    error
	Duration time.Duration
	Score    float64 // Quality/confidence score
}

// CompositionStats tracks composition statistics
type CompositionStats struct {
	TotalCompositions int64
	ByStrategy        map[string]int64
	AvgDuration       time.Duration
	Failures          int64
}

// NewModelComposer creates a new model composer
func NewModelComposer() *ModelComposer {
	mc := &ModelComposer{
		strategies: make(map[string]CompositionStrategy),
		stats: &CompositionStats{
			ByStrategy: make(map[string]int64),
		},
	}

	// Register default strategies
	mc.RegisterStrategy(&FirstSuccessfulStrategy{})
	mc.RegisterStrategy(&BestScoreStrategy{})
	mc.RegisterStrategy(&MajorityVoteStrategy{})
	mc.RegisterStrategy(&ConcatenateStrategy{})
	mc.RegisterStrategy(&AverageStrategy{})
	mc.RegisterStrategy(&WeightedAverageStrategy{})

	return mc
}

// RegisterStrategy registers a composition strategy
func (mc *ModelComposer) RegisterStrategy(strategy CompositionStrategy) {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	mc.strategies[strategy.Name()] = strategy
	utils.Debug("Registered composition strategy", "name", strategy.Name())
}

// Compose combines multiple model results using the specified strategy
func (mc *ModelComposer) Compose(ctx context.Context, results []ModelResult, strategyName string) (string, error) {
	startTime := time.Now()
	mc.stats.TotalCompositions++

	mc.mu.RLock()
	strategy, exists := mc.strategies[strategyName]
	mc.mu.RUnlock()

	if !exists {
		mc.stats.Failures++
		return "", fmt.Errorf("composition strategy not found: %s", strategyName)
	}

	mc.stats.ByStrategy[strategyName]++

	result, err := strategy.Compose(results)
	if err != nil {
		mc.stats.Failures++
		return "", err
	}

	duration := time.Since(startTime)
	utils.Debug("Composition completed", "strategy", strategyName, "duration_ms", duration.Milliseconds())

	return result, nil
}

// ExecuteParallel executes multiple models in parallel
func (mc *ModelComposer) ExecuteParallel(ctx context.Context, modelIDs []string, input string, executor ChainExecutor) []ModelResult {
	results := make([]ModelResult, len(modelIDs))
	var wg sync.WaitGroup

	for i, modelID := range modelIDs {
		wg.Add(1)
		go func(idx int, mID string) {
			defer wg.Done()

			startTime := time.Now()
			output, err := executor.ExecuteModel(ctx, mID, input)

			results[idx] = ModelResult{
				ModelID:  mID,
				Input:    input,
				Output:   output,
				Error:    err,
				Duration: time.Since(startTime),
				Score:    1.0, // Default score
			}
		}(i, modelID)
	}

	wg.Wait()
	return results
}

// GetStats returns composition statistics
func (mc *ModelComposer) GetStats() *CompositionStats {
	return mc.stats
}

// ========================================
// Built-in Composition Strategies
// ========================================

// FirstSuccessfulStrategy returns the first successful result
type FirstSuccessfulStrategy struct{}

func (s *FirstSuccessfulStrategy) Name() string {
	return "first_successful"
}

func (s *FirstSuccessfulStrategy) Compose(results []ModelResult) (string, error) {
	for _, result := range results {
		if result.Error == nil && result.Output != "" {
			return result.Output, nil
		}
	}
	return "", fmt.Errorf("no successful results found")
}

// BestScoreStrategy returns the result with the highest score
type BestScoreStrategy struct{}

func (s *BestScoreStrategy) Name() string {
	return "best_score"
}

func (s *BestScoreStrategy) Compose(results []ModelResult) (string, error) {
	if len(results) == 0 {
		return "", fmt.Errorf("no results to compose")
	}

	var best *ModelResult
	for i := range results {
		if results[i].Error == nil && (best == nil || results[i].Score > best.Score) {
			best = &results[i]
		}
	}

	if best == nil {
		return "", fmt.Errorf("no successful results found")
	}

	return best.Output, nil
}

// MajorityVoteStrategy returns the most common output
type MajorityVoteStrategy struct{}

func (s *MajorityVoteStrategy) Name() string {
	return "majority_vote"
}

func (s *MajorityVoteStrategy) Compose(results []ModelResult) (string, error) {
	if len(results) == 0 {
		return "", fmt.Errorf("no results to compose")
	}

	// Count occurrences of each output
	counts := make(map[string]int)
	for _, result := range results {
		if result.Error == nil && result.Output != "" {
			counts[result.Output]++
		}
	}

	if len(counts) == 0 {
		return "", fmt.Errorf("no successful results found")
	}

	// Find most common
	var maxCount int
	var majority string
	for output, count := range counts {
		if count > maxCount {
			maxCount = count
			majority = output
		}
	}

	return majority, nil
}

// ConcatenateStrategy concatenates all outputs
type ConcatenateStrategy struct{}

func (s *ConcatenateStrategy) Name() string {
	return "concatenate"
}

func (s *ConcatenateStrategy) Compose(results []ModelResult) (string, error) {
	var combined string
	successCount := 0

	for _, result := range results {
		if result.Error == nil && result.Output != "" {
			if successCount > 0 {
				combined += "\n\n"
			}
			combined += result.Output
			successCount++
		}
	}

	if successCount == 0 {
		return "", fmt.Errorf("no successful results found")
	}

	return combined, nil
}

// AverageStrategy averages numeric outputs
type AverageStrategy struct{}

func (s *AverageStrategy) Name() string {
	return "average"
}

func (s *AverageStrategy) Compose(results []ModelResult) (string, error) {
	// For text, return the middle-length response
	if len(results) == 0 {
		return "", fmt.Errorf("no results to compose")
	}

	var validResults []ModelResult
	for _, result := range results {
		if result.Error == nil && result.Output != "" {
			validResults = append(validResults, result)
		}
	}

	if len(validResults) == 0 {
		return "", fmt.Errorf("no successful results found")
	}

	// Find median length response
	if len(validResults) == 1 {
		return validResults[0].Output, nil
	}

	// Simple approach: return the result closest to average length
	var totalLength int
	for _, r := range validResults {
		totalLength += len(r.Output)
	}
	avgLength := totalLength / len(validResults)

	var closest *ModelResult
	minDiff := -1
	for i := range validResults {
		diff := abs(len(validResults[i].Output) - avgLength)
		if minDiff < 0 || diff < minDiff {
			minDiff = diff
			closest = &validResults[i]
		}
	}

	return closest.Output, nil
}

// WeightedAverageStrategy uses scores as weights
type WeightedAverageStrategy struct{}

func (s *WeightedAverageStrategy) Name() string {
	return "weighted_average"
}

func (s *WeightedAverageStrategy) Compose(results []ModelResult) (string, error) {
	if len(results) == 0 {
		return "", fmt.Errorf("no results to compose")
	}

	var bestScore float64
	var best *ModelResult

	for i := range results {
		if results[i].Error == nil && results[i].Output != "" {
			if best == nil || results[i].Score > bestScore {
				bestScore = results[i].Score
				best = &results[i]
			}
		}
	}

	if best == nil {
		return "", fmt.Errorf("no successful results found")
	}

	return best.Output, nil
}

// Helper functions

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
