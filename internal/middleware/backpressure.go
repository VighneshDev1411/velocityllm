package middleware

import (
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/worker"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// BackpressureHandler manages load shedding and backpressure
type BackpressureHandler struct {
	config           BackpressureConfig
	active           atomic.Bool
	requestsRejected atomic.Int64
	requestsAccepted atomic.Int64
	lastCheck        time.Time
	mu               sync.RWMutex
}

// NewBackpressureHandler creates a new backpressure handler
func NewBackpressureHandler(config BackpressureConfig) *BackpressureHandler {
	bh := &BackpressureHandler{
		config:    config,
		lastCheck: time.Now(),
	}

	utils.Info("Backpressure handler initialized (threshold: %.1f%%)", config.QueueThreshold)
	return bh
}

// ShouldAcceptRequest determines if a request should be accepted
func (bh *BackpressureHandler) ShouldAcceptRequest(priority int) (bool, string) {
	if !bh.config.EnableLoadShedding {
		bh.requestsAccepted.Add(1)
		return true, ""
	}

	// Get current system state
	pool := worker.GetGlobalPool()
	queueSize := pool.GetQueueSize()
	queueCapacity := pool.GetQueueCapacity()
	queueUsage := float64(queueSize) / float64(queueCapacity) * 100

	stats := pool.GetStats()
	workerUtilization := float64(stats.ActiveWorkers) / float64(pool.GetWorkerCount()) * 100

	// Update backpressure status
	bh.updateStatus(queueUsage, workerUtilization)

	// Determine threshold based on configuration
	threshold := bh.config.QueueThreshold
	if bh.config.AdaptiveThreshold {
		threshold = bh.calculateAdaptiveThreshold(workerUtilization)
	}

	// Check if we should shed load
	if queueUsage < threshold {
		// Below threshold, accept all requests
		bh.requestsAccepted.Add(1)
		return true, ""
	}

	// Above threshold, apply load shedding based on priority
	if queueUsage >= 95.0 {
		// Critical: Only accept high priority (VIP)
		if priority >= 10 {
			bh.requestsAccepted.Add(1)
			utils.Debug("Critical load (%.1f%%): accepted high priority request", queueUsage)
			return true, ""
		}
		bh.requestsRejected.Add(1)
		return false, fmt.Sprintf("System critically overloaded (%.1f%% queue usage). Only VIP requests accepted.", queueUsage)
	}

	if queueUsage >= 90.0 {
		// Severe: Only accept normal+ priority
		if priority >= 5 {
			bh.requestsAccepted.Add(1)
			utils.Debug("Severe load (%.1f%%): accepted normal+ priority request", queueUsage)
			return true, ""
		}
		bh.requestsRejected.Add(1)
		return false, fmt.Sprintf("System overloaded (%.1f%% queue usage). Low priority requests rejected.", queueUsage)
	}

	if queueUsage >= threshold && bh.config.RejectLowPriority {
		// Elevated: Reject low priority only
		if priority >= 5 {
			bh.requestsAccepted.Add(1)
			return true, ""
		}
		bh.requestsRejected.Add(1)
		return false, fmt.Sprintf("System under high load (%.1f%% queue usage). Low priority requests rejected.", queueUsage)
	}

	// Default: accept
	bh.requestsAccepted.Add(1)
	return true, ""
}

// updateStatus updates the backpressure status
func (bh *BackpressureHandler) updateStatus(queueUsage, workerUtilization float64) {
	bh.mu.Lock()
	defer bh.mu.Unlock()

	// Determine if backpressure is active
	threshold := bh.config.QueueThreshold
	if bh.config.AdaptiveThreshold {
		threshold = bh.calculateAdaptiveThreshold(workerUtilization)
	}

	wasActive := bh.active.Load()
	isActive := queueUsage >= threshold

	if isActive != wasActive {
		if isActive {
			utils.Warn("Backpressure ACTIVATED (queue usage: %.1f%%, threshold: %.1f%%)",
				queueUsage, threshold)
		} else {
			utils.Info("Backpressure DEACTIVATED (queue usage: %.1f%%)", queueUsage)
		}
	}

	bh.active.Store(isActive)
	bh.lastCheck = time.Now()
}

// calculateAdaptiveThreshold calculates dynamic threshold based on worker utilization
func (bh *BackpressureHandler) calculateAdaptiveThreshold(workerUtilization float64) float64 {
	// If workers are busy, lower the threshold (shed load earlier)
	// If workers are idle, raise the threshold (accept more load)

	baseThreshold := bh.config.QueueThreshold

	if workerUtilization > 90 {
		// Workers maxed out, shed load aggressively
		return baseThreshold * 0.7 // 80% → 56%
	} else if workerUtilization > 75 {
		// Workers busy, shed load moderately
		return baseThreshold * 0.85 // 80% → 68%
	} else if workerUtilization < 50 {
		// Workers idle, can accept more load
		return baseThreshold * 1.2 // 80% → 96%
	}

	return baseThreshold
}

// GetStatus returns current backpressure status
func (bh *BackpressureHandler) GetStatus() BackpressureStatus {
	pool := worker.GetGlobalPool()
	queueSize := pool.GetQueueSize()
	queueCapacity := pool.GetQueueCapacity()
	queueUsage := float64(queueSize) / float64(queueCapacity) * 100

	stats := pool.GetStats()
	workerUtilization := float64(stats.ActiveWorkers) / float64(pool.GetWorkerCount()) * 100

	reason := ""
	if bh.active.Load() {
		if queueUsage >= 95 {
			reason = "Critical load: Only VIP requests accepted"
		} else if queueUsage >= 90 {
			reason = "Severe load: Low priority requests rejected"
		} else {
			reason = "High load: Some requests may be rejected"
		}
	}

	return BackpressureStatus{
		Active:            bh.active.Load(),
		QueueUsage:        queueUsage,
		WorkerUtilization: workerUtilization,
		RequestsRejected:  bh.requestsRejected.Load(),
		Reason:            reason,
	}
}

// GetStats returns backpressure statistics
func (bh *BackpressureHandler) GetStats() map[string]interface{} {
	status := bh.GetStatus()
	totalRequests := bh.requestsAccepted.Load() + bh.requestsRejected.Load()

	acceptanceRate := float64(0)
	if totalRequests > 0 {
		acceptanceRate = float64(bh.requestsAccepted.Load()) / float64(totalRequests) * 100
	}

	return map[string]interface{}{
		"enabled":            bh.config.EnableLoadShedding,
		"active":             status.Active,
		"queue_usage":        fmt.Sprintf("%.2f%%", status.QueueUsage),
		"worker_utilization": fmt.Sprintf("%.2f%%", status.WorkerUtilization),
		"requests_accepted":  bh.requestsAccepted.Load(),
		"requests_rejected":  bh.requestsRejected.Load(),
		"total_requests":     totalRequests,
		"acceptance_rate":    fmt.Sprintf("%.2f%%", acceptanceRate),
		"threshold":          fmt.Sprintf("%.1f%%", bh.config.QueueThreshold),
		"adaptive_threshold": bh.config.AdaptiveThreshold,
		"reason":             status.Reason,
	}
}

// Reset resets backpressure statistics
func (bh *BackpressureHandler) Reset() {
	bh.requestsRejected.Store(0)
	bh.requestsAccepted.Store(0)
	utils.Info("Backpressure statistics reset")
}

// BackpressureMiddleware returns an HTTP middleware for backpressure handling
func BackpressureMiddleware(bh *BackpressureHandler) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract priority from header (default to normal)
			priority := 5 // Normal priority
			priorityHeader := r.Header.Get("X-Request-Priority")
			if priorityHeader != "" {
				switch priorityHeader {
				case "low":
					priority = 1
				case "normal":
					priority = 5
				case "high":
					priority = 10
				}
			}

			// Check if we can accept the request
			accept, reason := bh.ShouldAcceptRequest(priority)

			if !accept {
				// Reject request with 503 Service Unavailable
				w.Header().Set("Retry-After", "30")
				types.WriteError(w, http.StatusServiceUnavailable, reason)
				utils.Debug("Request rejected by backpressure: %s", reason)
				return
			}

			// Accept request
			next.ServeHTTP(w, r)
		})
	}
}

