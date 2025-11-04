package router

import (
	"context"
	"fmt"
	"math"
	"math/rand/v2"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// RetryConfig holds retry configuration
type RetryConfig struct {
	MaxAttempts  int           // Maximum number of attempts (including first try)
	InitialDelay time.Duration // Initial delay before first retry
	MaxDelay     time.Duration // Maximum delay between retries
	Multiplier   float64       // Backoff multiplier
	Jitter       bool          // Add randomness to delay
}

// DefaultRetryConfig returns default retry configuration
func DefaultRetryConfig() RetryConfig {
	return RetryConfig{
		MaxAttempts:  3,
		InitialDelay: 100 * time.Millisecond,
		MaxDelay:     5 * time.Second,
		Multiplier:   2.0,
		Jitter:       true,
	}
}

// RetryStrategy executes a function with retry logic
type RetryStrategy struct {
	config RetryConfig
}

// NewRetryStrategy creates a new retry strategy
func NewRetryStrategy(config RetryConfig) *RetryStrategy {
	if config.MaxAttempts == 0 {
		config.MaxAttempts = 3
	}
	if config.InitialDelay == 0 {
		config.InitialDelay = 100 * time.Millisecond
	}
	if config.MaxDelay == 0 {
		config.MaxDelay = 5 * time.Second
	}
	if config.Multiplier == 0 {
		config.Multiplier = 2.0
	}

	return &RetryStrategy{
		config: config,
	}
}

// Execute executes a function with retry logic
func (rs *RetryStrategy) Execute(ctx context.Context, fn func() error) error {
	var lastErr error

	for attempt := 1; attempt <= rs.config.MaxAttempts; attempt++ {
		// Check context cancellation
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Execute the function
		err := fn()

		if err == nil {
			// Success!
			if attempt > 1 {
				utils.Info("Retry successful on attempt %d/%d", attempt, rs.config.MaxAttempts)
			}
			return nil
		}

		// Function failed
		lastErr = err
		utils.Warn("Attempt %d/%d failed: %v", attempt, rs.config.MaxAttempts, err)

		// Don't retry if this was the last attempt
		if attempt == rs.config.MaxAttempts {
			break
		}

		// Calculate backoff delay
		delay := rs.calculateDelay(attempt)
		utils.Debug("Waiting %v before retry attempt %d", delay, attempt+1)

		// Wait before retrying
		select {
		case <-time.After(delay):
			// Continue to next attempt
		case <-ctx.Done():
			return ctx.Err()
		}
	}

	// All attempts failed
	if lastErr != nil {
		return fmt.Errorf("all %d attempts failed, last error: %w", rs.config.MaxAttempts, lastErr)
	}
	return fmt.Errorf("all %d attempts failed with unknown error", rs.config.MaxAttempts)
}

// calculateDelay calculates the delay before the next retry
func (rs *RetryStrategy) calculateDelay(attempt int) time.Duration {
	// Exponential backoff formula: initialDelay * (multiplier ^ (attempt - 1))
	delay := float64(rs.config.InitialDelay) * math.Pow(rs.config.Multiplier, float64(attempt-1))

	// Cap at max delay
	if delay > float64(rs.config.MaxDelay) {
		delay = float64(rs.config.MaxDelay)
	}

	// Add jitter if enabled (randomness to prevent thundering herd)
	if rs.config.Jitter {
		jitterAmount := delay * 0.3 // +/- 30% jitter
		jitter := (rand.Float64() - 0.5) * 2 * jitterAmount
		delay += jitter
	}

	// Ensure delay is positive
	if delay < 0 {
		delay = float64(rs.config.InitialDelay)
	}

	return time.Duration(delay)
}

// ExecuteWithResult executes a function that returns a result
func (rs *RetryStrategy) ExecuteWithResult(ctx context.Context, fn func() (interface{}, error)) (interface{}, error) {
	var lastErr error
	var result interface{} = nil

	for attempt := 1; attempt <= rs.config.MaxAttempts; attempt++ {
		// Check context cancellation
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		// Execute the function
		result, lastErr = fn()

		if lastErr == nil {
			// Success!
			if attempt > 1 {
				utils.Info("Retry successful on attempt %d/%d", attempt, rs.config.MaxAttempts)
			}
			return result, nil
		}

		// Function failed
		utils.Warn("Attempt %d/%d failed: %v", attempt, rs.config.MaxAttempts, lastErr)

		// Don't retry if this was the last attempt
		if attempt == rs.config.MaxAttempts {
			break
		}

		// Calculate backoff delay
		delay := rs.calculateDelay(attempt)
		utils.Debug("Waiting %v before retry attempt %d", delay, attempt+1)

		// Wait before retrying
		select {
		case <-time.After(delay):
			// Continue to next attempt
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	// All attempts failed
	if lastErr != nil {
		return nil, fmt.Errorf("all %d attempts failed, last error: %w", rs.config.MaxAttempts, lastErr)
	}
	return nil, fmt.Errorf("all %d attempts failed with unknown error", rs.config.MaxAttempts)
}

// ShouldRetry determines if an error is retryable
func ShouldRetry(err error) bool {
	if err == nil {
		return false
	}

	// List of retryable error patterns
	retryableErrors := []string{
		"timeout",
		"connection refused",
		"connection reset",
		"temporarily unavailable",
		"rate limit",
		"too many requests",
		"503",
		"504",
	}

	errStr := err.Error()
	for _, pattern := range retryableErrors {
		if contains(errStr, pattern) {
			return true
		}
	}

	return false
}

// RetryableFunc wraps a function with retry logic
func RetryableFunc(ctx context.Context, config RetryConfig, fn func() error) error {
	strategy := NewRetryStrategy(config)
	return strategy.Execute(ctx, fn)
}

// RetryableFuncWithResult wraps a function with retry logic and returns result
func RetryableFuncWithResult(ctx context.Context, config RetryConfig, fn func() (interface{}, error)) (interface{}, error) {
	strategy := NewRetryStrategy(config)
	return strategy.ExecuteWithResult(ctx, fn)
}
