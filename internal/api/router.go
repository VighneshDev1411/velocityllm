package api

import (
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/auth"
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

	// Streaming endpoints (Day 6 - NEW)
	http.HandleFunc("/api/v1/completions/stream", StreamingCompletionHandler)
	http.HandleFunc("/api/v1/completions/stream/simple", SimpleStreamingHandler)

	// Job status checking
	http.HandleFunc("/api/v1/jobs/", JobStatusHandler)

	// ============================================
	// MODEL ENDPOINTS
	// ============================================
	http.HandleFunc("/api/v1/models", ModelsHandler)
	http.HandleFunc("/api/v1/models/", ModelDetailHandler)

	// ============================================
	// REQUEST HISTORY ENDPOINTS
	// ============================================
	http.HandleFunc("/api/v1/requests", RequestsHandler)
	http.HandleFunc("/api/v1/requests/stats", RequestStatsHandler)

	// ============================================
	// CACHE ENDPOINTS
	// ============================================
	http.HandleFunc("/api/v1/cache/stats", CacheStatsHandler)
	http.HandleFunc("/api/v1/cache/clear", CacheClearHandler)
	http.HandleFunc("/api/v1/cache/warm", CacheWarmHandler)

	// Advanced caching endpoints (Day 7)
	http.HandleFunc("/api/v1/cache/analytics", GetCacheAnalyticsHandler)
	http.HandleFunc("/api/v1/cache/multilevel/stats", GetMultiLevelStatsHandler)
	http.HandleFunc("/api/v1/cache/semantic/stats", GetSemanticCacheStatsHandler)
	http.HandleFunc("/api/v1/cache/semantic/test", TestSemanticCacheHandler)
	http.HandleFunc("/api/v1/cache/hitrate", GetCacheHitRateHandler)
	http.HandleFunc("/api/v1/cache/latency", GetCacheLatencyHandler)

	// ============================================
	// ORCHESTRATION ENDPOINTS (Day 8)
	// ============================================
	http.HandleFunc("/api/v1/orchestration/chain", ExecuteChainHandler)
	http.HandleFunc("/api/v1/orchestration/parallel", ExecuteParallelCompositionHandler)
	http.HandleFunc("/api/v1/orchestration/conditional", ConditionalRouteHandler)
	http.HandleFunc("/api/v1/orchestration/stats", GetOrchestrationStatsHandler)
	http.HandleFunc("/api/v1/orchestration/strategies", GetCompositionStrategiesHandler)

	// ============================================
	// PROMPT TEMPLATE ENDPOINTS (Day 9)
	// ============================================
	http.HandleFunc("/api/v1/prompts/templates", ListTemplatesHandler)
	http.HandleFunc("/api/v1/prompts/template", GetTemplateHandler)
	http.HandleFunc("/api/v1/prompts/render", RenderTemplateHandler)
	http.HandleFunc("/api/v1/prompts/create", CreateTemplateHandler)
	http.HandleFunc("/api/v1/prompts/versions", ListVersionsHandler)
	http.HandleFunc("/api/v1/prompts/abtest/create", CreateABTestHandler)
	http.HandleFunc("/api/v1/prompts/abtest/results", GetABTestResultsHandler)
	http.HandleFunc("/api/v1/prompts/abtest/stop", StopABTestHandler)
	http.HandleFunc("/api/v1/prompts/search", SearchTemplatesHandler)
	http.HandleFunc("/api/v1/prompts/stats", GetTemplateStatsHandler)

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
	// OPTIMIZATION ENDPOINTS (Day 5 Evening)
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

	// ============================================
	// STREAMING ENDPOINTS (Day 6 - NEW)
	// ============================================

	// Streaming statistics
	http.HandleFunc("/api/v1/streaming/stats", GetStreamStatsHandler)

	// Test SSE endpoint
	http.HandleFunc("/api/v1/streaming/test", TestSSEHandler)

	// ============================================
	// TOKEN MANAGEMENT ENDPOINTS (Day 10)
	// ============================================

	// Token counting
	http.HandleFunc("/api/v1/tokens/count", CountTokensHandler)
	http.HandleFunc("/api/v1/tokens/truncate", TruncateTextHandler)
	http.HandleFunc("/api/v1/tokens/estimate", EstimateResponseTokensHandler)
	http.HandleFunc("/api/v1/tokens/cache", GetTokenCounterCacheHandler)

	// Context management
	http.HandleFunc("/api/v1/context/create", CreateContextHandler)
	http.HandleFunc("/api/v1/context/get", GetContextHandler)
	http.HandleFunc("/api/v1/context/message", AddMessageHandler)
	http.HandleFunc("/api/v1/context/clear", ClearContextHandler)
	http.HandleFunc("/api/v1/context/delete", DeleteContextHandler)
	http.HandleFunc("/api/v1/context/list", ListContextsHandler)
	http.HandleFunc("/api/v1/context/stats", GetContextStatsHandler)

	// Budget allocation
	http.HandleFunc("/api/v1/budget/allocate", AllocateBudgetHandler)
	http.HandleFunc("/api/v1/budget/get", GetBudgetHandler)
	http.HandleFunc("/api/v1/budget/use", UseTokensHandler)

	// ============================================
	// ANALYTICS / DASHBOARD ENDPOINTS (Day 13)
	// ============================================

	// Dashboard overview (aggregated data)
	http.HandleFunc("/api/v1/analytics/dashboard", GetDashboardOverviewHandler)

	// Time-series data for charts
	http.HandleFunc("/api/v1/analytics/timeseries", GetRequestTimeSeriesHandler)

	// Model comparison data
	http.HandleFunc("/api/v1/analytics/models", GetModelComparisonHandler)

	// Cost breakdown for pie/bar charts
	http.HandleFunc("/api/v1/analytics/cost-breakdown", GetCostBreakdownHandler)

	// Request log with filtering (Day 16)
	http.HandleFunc("/api/v1/analytics/requests", GetRequestLogHandler)

	// Comprehensive analytics summary (Day 16)
	http.HandleFunc("/api/v1/analytics/summary", GetAnalyticsSummaryHandler)

	// ============================================
	// AUTHENTICATION ENDPOINTS (Day 12)
	// ============================================

	// Public auth endpoints
	http.HandleFunc("/api/v1/auth/register", RegisterHandler)
	http.HandleFunc("/api/v1/auth/login", LoginHandler)
	http.HandleFunc("/api/v1/auth/refresh", RefreshTokenHandler)

	// Protected auth endpoints (require authentication)
	http.Handle("/api/v1/auth/profile", auth.AuthMiddleware(http.HandlerFunc(GetProfileHandler)))
	http.Handle("/api/v1/auth/profile/update", auth.AuthMiddleware(http.HandlerFunc(UpdateProfileHandler)))
	http.Handle("/api/v1/auth/password/change", auth.AuthMiddleware(http.HandlerFunc(ChangePasswordHandler)))
	http.Handle("/api/v1/auth/logout", auth.AuthMiddleware(http.HandlerFunc(LogoutHandler)))

	// Admin endpoints
	http.Handle("/api/v1/auth/users", auth.AuthMiddleware(auth.RequireAdmin(http.HandlerFunc(ListUsersHandler))))

	utils.Info("All routes configured successfully")
}