// CircuitBreaker implements a simple circuit breaker for requests
type CircuitBreaker struct {
	maxFailures     int
	timeout         time.Duration
	failures        atomic.Int64
	lastFailureTime atomic.Value // stores time.Time
	state           atomic.Value // stores string: "closed", "open", "half-open"
	mu              sync.Mutex
}

// NewCircuitBreaker creates a new circuit breaker
func NewCircuitBreaker(maxFailures int, timeout time.Duration) *CircuitBreaker {
	cb := &CircuitBreaker{
		maxFailures: maxFailures,
		timeout:     timeout,
	}
	cb.state.Store("closed")
	cb.lastFailureTime.Store(time.Time{})

	utils.Info("Circuit breaker initialized (max failures: %d, timeout: %s)",
		maxFailures, timeout)
	return cb
}

// Allow checks if a request should be allowed through the circuit breaker
func (cb *CircuitBreaker) Allow() (bool, string) {
	state := cb.state.Load().(string)

	switch state {
	case "open":
		// Check if timeout has passed
		lastFailure := cb.lastFailureTime.Load().(time.Time)
		if time.Since(lastFailure) > cb.timeout {
			// Move to half-open state
			cb.state.Store("half-open")
			utils.Info("Circuit breaker moved to HALF-OPEN state")
			return true, ""
		}
		return false, fmt.Sprintf("Circuit breaker is OPEN (too many failures). Retry after %s",
			cb.timeout-time.Since(lastFailure))

	case "half-open":
		// Allow request to test if system recovered
		return true, ""

	case "closed":
		// Normal operation
		return true, ""

	default:
		return true, ""
	}
}

