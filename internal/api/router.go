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
	// SETTINGS ENDPOINTS (Day 17)
	// ============================================

	// Get all system settings
	http.HandleFunc("/api/v1/settings", GetSettingsHandler)

	// Update routing strategy
	http.HandleFunc("/api/v1/settings/routing/strategy", UpdateRoutingStrategySettingHandler)

	// Test provider connectivity
	http.HandleFunc("/api/v1/settings/providers/test", TestProviderHandler)

	// ============================================
	// AUTHENTICATION ENDPOINTS (Day 12)
	// ============================================

	// Public auth endpoints
	http.HandleFunc("/api/v1/auth/register", RegisterHandler)
	http.HandleFunc("/api/v1/auth/login", LoginHandler)
	http.HandleFunc("/api/v1/auth/refresh", RefreshTokenHandler)

	// OAuth2 endpoints (Day 18)
	http.HandleFunc("/api/v1/auth/oauth/providers", OAuthProvidersHandler)
	http.HandleFunc("/api/v1/auth/oauth/redirect", OAuthRedirectHandler)
	http.HandleFunc("/api/v1/auth/oauth/callback", OAuthCallbackHandler)

	// Protected auth endpoints (require authentication)
	http.Handle("/api/v1/auth/profile", auth.AuthMiddleware(http.HandlerFunc(GetProfileHandler)))
	http.Handle("/api/v1/auth/profile/update", auth.AuthMiddleware(http.HandlerFunc(UpdateProfileHandler)))
	http.Handle("/api/v1/auth/password/change", auth.AuthMiddleware(http.HandlerFunc(ChangePasswordHandler)))
	http.Handle("/api/v1/auth/logout", auth.AuthMiddleware(http.HandlerFunc(LogoutHandler)))

	// Admin endpoints
	http.Handle("/api/v1/auth/users", auth.AuthMiddleware(auth.RequireAdmin(http.HandlerFunc(ListUsersHandler))))

	// ============================================
	// USER MANAGEMENT ENDPOINTS (Day 19)
	// ============================================

	// User CRUD (admin only)
	http.Handle("/api/v1/admin/users/get", auth.AuthMiddleware(auth.RequireAdmin(http.HandlerFunc(AdminGetUserHandler))))
	http.Handle("/api/v1/admin/users/update", auth.AuthMiddleware(auth.RequireAdmin(http.HandlerFunc(AdminUpdateUserHandler))))
	http.Handle("/api/v1/admin/users/delete", auth.AuthMiddleware(auth.RequireAdmin(http.HandlerFunc(AdminDeleteUserHandler))))
	http.Handle("/api/v1/admin/users/search", auth.AuthMiddleware(auth.RequireAdmin(http.HandlerFunc(SearchUsersHandler))))

	// Role management (admin only)
	http.Handle("/api/v1/admin/users/role", auth.AuthMiddleware(auth.RequireAdmin(http.HandlerFunc(UpdateUserRoleHandler))))
	http.Handle("/api/v1/admin/users/stats", auth.AuthMiddleware(auth.RequireAdmin(http.HandlerFunc(GetUserStatsHandler))))

	// Activity logs (admin only)
	http.Handle("/api/v1/admin/activity", auth.AuthMiddleware(auth.RequireAdmin(http.HandlerFunc(GetActivityLogsHandler))))

	// Team management (admin/developer)
	http.Handle("/api/v1/admin/teams", auth.AuthMiddleware(auth.RequireRole(auth.RoleAdmin, auth.RoleDeveloper)(http.HandlerFunc(ListTeamsHandler))))
	http.Handle("/api/v1/admin/teams/create", auth.AuthMiddleware(auth.RequireRole(auth.RoleAdmin, auth.RoleDeveloper)(http.HandlerFunc(CreateTeamHandler))))
	http.Handle("/api/v1/admin/teams/members", auth.AuthMiddleware(auth.RequireRole(auth.RoleAdmin, auth.RoleDeveloper)(http.HandlerFunc(GetTeamMembersHandler))))
	http.Handle("/api/v1/admin/teams/members/manage", auth.AuthMiddleware(auth.RequireRole(auth.RoleAdmin, auth.RoleDeveloper)(http.HandlerFunc(ManageTeamMemberHandler))))
	http.Handle("/api/v1/admin/teams/delete", auth.AuthMiddleware(auth.RequireAdmin(http.HandlerFunc(DeleteTeamHandler))))

	// ============================================
	// API KEY MANAGEMENT ENDPOINTS (Day 20)
	// ============================================

	http.Handle("/api/v1/keys", auth.AuthMiddleware(http.HandlerFunc(ListAPIKeysHandler)))
	http.Handle("/api/v1/keys/create", auth.AuthMiddleware(http.HandlerFunc(CreateAPIKeyHandler)))
	http.Handle("/api/v1/keys/revoke", auth.AuthMiddleware(http.HandlerFunc(RevokeAPIKeyHandler)))
	http.Handle("/api/v1/keys/rotate", auth.AuthMiddleware(http.HandlerFunc(RotateAPIKeyHandler)))
	http.Handle("/api/v1/keys/delete", auth.AuthMiddleware(http.HandlerFunc(DeleteAPIKeyHandler)))
	http.Handle("/api/v1/keys/usage", auth.AuthMiddleware(http.HandlerFunc(GetAPIKeyUsageHandler)))

	// ============================================
	// BILLING & USAGE TRACKING ENDPOINTS (Day 21)
	// ============================================

	http.Handle("/api/v1/billing/subscription", auth.AuthMiddleware(http.HandlerFunc(GetSubscriptionHandler)))
	http.Handle("/api/v1/billing/subscription/update", auth.AuthMiddleware(http.HandlerFunc(UpdateSubscriptionHandler)))
	http.Handle("/api/v1/billing/usage", auth.AuthMiddleware(http.HandlerFunc(GetUsageStatsHandler)))
	http.Handle("/api/v1/billing/usage/history", auth.AuthMiddleware(http.HandlerFunc(GetUsageHistoryHandler)))
	http.Handle("/api/v1/billing/usage/export", auth.AuthMiddleware(http.HandlerFunc(ExportUsageHandler)))
	http.Handle("/api/v1/billing/invoices", auth.AuthMiddleware(http.HandlerFunc(ListInvoicesHandler)))
	http.Handle("/api/v1/billing/invoices/generate", auth.AuthMiddleware(http.HandlerFunc(GenerateInvoiceHandler)))

	// ============================================
	// QUOTA MANAGEMENT ENDPOINTS (Day 22)
	// ============================================

	// User quota endpoints
	http.Handle("/api/v1/quota/usage", auth.AuthMiddleware(http.HandlerFunc(GetMyQuotaUsageHandler)))
	http.Handle("/api/v1/quota/quotas", auth.AuthMiddleware(http.HandlerFunc(GetMyQuotasHandler)))
	http.Handle("/api/v1/quota/alerts/config", auth.AuthMiddleware(http.HandlerFunc(GetMyAlertConfigHandler)))
	http.Handle("/api/v1/quota/alerts/config/update", auth.AuthMiddleware(http.HandlerFunc(UpdateMyAlertConfigHandler)))
	http.Handle("/api/v1/quota/rate-limits", auth.AuthMiddleware(http.HandlerFunc(GetMyRateLimitEventsHandler)))

	// Admin quota endpoints
	http.Handle("/api/v1/admin/quota/set", auth.AuthMiddleware(auth.RequireAdmin(http.HandlerFunc(AdminSetUserQuotaHandler))))
	http.Handle("/api/v1/admin/quota/user", auth.AuthMiddleware(auth.RequireAdmin(http.HandlerFunc(AdminGetUserQuotasHandler))))
	http.Handle("/api/v1/admin/quota/all", auth.AuthMiddleware(auth.RequireAdmin(http.HandlerFunc(AdminGetAllQuotasHandler))))
	http.Handle("/api/v1/admin/quota/delete", auth.AuthMiddleware(auth.RequireAdmin(http.HandlerFunc(AdminDeleteUserQuotaHandler))))
	http.Handle("/api/v1/admin/quota/stats", auth.AuthMiddleware(auth.RequireAdmin(http.HandlerFunc(AdminGetRateLimitStatsHandler))))

	utils.Info("All routes configured successfully")
}
