package api

import (
	"net/http"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// SetupRoutes configures all API routes
func SetupRoutes() {
	// Health check
	http.HandleFunc("/health", HealthHandler)

	// ============================================
	// COMPLETION ENDPOINTS
	// ============================================
	http.HandleFunc("/api/v1/completions", CompletionHandler)
	http.HandleFunc("/api/v1/completions/async", CompletionAsyncHandler)

	// Job status checking
	http.HandleFunc("/api/v1/jobs/", JobStatusHandler)

	// ============================================
	// MODEL ENDPOINTS
	// ============================================
	http.HandleFunc("/api/v1/models", GetModelsHandler)

	// ============================================
	// REQUEST HISTORY ENDPOINTS
	// ============================================
	http.HandleFunc("/api/v1/requests", ListRequestsHandler)
	http.HandleFunc("/api/v1/requests/stats", GetRequestStatsHandler)

	// ============================================
	// CACHE ENDPOINTS
	// ============================================
	http.HandleFunc("/api/v1/cache/stats", GetCacheStatsHandler)
	http.HandleFunc("/api/v1/cache/clear", ClearCacheHandler)

	// ============================================
	// ROUTER ENDPOINTS (Day 4)
	// ============================================

	// Router statistics and configuration
	http.HandleFunc("/api/v1/router/stats", GetRouterStatsHandler)
	http.HandleFunc("/api/v1/router/config", GetRouterConfigHandler)
	http.HandleFunc("/api/v1/router/strategy", UpdateRouterStrategyHandler)
	http.HandleFunc("/api/v1/router/stats/reset", ResetRouterStatsHandler)

	// Circuit breaker monitoring
	http.HandleFunc("/api/v1/router/circuit-breakers", GetCircuitBreakerStatsHandler)

	// Health checking
	http.HandleFunc("/api/v1/router/health/stats", GetHealthStatsHandler)
	http.HandleFunc("/api/v1/router/health/models", GetModelHealthHandler)

	// Routing analysis
	http.HandleFunc("/api/v1/router/analyze", AnalyzePromptHandler)
	http.HandleFunc("/api/v1/router/decision", GetRoutingDecisionHandler)

	// ============================================
	// WORKER POOL ENDPOINTS (Day 5 Morning)
	// ============================================

	// Worker pool statistics
	http.HandleFunc("/api/v1/workers/stats", GetWorkerPoolStatsHandler)
	http.HandleFunc("/api/v1/workers/health", GetWorkerPoolHealthHandler)
	http.HandleFunc("/api/v1/workers/metrics", GetWorkerPoolMetricsHandler)

	// Individual workers
	http.HandleFunc("/api/v1/workers", GetWorkersHandler)

	// Queue management
	http.HandleFunc("/api/v1/workers/queue", GetQueueInfoHandler)

	// Dynamic scaling
	http.HandleFunc("/api/v1/workers/resize", ResizeWorkerPoolHandler)

	// ============================================
	// METRICS ENDPOINTS (Day 5 Afternoon)
	// ============================================

	// Performance metrics
	http.HandleFunc("/api/v1/metrics/snapshot", GetMetricsSnapshotHandler)
	http.HandleFunc("/api/v1/metrics/latency", GetLatencyMetricsHandler)
	http.HandleFunc("/api/v1/metrics/throughput", GetThroughputMetricsHandler)
	http.HandleFunc("/api/v1/metrics/cost", GetCostMetricsHandler)
	http.HandleFunc("/api/v1/metrics/errors", GetErrorMetricsHandler)
	http.HandleFunc("/api/v1/metrics/models", GetModelMetricsHandler)
	http.HandleFunc("/api/v1/metrics/reset", ResetMetricsHandler)

	// Rate limiter metrics
	http.HandleFunc("/api/v1/metrics/rate-limiter", GetRateLimiterStatsHandler)
	http.HandleFunc("/api/v1/metrics/rate-limiter/user", GetRateLimiterUserStatusHandler)

	// Backpressure metrics
	http.HandleFunc("/api/v1/metrics/backpressure", GetBackpressureStatsHandler)
	http.HandleFunc("/api/v1/metrics/backpressure/status", GetBackpressureStatusHandler)
	http.HandleFunc("/api/v1/metrics/backpressure/reset", ResetBackpressureStatsHandler)

	// System health
	http.HandleFunc("/api/v1/system/health", GetSystemHealthHandler)

	// ============================================
	// OPTIMIZATION ENDPOINTS (Day 5 Evening - NEW)
	// ============================================

	// Connection pool statistics
	http.HandleFunc("/api/v1/optimization/pools/db", GetDBPoolStatsHandler)
	http.HandleFunc("/api/v1/optimization/pools/redis", GetRedisPoolStatsHandler)
	http.HandleFunc("/api/v1/optimization/pools/http", GetHTTPPoolStatsHandler)
	http.HandleFunc("/api/v1/optimization/pools", GetAllPoolStatsHandler)

	// Pool management
	http.HandleFunc("/api/v1/optimization/pools/db/resize", ResizeDBPoolHandler)

	// Request batching
	http.HandleFunc("/api/v1/optimization/batcher/stats", GetBatcherStatsHandler)
	http.HandleFunc("/api/v1/optimization/batcher/pending", GetBatcherPendingHandler)

	// Optimization summary
	http.HandleFunc("/api/v1/optimization/summary", GetOptimizationSummaryHandler)
	http.HandleFunc("/api/v1/optimization/metrics", GetOptimizationMetricsHandler)

	utils.Info("All routes configured successfully")
}
