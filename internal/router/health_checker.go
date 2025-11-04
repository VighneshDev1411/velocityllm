package router

import (
	"context"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/database"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// ModelHealth represents the health status of a model
type ModelHealth struct {
	ModelName            string
	Available            bool
	LastCheckTime        time.Time
	LastSuccessTime      time.Time
	LastFailureTime      time.Time
	ConsecutiveFailures  int
	ConsecutiveSuccesses int
	TotalChecks          int
	SuccessfulChecks     int
	FailedChecks         int
	AvgResponseTime      time.Duration
}

// HealthChecker monitors model health
type HealthChecker struct {
	modelRepo        *database.ModelRepository
	healthMap        map[string]*ModelHealth
	checkInterval    time.Duration
	failureThreshold int
	successThreshold int
	mu               sync.RWMutex
	stopChan         chan struct{}
	running          bool
}

// HealthCheckConfig holds health check configuration
type HealthCheckConfig struct {
	CheckInterval    time.Duration // How often to check
	FailureThreshold int           // Failures before marking unavailable
	SuccessThreshold int           // Successes before marking available
	Enabled          bool
}

// DefaultHealthCheckConfig returns default health check configuration
func DefaultHealthCheckConfig() HealthCheckConfig {
	return HealthCheckConfig{
		CheckInterval:    30 * time.Second,
		FailureThreshold: 3,
		SuccessThreshold: 2,
		Enabled:          true,
	}
}

// NewHealthChecker creates a new health checker
func NewHealthChecker(config HealthCheckConfig) *HealthChecker {
	if config.CheckInterval == 0 {
		config.CheckInterval = 30 * time.Second
	}
	if config.FailureThreshold == 0 {
		config.FailureThreshold = 3
	}
	if config.SuccessThreshold == 0 {
		config.SuccessThreshold = 2
	}

	return &HealthChecker{
		modelRepo:        database.NewModelRepository(),
		healthMap:        make(map[string]*ModelHealth),
		checkInterval:    config.CheckInterval,
		failureThreshold: config.FailureThreshold,
		successThreshold: config.SuccessThreshold,
		stopChan:         make(chan struct{}),
		running:          false,
	}
}

// Start begins health checking
func (hc *HealthChecker) Start() {
	hc.mu.Lock()
	if hc.running {
		hc.mu.Unlock()
		return
	}
	hc.running = true
	hc.mu.Unlock()

	utils.Info("Health checker started (interval: %v)", hc.checkInterval)

	// Initial check
	go hc.checkAllModels()

	// Start periodic checks
	go hc.periodicCheck()
}

// Stop stops health checking
func (hc *HealthChecker) Stop() {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	if !hc.running {
		return
	}

	close(hc.stopChan)
	hc.running = false
	utils.Info("Health checker stopped")
}

// periodicCheck runs health checks periodically
func (hc *HealthChecker) periodicCheck() {
	ticker := time.NewTicker(hc.checkInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			hc.checkAllModels()
		case <-hc.stopChan:
			return
		}
	}
}

// checkAllModels checks health of all models
func (hc *HealthChecker) checkAllModels() {
	models, err := hc.modelRepo.GetAll()
	if err != nil {
		utils.Error("Failed to get models for health check: %v", err)
		return
	}

	utils.Debug("Running health checks for %d models", len(models))

	// Check each model
	for _, model := range models {
		go hc.checkModel(model)
	}
}

// checkModel checks health of a single model
func (hc *HealthChecker) checkModel(model types.Model) {
	startTime := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Simulate health check (in real implementation, this would ping the model)
	healthy := hc.pingModel(ctx, model)

	responseTime := time.Since(startTime)

	// Update health status
	hc.updateHealth(model.Name, healthy, responseTime)

	// Update model availability in database if changed
	if healthy && !model.Available {
		hc.markModelAvailable(model.Name)
	} else if !healthy && model.Available {
		// Check if we've hit the failure threshold
		health := hc.GetHealth(model.Name)
		if health != nil && health.ConsecutiveFailures >= hc.failureThreshold {
			hc.markModelUnavailable(model.Name)
		}
	}
}

// pingModel simulates pinging a model (placeholder)
func (hc *HealthChecker) pingModel(ctx context.Context, model types.Model) bool {
	// In real implementation, this would:
	// - For API models: Make a lightweight API call
	// - For local models: Check if service is running

	// Simulate: Most models are healthy
	// For demo purposes, simulate occasional failures

	// GPT-4 and Claude are usually healthy (95% success)
	if model.Provider == "openai" || model.Provider == "anthropic" {
		// 5% failure rate for simulation
		return time.Now().Unix()%20 != 0
	}

	// Local models might be less stable (80% success)
	if model.Provider == "local" {
		// 20% failure rate for simulation
		return time.Now().Unix()%5 != 0
	}

	return true
}

