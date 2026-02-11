package router

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// Orchestrator manages multi-model orchestration (Day 8)
type Orchestrator struct {
	router    *Router
	chains    map[string]*ModelChain
	composer  *ModelComposer
	executor  *ModelExecutor
	stats     *OrchestrationStats
	mu        sync.RWMutex
}

// OrchestrationStats tracks orchestration statistics
type OrchestrationStats struct {
	TotalRequests      int64
	ChainExecutions    int64
	CompositionCount   int64
	ParallelExecutions int64
	AvgExecutionTime   time.Duration
	Failures           int64
}

// NewOrchestrator creates a new orchestrator
func NewOrchestrator(router *Router) *Orchestrator {
	return &Orchestrator{
		router:   router,
		chains:   make(map[string]*ModelChain),
		composer: NewModelComposer(),
		executor: NewModelExecutor(),
		stats:    &OrchestrationStats{},
	}
}

// RegisterChain registers a model chain
func (o *Orchestrator) RegisterChain(chain *ModelChain) {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.chains[chain.Name] = chain
	utils.Info("Registered model chain", "name", chain.Name, "steps", len(chain.Steps))
}

// ExecuteChain executes a registered chain
func (o *Orchestrator) ExecuteChain(ctx context.Context, chainName string, input string) (*ChainExecutionResult, error) {
	startTime := time.Now()
	o.stats.TotalRequests++
	o.stats.ChainExecutions++

	o.mu.RLock()
	chain, exists := o.chains[chainName]
	o.mu.RUnlock()

	if !exists {
		o.stats.Failures++
		return nil, fmt.Errorf("chain not found: %s", chainName)
	}

	result, err := chain.Execute(ctx, input, o.executor)
	o.stats.AvgExecutionTime = time.Since(startTime)

	if err != nil {
		o.stats.Failures++
	}

	return result, err
}

// ExecuteParallelComposition executes multiple models in parallel and composes results
func (o *Orchestrator) ExecuteParallelComposition(ctx context.Context, modelIDs []string, input string, strategy string) (string, error) {
	startTime := time.Now()
	o.stats.TotalRequests++
	o.stats.ParallelExecutions++
	o.stats.CompositionCount++

	utils.Info("Executing parallel composition", "models", len(modelIDs), "strategy", strategy)

	// Execute models in parallel
	results := o.composer.ExecuteParallel(ctx, modelIDs, input, o.executor)

	// Compose results
	output, err := o.composer.Compose(ctx, results, strategy)
	o.stats.AvgExecutionTime = time.Since(startTime)

	if err != nil {
		o.stats.Failures++
		return "", err
	}

	return output, nil
}

// ConditionalRoute routes based on custom conditions
func (o *Orchestrator) ConditionalRoute(ctx context.Context, input string, conditions []RouteCondition) (string, error) {
	startTime := time.Now()
	o.stats.TotalRequests++

	// Evaluate conditions in order
	for _, condition := range conditions {
		if condition.Evaluate(input) {
			utils.Info("Condition matched", "name", condition.Name, "model", condition.ModelID)
			output, err := o.executor.ExecuteModel(ctx, condition.ModelID, input)
			o.stats.AvgExecutionTime = time.Since(startTime)

			if err != nil {
				o.stats.Failures++
				// Try next condition if this fails
				continue
			}

			return output, nil
		}
	}

	o.stats.Failures++
	return "", fmt.Errorf("no condition matched for input")
}

// GetStats returns orchestration statistics
func (o *Orchestrator) GetStats() *OrchestrationStats {
	return o.stats
}

// RouteCondition represents a routing condition
type RouteCondition struct {
	Name     string
	ModelID  string
	Evaluate func(input string) bool
}

// ModelExecutor executes model requests
type ModelExecutor struct {
	cache     map[string]string // Simple cache for testing
	cacheMu   sync.RWMutex
	callCount int64
}

// NewModelExecutor creates a new model executor
func NewModelExecutor() *ModelExecutor {
	return &ModelExecutor{
		cache: make(map[string]string),
	}
}

// ExecuteModel executes a model request (implements ChainExecutor interface)
func (me *ModelExecutor) ExecuteModel(ctx context.Context, modelID string, prompt string) (string, error) {
	me.callCount++

	// Check cache
	cacheKey := fmt.Sprintf("%s:%s", modelID, prompt)
	me.cacheMu.RLock()
	if cached, ok := me.cache[cacheKey]; ok {
		me.cacheMu.RUnlock()
		utils.Debug("Model cache hit", "model", modelID)
		return cached, nil
	}
	me.cacheMu.RUnlock()

	// Simulate model execution
	utils.Debug("Executing model", "model", modelID, "prompt_length", len(prompt))

	// In production, this would call the actual model
	// For now, return a simulated response
	response := fmt.Sprintf("[Model %s Response] Processed: %s", modelID, truncate(prompt, 50))

	// Cache the result
	me.cacheMu.Lock()
	me.cache[cacheKey] = response
	me.cacheMu.Unlock()

	return response, nil
}

// GetCallCount returns the number of model calls made
func (me *ModelExecutor) GetCallCount() int64 {
	return me.callCount
}

// ClearCache clears the execution cache
func (me *ModelExecutor) ClearCache() {
	me.cacheMu.Lock()
	defer me.cacheMu.Unlock()
	me.cache = make(map[string]string)
}

// Helper functions

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}

// Common route conditions

// LengthBasedCondition routes based on input length
func LengthBasedCondition(name string, minLen, maxLen int, modelID string) RouteCondition {
	return RouteCondition{
		Name:    name,
		ModelID: modelID,
		Evaluate: func(input string) bool {
			length := len(input)
			return length >= minLen && (maxLen == 0 || length <= maxLen)
		},
	}
}

// KeywordBasedCondition routes if input contains specific keywords
func KeywordBasedCondition(name string, keywords []string, modelID string) RouteCondition {
	return RouteCondition{
		Name:    name,
		ModelID: modelID,
		Evaluate: func(input string) bool {
			for _, keyword := range keywords {
				if stringContains(input, keyword) {
					return true
				}
			}
			return false
		},
	}
}

// ComplexityBasedCondition routes based on complexity (simple heuristic)
func ComplexityBasedCondition(name string, minComplexity int, modelID string) RouteCondition {
	return RouteCondition{
		Name:    name,
		ModelID: modelID,
		Evaluate: func(input string) bool {
			// Simple complexity: number of words + special chars
			words := 1
			specialChars := 0
			for _, ch := range input {
				if ch == ' ' {
					words++
				}
				if !isAlphanumeric(ch) && ch != ' ' {
					specialChars++
				}
			}
			complexity := words + specialChars/2
			return complexity >= minComplexity
		},
	}
}

func isAlphanumeric(ch rune) bool {
	return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9')
}
