package router

import (
	"context"
	"fmt"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// ModelChain represents a sequence of model operations
type ModelChain struct {
	Name  string
	Steps []ChainStep
	Stats *ChainStats
}

// ChainStep represents a single step in the chain
type ChainStep struct {
	Name        string
	ModelID     string
	Type        StepType
	Transform   TransformFunc
	Condition   ConditionFunc
	Aggregation AggregationFunc
	Timeout     time.Duration
	Optional    bool // If true, failure doesn't break the chain
}

// StepType defines the type of chain step
type StepType string

const (
	StepTypeSequential StepType = "sequential" // Execute one after another
	StepTypeParallel   StepType = "parallel"   // Execute concurrently
	StepTypeConditional StepType = "conditional" // Execute based on condition
	StepTypeAggregate  StepType = "aggregate"   // Combine multiple results
)

// TransformFunc transforms input before sending to next step
type TransformFunc func(input string, previousResult string) string

// ConditionFunc determines if a step should execute
type ConditionFunc func(input string, previousResults []ChainStepResult) bool

// AggregationFunc combines multiple results
type AggregationFunc func(results []ChainStepResult) string

// ChainStepResult represents the result of a chain step
type ChainStepResult struct {
	StepName  string
	ModelID   string
	Input     string
	Output    string
	Error     error
	Duration  time.Duration
	Timestamp time.Time
	Skipped   bool
}

// ChainStats tracks chain execution statistics
type ChainStats struct {
	TotalExecutions   int64
	SuccessfulChains  int64
	FailedChains      int64
	AvgExecutionTime  time.Duration
	StepStats         map[string]*StepStats
}

// StepStats tracks statistics for individual steps
type StepStats struct {
	Executions int64
	Successes  int64
	Failures   int64
	Skipped    int64
	AvgDuration time.Duration
}

// NewModelChain creates a new model chain
func NewModelChain(name string) *ModelChain {
	return &ModelChain{
		Name:  name,
		Steps: make([]ChainStep, 0),
		Stats: &ChainStats{
			StepStats: make(map[string]*StepStats),
		},
	}
}

// AddStep adds a step to the chain
func (mc *ModelChain) AddStep(step ChainStep) *ModelChain {
	mc.Steps = append(mc.Steps, step)
	if mc.Stats.StepStats[step.Name] == nil {
		mc.Stats.StepStats[step.Name] = &StepStats{}
	}
	return mc
}

// Execute runs the model chain
func (mc *ModelChain) Execute(ctx context.Context, input string, executor ChainExecutor) (*ChainExecutionResult, error) {
	startTime := time.Now()
	mc.Stats.TotalExecutions++

	utils.Info("Executing model chain", "chain", mc.Name, "steps", len(mc.Steps))

	results := make([]ChainStepResult, 0, len(mc.Steps))
	currentInput := input

	for i, step := range mc.Steps {
		utils.Debug("Executing chain step", "chain", mc.Name, "step", step.Name, "index", i)

		// Check if step should be executed (conditional)
		if step.Condition != nil && !step.Condition(currentInput, results) {
			utils.Debug("Step skipped due to condition", "step", step.Name)
			results = append(results, ChainStepResult{
				StepName:  step.Name,
				ModelID:   step.ModelID,
				Input:     currentInput,
				Skipped:   true,
				Timestamp: time.Now(),
			})
			mc.Stats.StepStats[step.Name].Skipped++
			continue
		}

		// Apply transformation if provided
		if step.Transform != nil {
			previousResult := ""
			if len(results) > 0 && !results[len(results)-1].Skipped {
				previousResult = results[len(results)-1].Output
			}
			currentInput = step.Transform(currentInput, previousResult)
		}

		// Execute the step
		stepResult := mc.executeStep(ctx, step, currentInput, executor)
		results = append(results, stepResult)

		// Update statistics
		stats := mc.Stats.StepStats[step.Name]
		stats.Executions++
		if stepResult.Error != nil {
			stats.Failures++
			if !step.Optional {
				// Non-optional step failed, abort chain
				mc.Stats.FailedChains++
				return &ChainExecutionResult{
					ChainName:   mc.Name,
					Input:       input,
					StepResults: results,
					Success:     false,
					Error:       fmt.Errorf("chain step %s failed: %w", step.Name, stepResult.Error),
					Duration:    time.Since(startTime),
				}, stepResult.Error
			}
		} else {
			stats.Successes++
			// Use output as input for next step
			currentInput = stepResult.Output
		}
	}

	mc.Stats.SuccessfulChains++
	duration := time.Since(startTime)

	// Calculate final output (last successful step)
	finalOutput := ""
	for i := len(results) - 1; i >= 0; i-- {
		if !results[i].Skipped && results[i].Error == nil {
			finalOutput = results[i].Output
			break
		}
	}

	utils.Info("Model chain completed", "chain", mc.Name, "duration_ms", duration.Milliseconds())

	return &ChainExecutionResult{
		ChainName:   mc.Name,
		Input:       input,
		Output:      finalOutput,
		StepResults: results,
		Success:     true,
		Duration:    duration,
	}, nil
}

// executeStep executes a single step in the chain
func (mc *ModelChain) executeStep(ctx context.Context, step ChainStep, input string, executor ChainExecutor) ChainStepResult {
	startTime := time.Now()

	// Apply timeout if specified
	if step.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, step.Timeout)
		defer cancel()
	}

	// Execute through the executor interface
	output, err := executor.ExecuteModel(ctx, step.ModelID, input)

	return ChainStepResult{
		StepName:  step.Name,
		ModelID:   step.ModelID,
		Input:     input,
		Output:    output,
		Error:     err,
		Duration:  time.Since(startTime),
		Timestamp: time.Now(),
		Skipped:   false,
	}
}