// RecordSuccess records a successful request
func (cb *CircuitBreaker) RecordSuccess() {
	state := cb.state.Load().(string)

	if state == "half-open" {
		// Success in half-open state, close circuit
		cb.mu.Lock()
		cb.failures.Store(0)
		cb.state.Store("closed")
		cb.mu.Unlock()
		utils.Info("Circuit breaker CLOSED (system recovered)")
	}
}

// RecordFailure records a failed request
func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	failures := cb.failures.Add(1)
	cb.lastFailureTime.Store(time.Now())

	if failures >= int64(cb.maxFailures) {
		state := cb.state.Load().(string)
		if state != "open" {
			cb.state.Store("open")
			utils.Warn("Circuit breaker OPENED (failures: %d)", failures)
		}
	}
}

// GetState returns current circuit breaker state
func (cb *CircuitBreaker) GetState() string {
	return cb.state.Load().(string)
}

// GetStats returns circuit breaker statistics
func (cb *CircuitBreaker) GetStats() map[string]interface{} {
	state := cb.state.Load().(string)
	failures := cb.failures.Load()
	lastFailure := cb.lastFailureTime.Load().(time.Time)

	stats := map[string]interface{}{
		"state":        state,
		"failures":     failures,
		"max_failures": cb.maxFailures,
		"timeout":      cb.timeout.String(),
	}

	if !lastFailure.IsZero() {
		stats["last_failure"] = lastFailure.Format(time.RFC3339)
		stats["time_since_failure"] = time.Since(lastFailure).String()
	}

	return stats
}

// Global backpressure handler
var globalBackpressureHandler *BackpressureHandler
var backpressureOnce sync.Once

// InitGlobalBackpressureHandler initializes the global backpressure handler
func InitGlobalBackpressureHandler(config BackpressureConfig) {
	backpressureOnce.Do(func() {
		globalBackpressureHandler = NewBackpressureHandler(config)
	})
}

// GetGlobalBackpressureHandler returns the global backpressure handler
func GetGlobalBackpressureHandler() *BackpressureHandler {
	if globalBackpressureHandler == nil {
		InitGlobalBackpressureHandler(DefaultBackpressureConfig())
	}
	return globalBackpressureHandler
}