// updateHealth updates health statistics for a model
func (hc *HealthChecker) updateHealth(modelName string, healthy bool, responseTime time.Duration) {
	hc.mu.Lock()
	defer hc.mu.Unlock()

	health, exists := hc.healthMap[modelName]
	if !exists {
		health = &ModelHealth{
			ModelName: modelName,
			Available: true,
		}
		hc.healthMap[modelName] = health
	}

	// Update timestamps
	health.LastCheckTime = time.Now()

	// Update counters
	health.TotalChecks++

	if healthy {
		health.SuccessfulChecks++
		health.ConsecutiveSuccesses++
		health.ConsecutiveFailures = 0
		health.LastSuccessTime = time.Now()

		// Update average response time
		if health.AvgResponseTime == 0 {
			health.AvgResponseTime = responseTime
		} else {
			// Running average
			health.AvgResponseTime = (health.AvgResponseTime + responseTime) / 2
		}

		utils.Debug("Health check passed for %s (response: %v)", modelName, responseTime)

		// If model was marked unavailable and has enough successes, mark available
		if !health.Available && health.ConsecutiveSuccesses >= hc.successThreshold {
			health.Available = true
			utils.Info("Model %s marked AVAILABLE (consecutive successes: %d)",
				modelName, health.ConsecutiveSuccesses)
		}
	} else {
		health.FailedChecks++
		health.ConsecutiveFailures++
		health.ConsecutiveSuccesses = 0
		health.LastFailureTime = time.Now()

		utils.Warn("Health check failed for %s (consecutive failures: %d)",
			modelName, health.ConsecutiveFailures)

		// If too many consecutive failures, mark unavailable
		if health.Available && health.ConsecutiveFailures >= hc.failureThreshold {
			health.Available = false
			utils.Warn("Model %s marked UNAVAILABLE (consecutive failures: %d)",
				modelName, health.ConsecutiveFailures)
		}
	}
}

// markModelAvailable marks a model as available in the database
func (hc *HealthChecker) markModelAvailable(modelName string) {
	err := hc.modelRepo.UpdateAvailability(modelName, true)
	if err != nil {
		utils.Error("Failed to mark model %s as available: %v", modelName, err)
	} else {
		utils.Info("Database updated: Model %s is now AVAILABLE", modelName)
	}
}

// markModelUnavailable marks a model as unavailable in the database
func (hc *HealthChecker) markModelUnavailable(modelName string) {
	err := hc.modelRepo.UpdateAvailability(modelName, false)
	if err != nil {
		utils.Error("Failed to mark model %s as unavailable: %v", modelName, err)
	} else {
		utils.Warn("Database updated: Model %s is now UNAVAILABLE", modelName)
	}
}

// GetHealth returns health status for a model
func (hc *HealthChecker) GetHealth(modelName string) *ModelHealth {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	health, exists := hc.healthMap[modelName]
	if !exists {
		return nil
	}

	// Return a copy to avoid race conditions
	healthCopy := *health
	return &healthCopy
}

// GetAllHealth returns health status for all models
func (hc *HealthChecker) GetAllHealth() map[string]*ModelHealth {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	// Return copies to avoid race conditions
	result := make(map[string]*ModelHealth)
	for name, health := range hc.healthMap {
		healthCopy := *health
		result[name] = &healthCopy
	}
	return result
}

// GetHealthStats returns aggregated health statistics
func (hc *HealthChecker) GetHealthStats() map[string]interface{} {
	hc.mu.RLock()
	defer hc.mu.RUnlock()

	totalModels := len(hc.healthMap)
	availableCount := 0
	unavailableCount := 0
	totalChecks := 0
	totalSuccesses := 0
	totalFailures := 0

	for _, health := range hc.healthMap {
		if health.Available {
			availableCount++
		} else {
			unavailableCount++
		}
		totalChecks += health.TotalChecks
		totalSuccesses += health.SuccessfulChecks
		totalFailures += health.FailedChecks
	}

	successRate := 0.0
	if totalChecks > 0 {
		successRate = float64(totalSuccesses) / float64(totalChecks) * 100
	}

	return map[string]interface{}{
		"total_models":       totalModels,
		"available_models":   availableCount,
		"unavailable_models": unavailableCount,
		"total_checks":       totalChecks,
		"successful_checks":  totalSuccesses,
		"failed_checks":      totalFailures,
		"success_rate":       successRate,
		"check_interval":     hc.checkInterval.String(),
	}
}

// IsHealthy returns true if a model is healthy
func (hc *HealthChecker) IsHealthy(modelName string) bool {
	health := hc.GetHealth(modelName)
	if health == nil {
		return true // Unknown models assumed healthy
	}
	return health.Available
}