// ChainExecutionResult represents the result of executing a chain
type ChainExecutionResult struct {
	ChainName   string
	Input       string
	Output      string
	StepResults []ChainStepResult
	Success     bool
	Error       error
	Duration    time.Duration
}

// ChainExecutor interface for executing models
type ChainExecutor interface {
	ExecuteModel(ctx context.Context, modelID string, prompt string) (string, error)
}

// GetStats returns chain statistics
func (mc *ModelChain) GetStats() *ChainStats {
	return mc.Stats
}

// Common transformation functions

// PrefixTransform adds a prefix to the input
func PrefixTransform(prefix string) TransformFunc {
	return func(input string, previousResult string) string {
		return prefix + input
	}
}

// SuffixTransform adds a suffix to the input
func SuffixTransform(suffix string) TransformFunc {
	return func(input string, previousResult string) string {
		return input + suffix
	}
}

// ChainPreviousResultTransform uses previous step's output as input
func ChainPreviousResultTransform() TransformFunc {
	return func(input string, previousResult string) string {
		if previousResult != "" {
			return previousResult
		}
		return input
	}
}

// TemplateTransform applies a template with placeholders
func TemplateTransform(template string) TransformFunc {
	return func(input string, previousResult string) string {
		// Simple template: {input} and {previous}
		result := template
		result = replaceAll(result, "{input}", input)
		result = replaceAll(result, "{previous}", previousResult)
		return result
	}
}

// Common condition functions

// AlwaysExecuteCondition always returns true
func AlwaysExecuteCondition() ConditionFunc {
	return func(input string, previousResults []ChainStepResult) bool {
		return true
	}
}

// OnlyIfPreviousSucceededCondition executes only if previous step succeeded
func OnlyIfPreviousSucceededCondition() ConditionFunc {
	return func(input string, previousResults []ChainStepResult) bool {
		if len(previousResults) == 0 {
			return true
		}
		last := previousResults[len(previousResults)-1]
		return last.Error == nil && !last.Skipped
	}
}

// OnlyIfContainsCondition executes only if input contains a substring
func OnlyIfContainsCondition(substring string) ConditionFunc {
	return func(input string, previousResults []ChainStepResult) bool {
		return stringContains(input, substring)
	}
}

// Helper functions

func replaceAll(s, old, new string) string {
	result := ""
	for i := 0; i < len(s); i++ {
		if i+len(old) <= len(s) && s[i:i+len(old)] == old {
			result += new
			i += len(old) - 1
		} else {
			result += string(s[i])
		}
	}
	return result
}

func stringContains(s, substr string) bool {
	return len(s) >= len(substr) && stringIndexOf(s, substr) >= 0
}

func stringIndexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
