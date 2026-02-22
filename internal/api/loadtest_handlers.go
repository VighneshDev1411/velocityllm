package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/VighneshDev1411/velocityllm/internal/loadtest"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// ============================================
// LOAD TEST CONFIG ENDPOINTS (Day 23)
// ============================================

// CreateLoadTestHandler creates a new load test configuration
func CreateLoadTestHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID := r.Context().Value("user_id").(string)
	uid, err := strconv.ParseUint(userID, 10, 32)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var config loadtest.LoadTestConfig
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	config.CreatedBy = uint(uid)

	service := loadtest.GetGlobalService()
	if err := service.CreateLoadTest(&config); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to create load test")
		return
	}

	types.WriteSuccess(w, "Load test created successfully", map[string]interface{}{
		"config": config,
	})
}

// ListLoadTestsHandler returns all load test configurations
func ListLoadTestsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	service := loadtest.GetGlobalService()
	configs, err := service.ListLoadTests(limit)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to fetch load tests")
		return
	}

	types.WriteSuccess(w, "Load tests retrieved", map[string]interface{}{
		"configs": configs,
	})
}

// GetLoadTestHandler retrieves a specific load test configuration
func GetLoadTestHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	idStr := r.URL.Query().Get("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid load test ID")
		return
	}

	service := loadtest.GetGlobalService()
	config, err := service.GetLoadTest(uint(id))
	if err != nil {
		types.WriteError(w, http.StatusNotFound, "Load test not found")
		return
	}

	types.WriteSuccess(w, "Load test retrieved", map[string]interface{}{
		"config": config,
	})
}

// ============================================
// LOAD TEST EXECUTION ENDPOINTS (Day 23)
// ============================================

// StartLoadTestHandler starts a load test execution
func StartLoadTestHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		ConfigID uint `json:"config_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	service := loadtest.GetGlobalService()
	run, err := service.StartLoadTest(req.ConfigID)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to start load test")
		return
	}

	types.WriteSuccess(w, "Load test started successfully", map[string]interface{}{
		"run": run,
	})
}

// StopLoadTestHandler stops a running load test
func StopLoadTestHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		RunID uint `json:"run_id"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	service := loadtest.GetGlobalService()
	if err := service.StopLoadTest(req.RunID); err != nil {
		types.WriteError(w, http.StatusNotFound, "Test run not found or not running")
		return
	}

	types.WriteSuccess(w, "Load test stopped successfully", nil)
}

// GetTestRunHandler retrieves a specific test run
func GetTestRunHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	idStr := r.URL.Query().Get("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid run ID")
		return
	}

	service := loadtest.GetGlobalService()
	run, err := service.GetTestRun(uint(id))
	if err != nil {
		types.WriteError(w, http.StatusNotFound, "Test run not found")
		return
	}

	types.WriteSuccess(w, "Test run retrieved", map[string]interface{}{
		"run": run,
	})
}

// ListTestRunsHandler returns recent test runs
func ListTestRunsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	limitStr := r.URL.Query().Get("limit")
	limit := 20
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	service := loadtest.GetGlobalService()
	runs, err := service.ListTestRuns(limit)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to fetch test runs")
		return
	}

	types.WriteSuccess(w, "Test runs retrieved", map[string]interface{}{
		"runs": runs,
	})
}

// GetTestMetricsHandler retrieves real-time metrics for a test run
func GetTestMetricsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	runIDStr := r.URL.Query().Get("run_id")
	runID, err := strconv.ParseUint(runIDStr, 10, 32)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid run ID")
		return
	}

	service := loadtest.GetGlobalService()
	metrics, err := service.GetTestMetrics(uint(runID))
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to fetch metrics")
		return
	}

	types.WriteSuccess(w, "Metrics retrieved", map[string]interface{}{
		"metrics": metrics,
	})
}

// ============================================
// QUICK BENCHMARK ENDPOINTS (Day 23)
// ============================================

// QuickBenchmarkHandler runs a quick 30-second benchmark
func QuickBenchmarkHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID := r.Context().Value("user_id").(string)
	uid, err := strconv.ParseUint(userID, 10, 32)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var req struct {
		TargetRPS int    `json:"target_rps"`
		Model     string `json:"model"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.TargetRPS == 0 {
		req.TargetRPS = 100
	}
	if req.Model == "" {
		req.Model = "gpt-4"
	}

	// Create quick benchmark config
	config := &loadtest.LoadTestConfig{
		Name:        "Quick Benchmark",
		Pattern:     loadtest.LoadPatternConstant,
		TargetRPS:   req.TargetRPS,
		Duration:    30,
		Concurrency: 50,
		Model:       req.Model,
		Prompt:      "Hello, this is a load test. Please respond.",
		MaxTokens:   50,
		EnableCache: true,
		CreatedBy:   uint(uid),
	}

	service := loadtest.GetGlobalService()
	if err := service.CreateLoadTest(config); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to create benchmark")
		return
	}

	// Start immediately
	run, err := service.StartLoadTest(config.ID)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to start benchmark")
		return
	}

	types.WriteSuccess(w, "Quick benchmark started", map[string]interface{}{
		"run": run,
	})
}
