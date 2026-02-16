package api

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/config"
	"github.com/VighneshDev1411/velocityllm/internal/llm"
	"github.com/VighneshDev1411/velocityllm/internal/metrics"
	"github.com/VighneshDev1411/velocityllm/internal/middleware"
	"github.com/VighneshDev1411/velocityllm/internal/router"
	"github.com/VighneshDev1411/velocityllm/internal/worker"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// GetSettingsHandler returns all system settings
func GetSettingsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	cfg, _ := config.Load()

	// LLM Provider status
	provider := llm.GetProvider()
	providers := provider.AvailableProviders()

	openaiKey := os.Getenv("OPENAI_API_KEY")
	anthropicKey := os.Getenv("ANTHROPIC_API_KEY")

	maskedOpenAI := ""
	if openaiKey != "" {
		maskedOpenAI = openaiKey[:7] + "..." + openaiKey[len(openaiKey)-4:]
	}
	maskedAnthropic := ""
	if anthropicKey != "" {
		maskedAnthropic = anthropicKey[:7] + "..." + anthropicKey[len(anthropicKey)-4:]
	}

	// Router config
	routerInstance := router.GetGlobalRouter()
	routerConfig := routerInstance.GetConfig()

	// Worker pool config
	pool := worker.GetGlobalPool()
	workerMetrics := pool.GetMetrics()

	// Backpressure config
	bp := middleware.GetGlobalBackpressureHandler()
	bpStatus := bp.GetStatus()

	// Rate limiter
	rl := middleware.GetGlobalRateLimiter()
	rlStats := rl.GetStats()

	// Metrics config
	collector := metrics.GetGlobalMetricsCollector()
	snapshot := collector.GetSnapshot()

	response := map[string]interface{}{
		"system": map[string]interface{}{
			"app_name":    cfg.App.Name,
			"version":     cfg.App.Version,
			"environment": cfg.App.Environment,
			"log_level":   cfg.App.LogLevel,
			"uptime":      snapshot.Throughput.Period.Seconds(),
		},
		"server": map[string]interface{}{
			"host":          cfg.Server.Host,
			"port":          cfg.Server.Port,
			"read_timeout":  cfg.Server.ReadTimeout.String(),
			"write_timeout": cfg.Server.WriteTimeout.String(),
			"idle_timeout":  cfg.Server.IdleTimeout.String(),
		},
		"providers": map[string]interface{}{
			"available":     providers,
			"openai_key":    maskedOpenAI,
			"anthropic_key": maskedAnthropic,
			"openai_configured":    openaiKey != "",
			"anthropic_configured": anthropicKey != "",
			"openai_models":  []string{"gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"},
			"anthropic_models": []string{"claude-3-opus", "claude-3-sonnet", "claude-3-haiku"},
		},
		"routing": map[string]interface{}{
			"strategy":            routerConfig.Strategy,
			"enable_fallback":     routerConfig.EnableFallback,
			"enable_circuit_break": routerConfig.EnableCircuitBreak,
			"max_retries":         routerConfig.MaxRetries,
			"retry_delay":         routerConfig.RetryDelay.String(),
			"health_check_enabled":  routerConfig.HealthCheckEnabled,
			"health_check_interval": routerConfig.HealthCheckInterval.String(),
			"available_strategies": []string{"round-robin", "least-cost", "least-latency", "best-quality", "smart"},
		},
		"worker_pool": map[string]interface{}{
			"min_workers":          5,
			"max_workers":          50,
			"queue_size":           1000,
			"job_timeout":          "5m",
			"scale_up_threshold":   0.8,
			"scale_down_threshold": 0.2,
			"scale_interval":       "30s",
			"health_check_interval": "10s",
			"current_workers":      workerMetrics.TotalWorkers,
			"busy_workers":         workerMetrics.BusyWorkers,
			"queue_utilization":    workerMetrics.QueueUtilization,
		},
		"cache": map[string]interface{}{
			"default_ttl":       "24h",
			"l1_max_size":       1000,
			"l1_max_memory_mb":  256,
			"l1_ttl":            "1h",
			"l2_ttl":            "24h",
			"enable_multi_level": true,
			"enable_semantic":    true,
			"semantic_threshold": 0.85,
			"write_through":     true,
		},
		"rate_limiting": map[string]interface{}{
			"default_rpm":      100,
			"default_burst":    20,
			"cleanup_interval": "5m",
			"stats":            rlStats,
			"tiers": map[string]interface{}{
				"free":       map[string]int{"rpm": 10, "burst": 5},
				"basic":      map[string]int{"rpm": 100, "burst": 20},
				"premium":    map[string]int{"rpm": 500, "burst": 100},
				"enterprise": map[string]int{"rpm": 2000, "burst": 500},
				"vip":        map[string]int{"rpm": 10000, "burst": 2000},
			},
		},
		"backpressure": map[string]interface{}{
			"enable_load_shedding": true,
			"queue_threshold":      80,
			"reject_low_priority":  true,
			"adaptive_threshold":   true,
			"current_status":       bpStatus,
		},
		"database": map[string]interface{}{
			"host":     cfg.Database.Host,
			"port":     cfg.Database.Port,
			"database": cfg.Database.Database,
			"ssl_mode": cfg.Database.SSLMode,
		},
		"redis": map[string]interface{}{
			"host":      cfg.Redis.Host,
			"port":      cfg.Redis.Port,
			"db":        cfg.Redis.DB,
			"pool_size": 10,
		},
	}

	types.WriteSuccess(w, "Settings retrieved", response)
}

// UpdateRoutingStrategySettingHandler allows changing the routing strategy
func UpdateRoutingStrategySettingHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		Strategy string `json:"strategy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	validStrategies := map[string]bool{
		"round-robin": true, "least-cost": true, "least-latency": true,
		"best-quality": true, "smart": true,
	}
	if !validStrategies[req.Strategy] {
		types.WriteError(w, http.StatusBadRequest, "Invalid strategy. Use: round-robin, least-cost, least-latency, best-quality, smart")
		return
	}

	routerInstance := router.GetGlobalRouter()
	routerInstance.SetStrategy(router.RoutingStrategy(req.Strategy))

	types.WriteSuccess(w, "Routing strategy updated to: "+req.Strategy, map[string]string{
		"strategy": req.Strategy,
	})
}

// TestProviderHandler tests connectivity to an LLM provider
func TestProviderHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		Provider string `json:"provider"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	provider := llm.GetProvider()
	start := time.Now()

	var testModel string
	switch req.Provider {
	case "openai":
		testModel = "gpt-4"
	case "anthropic":
		testModel = "claude-3-sonnet"
	default:
		types.WriteError(w, http.StatusBadRequest, "Invalid provider. Use: openai, anthropic")
		return
	}

	result, err := provider.Complete("Say hello in one word.", testModel, 0.1, 10, 1.0)
	latency := time.Since(start).Milliseconds()

	if err != nil {
		types.WriteSuccess(w, "Provider test failed", map[string]interface{}{
			"provider": req.Provider,
			"status":   "error",
			"error":    err.Error(),
			"latency":  latency,
		})
		return
	}

	types.WriteSuccess(w, "Provider test successful", map[string]interface{}{
		"provider": req.Provider,
		"status":   "connected",
		"model":    result.Model,
		"response": result.Response,
		"latency":  latency,
		"tokens":   result.TotalTokens,
	})
}
