package router

import (
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// RoutingStrategy defines how to select a model
type RoutingStrategy string

const (
	StrategyRoundRobin   RoutingStrategy = "round-robin"
	StrategyLeastCost    RoutingStrategy = "least-cost"
	StrategyLeastLatency RoutingStrategy = "least-latency"
	StrategyBestQuality  RoutingStrategy = "best-quality"
	StrategySmart        RoutingStrategy = "smart"
)

// ComplexityLevel represents the difficulty of a prompt
type ComplexityLevel string

const (
	ComplexityLow    ComplexityLevel = "low"
	ComplexityMedium ComplexityLevel = "medium"
	ComplexityHigh   ComplexityLevel = "high"
)

// ModelScore represents a model with its calculated score
type ModelScore struct {
	Model types.Model
	Score float64
}

// RoutingDecision contains information about routing decision
type RoutingDecision struct {
	SelectedModel types.Model
	Strategy      RoutingStrategy
	Complexity    ComplexityLevel
	Score         float64
	Reason        string
	Timestamp     time.Time
}

// RoutingConfig holds configuration for the router
type RoutingConfig struct {
	Strategy            RoutingStrategy
	EnableFallback      bool
	EnableCircuitBreak  bool
	MaxRetries          int
	RetryDelay          time.Duration
	HealthCheckEnabled  bool
	HealthCheckInterval time.Duration
}

// PromptAnalysis contains analysis results of a prompt
type PromptAnalysis struct {
	TokenCount       int
	Complexity       ComplexityLevel
	HasCode          bool
	HasTechnical     bool
	EstimatedCost    float64
	RecommendedModel string
}

// DefaultConfig returns default routing configuration
func DefaultConfig() *RoutingConfig {
	return &RoutingConfig{
		Strategy:            StrategySmart,
		EnableFallback:      true,
		EnableCircuitBreak:  true,
		MaxRetries:          3,
		RetryDelay:          100 * time.Millisecond,
		HealthCheckEnabled:  true,
		HealthCheckInterval: 30 * time.Second,
	}
}
