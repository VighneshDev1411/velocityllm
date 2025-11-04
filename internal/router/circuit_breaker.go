package router

import (
	"errors"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// CircuitState represents the state of a circuit breaker
type CircuitState string

const (
	StateClosed   CircuitState = "closed"    // Normal operation
	StateOpen     CircuitState = "open"      // Blocking requests
	StateHalfOpen CircuitState = "half-open" // Testing recovery
)

// CircuitBreaker protects against cascading failures
type CircuitBreaker struct {
	name             string
	state            CircuitState
	failureCount     int
	successCount     int
	failureThreshold int
	successThreshold int
	timeout          time.Duration
	lastFailureTime  time.Time
	mu               sync.RWMutex
}

// CircuitBreakerConfig holds circuit breaker configuration
type CircuitBreakerConfig struct {
	FailureThreshold int           // Failures before opening
	SuccessThreshold int           // Successes before closing from half-open
	Timeout          time.Duration // Time before attempting recovery
}

// NewCircuitBreaker creates a new circuit breaker
func NewCircuitBreaker(name string, config CircuitBreakerConfig) *CircuitBreaker {
	if config.FailureThreshold == 0 {
		config.FailureThreshold = 5 // Default: 5 failures
	}
	if config.SuccessThreshold == 0 {
		config.SuccessThreshold = 2 // Default: 2 successes
	}
	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second // Default: 30 seconds
	}

	return &CircuitBreaker{
		name:             name,
		state:            StateClosed,
		failureThreshold: config.FailureThreshold,
		successThreshold: config.SuccessThreshold,
		timeout:          config.Timeout,
	}
}

// Call executes a function with circuit breaker protection
func (cb *CircuitBreaker) Call(fn func() error) error {
	// Check if circuit breaker allows the call
	if err := cb.beforeCall(); err != nil {
		return err
	}

	// Execute the function
	err := fn()

	// Record the result
	cb.afterCall(err)

	return err
}

// beforeCall checks if the call should be allowed
func (cb *CircuitBreaker) beforeCall() error {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case StateOpen:
		// Check if timeout has passed
		if time.Since(cb.lastFailureTime) > cb.timeout {
			// Transition to half-open
			cb.state = StateHalfOpen
			cb.successCount = 0
			utils.Info("Circuit breaker [%s]: OPEN → HALF-OPEN (timeout expired)", cb.name)
			return nil
		}
		// Circuit is still open
		return errors.New("circuit breaker is OPEN")

	case StateHalfOpen:
		// Allow the call to test if service has recovered
		return nil

	case StateClosed:
		// Normal operation
		return nil

	default:
		return nil
	}
}

// afterCall records the result of a call
func (cb *CircuitBreaker) afterCall(err error) {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	if err != nil {
		// Call failed
		cb.onFailure()
	} else {
		// Call succeeded
		cb.onSuccess()
	}
}

// onFailure handles a failed call
func (cb *CircuitBreaker) onFailure() {
	cb.failureCount++
	cb.lastFailureTime = time.Now()

	switch cb.state {
	case StateClosed:
		if cb.failureCount >= cb.failureThreshold {
			// Too many failures - open the circuit
			cb.state = StateOpen
			utils.Warn("Circuit breaker [%s]: CLOSED → OPEN (failures: %d/%d)",
				cb.name, cb.failureCount, cb.failureThreshold)
		}

	case StateHalfOpen:
		// Failed during recovery - back to open
		cb.state = StateOpen
		cb.failureCount = 0
		utils.Warn("Circuit breaker [%s]: HALF-OPEN → OPEN (recovery failed)", cb.name)
	}
}

// onSuccess handles a successful call
func (cb *CircuitBreaker) onSuccess() {
	switch cb.state {
	case StateClosed:
		// Reset failure count on success
		cb.failureCount = 0

	case StateHalfOpen:
		cb.successCount++
		if cb.successCount >= cb.successThreshold {
			// Enough successes - close the circuit
			cb.state = StateClosed
			cb.failureCount = 0
			cb.successCount = 0
			utils.Info("Circuit breaker [%s]: HALF-OPEN → CLOSED (recovery successful)", cb.name)
		}
	}
}

// GetState returns the current state
func (cb *CircuitBreaker) GetState() CircuitState {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

// GetStats returns circuit breaker statistics
func (cb *CircuitBreaker) GetStats() map[string]interface{} {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	return map[string]interface{}{
		"name":              cb.name,
		"state":             cb.state,
		"failure_count":     cb.failureCount,
		"success_count":     cb.successCount,
		"failure_threshold": cb.failureThreshold,
		"last_failure":      cb.lastFailureTime,
	}
}

// Reset resets the circuit breaker to closed state
func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.state = StateClosed
	cb.failureCount = 0
	cb.successCount = 0
	utils.Info("Circuit breaker [%s]: RESET to CLOSED", cb.name)
}

// CircuitBreakerManager manages multiple circuit breakers
type CircuitBreakerManager struct {
	breakers map[string]*CircuitBreaker
	config   CircuitBreakerConfig
	mu       sync.RWMutex
}

// NewCircuitBreakerManager creates a new manager
func NewCircuitBreakerManager(config CircuitBreakerConfig) *CircuitBreakerManager {
	return &CircuitBreakerManager{
		breakers: make(map[string]*CircuitBreaker),
		config:   config,
	}
}

// GetBreaker gets or creates a circuit breaker for a model
func (cbm *CircuitBreakerManager) GetBreaker(modelName string) *CircuitBreaker {
	cbm.mu.Lock()
	defer cbm.mu.Unlock()

	if breaker, exists := cbm.breakers[modelName]; exists {
		return breaker
	}

	// Create new circuit breaker
	breaker := NewCircuitBreaker(modelName, cbm.config)
	cbm.breakers[modelName] = breaker
	utils.Info("Created circuit breaker for model: %s", modelName)

	return breaker
}

// GetAllBreakers returns all circuit breakers
func (cbm *CircuitBreakerManager) GetAllBreakers() map[string]*CircuitBreaker {
	cbm.mu.RLock()
	defer cbm.mu.RUnlock()

	// Return a copy to avoid race conditions
	breakers := make(map[string]*CircuitBreaker)
	for name, breaker := range cbm.breakers {
		breakers[name] = breaker
	}
	return breakers
}

// GetAllStats returns statistics for all circuit breakers
func (cbm *CircuitBreakerManager) GetAllStats() []map[string]interface{} {
	cbm.mu.RLock()
	defer cbm.mu.RUnlock()

	stats := make([]map[string]interface{}, 0, len(cbm.breakers))
	for _, breaker := range cbm.breakers {
		stats = append(stats, breaker.GetStats())
	}
	return stats
}

// ResetAll resets all circuit breakers
func (cbm *CircuitBreakerManager) ResetAll() {
	cbm.mu.Lock()
	defer cbm.mu.Unlock()

	for _, breaker := range cbm.breakers {
		breaker.Reset()
	}
	utils.Info("Reset all circuit breakers")
}
