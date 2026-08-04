package api

import (
	"net/http"
	"strings"

	"github.com/VighneshDev1411/velocityllm/internal/auth"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// SetupRoutes configures the lean core API surface.
func SetupRoutes() {
	// ── Health probes ──
	http.HandleFunc("/health", HealthHandler)
	http.HandleFunc("/health/live", LivenessHandler)
	http.HandleFunc("/health/ready", ReadinessHandler)
	http.HandleFunc("/health/startup", StartupHandler)

	// ── Completions (Playground) ──
	http.HandleFunc("/api/v1/completions", CompletionHandler)
	http.HandleFunc("/api/v1/completions/async", CompletionAsyncHandler)
	http.HandleFunc("/api/v1/jobs/", JobStatusHandler)

	// ── Models ──
	http.HandleFunc("/api/v1/models", ModelsHandler)
	http.HandleFunc("/api/v1/models/", ModelDetailHandler)

	// ── Request history ──
	http.HandleFunc("/api/v1/requests", RequestsHandler)
	http.HandleFunc("/api/v1/requests/stats", RequestStatsHandler)

	// ── Cache (Caching page) ──
	http.HandleFunc("/api/v1/cache/stats", CacheStatsHandler)
	http.HandleFunc("/api/v1/cache/clear", CacheClearHandler)
	http.HandleFunc("/api/v1/cache/warm", CacheWarmHandler)
	http.HandleFunc("/api/v1/cache/analytics", GetCacheAnalyticsHandler)
	http.HandleFunc("/api/v1/cache/multilevel/stats", GetMultiLevelStatsHandler)
	http.HandleFunc("/api/v1/cache/semantic/stats", GetSemanticCacheStatsHandler)
	http.HandleFunc("/api/v1/cache/semantic/test", TestSemanticCacheHandler)
	http.HandleFunc("/api/v1/cache/hitrate", GetCacheHitRateHandler)
	http.HandleFunc("/api/v1/cache/latency", GetCacheLatencyHandler)
	http.HandleFunc("/api/v1/cache/invalidate", InvalidateCacheByTagHandler)
	http.HandleFunc("/api/v1/cache/response/stats", GetResponseCacheStatsHandler)

	// ── Metrics ──
	http.HandleFunc("/api/v1/metrics/snapshot", GetMetricsSnapshotHandler)
	http.HandleFunc("/api/v1/metrics/latency", GetLatencyMetricsHandler)
	http.HandleFunc("/api/v1/metrics/throughput", GetThroughputMetricsHandler)
	http.HandleFunc("/api/v1/metrics/cost", GetCostMetricsHandler)
	http.HandleFunc("/api/v1/metrics/errors", GetErrorMetricsHandler)
	http.HandleFunc("/api/v1/metrics/models", GetModelMetricsHandler)

	// ── Analytics (Dashboard) ──
	http.HandleFunc("/api/v1/analytics/dashboard", GetDashboardOverviewHandler)
	http.HandleFunc("/api/v1/analytics/timeseries", GetRequestTimeSeriesHandler)
	http.HandleFunc("/api/v1/analytics/models", GetModelComparisonHandler)
	http.HandleFunc("/api/v1/analytics/cost-breakdown", GetCostBreakdownHandler)
	http.HandleFunc("/api/v1/analytics/requests", GetRequestLogHandler)
	http.HandleFunc("/api/v1/analytics/summary", GetAnalyticsSummaryHandler)

	// ── Settings ──
	http.HandleFunc("/api/v1/settings", GetSettingsHandler)
	http.HandleFunc("/api/v1/settings/routing/strategy", UpdateRoutingStrategySettingHandler)
	http.HandleFunc("/api/v1/settings/providers/test", TestProviderHandler)

	// ── Auth ──
	http.HandleFunc("/api/v1/auth/register", RegisterHandler)
	http.HandleFunc("/api/v1/auth/login", LoginHandler)
	http.HandleFunc("/api/v1/auth/refresh", RefreshTokenHandler)
	http.HandleFunc("/api/v1/auth/oauth/providers", OAuthProvidersHandler)
	http.HandleFunc("/api/v1/auth/oauth/redirect", OAuthRedirectHandler)
	http.HandleFunc("/api/v1/auth/oauth/callback", OAuthCallbackHandler)
	http.Handle("/api/v1/auth/profile", auth.AuthMiddleware(http.HandlerFunc(GetProfileHandler)))
	http.Handle("/api/v1/auth/profile/update", auth.AuthMiddleware(http.HandlerFunc(UpdateProfileHandler)))
	http.Handle("/api/v1/auth/password/change", auth.AuthMiddleware(http.HandlerFunc(ChangePasswordHandler)))
	http.Handle("/api/v1/auth/logout", auth.AuthMiddleware(http.HandlerFunc(LogoutHandler)))

	// ── API Keys ──
	http.Handle("/api/v1/keys", auth.AuthMiddleware(http.HandlerFunc(ListAPIKeysHandler)))
	http.Handle("/api/v1/keys/create", auth.AuthMiddleware(http.HandlerFunc(CreateAPIKeyHandler)))
	http.Handle("/api/v1/keys/revoke", auth.AuthMiddleware(http.HandlerFunc(RevokeAPIKeyHandler)))
	http.Handle("/api/v1/keys/rotate", auth.AuthMiddleware(http.HandlerFunc(RotateAPIKeyHandler)))
	http.Handle("/api/v1/keys/delete", auth.AuthMiddleware(http.HandlerFunc(DeleteAPIKeyHandler)))
	http.Handle("/api/v1/keys/usage", auth.AuthMiddleware(http.HandlerFunc(GetAPIKeyUsageHandler)))

	// ── Chat ──
	http.HandleFunc("/api/v1/chat/conversations", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			ListConversationsHandler(w, r)
		case http.MethodPost:
			CreateConversationHandler(w, r)
		default:
			types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		}
	})
	http.HandleFunc("/api/v1/chat/conversations/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		switch {
		case strings.HasSuffix(path, "/send"):
			ChatSendHandler(w, r)
		case strings.HasSuffix(path, "/rename"):
			RenameConversationHandler(w, r)
		default:
			switch r.Method {
			case http.MethodGet:
				GetConversationHandler(w, r)
			case http.MethodDelete:
				DeleteConversationHandler(w, r)
			default:
				types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
			}
		}
	})
	http.HandleFunc("/api/v1/chat/stats", ChatStatsHandler)

	utils.Info("Routes configured (lean core)")
}
