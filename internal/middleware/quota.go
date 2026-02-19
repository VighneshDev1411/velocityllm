package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/VighneshDev1411/velocityllm/internal/quota"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// QuotaMiddleware checks and enforces quota limits
func QuotaMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Only apply to API routes that consume quota
		if !shouldCheckQuota(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		// Get user ID from context (set by auth middleware)
		userIDValue := r.Context().Value("user_id")
		if userIDValue == nil {
			// No user context, skip quota check
			next.ServeHTTP(w, r)
			return
		}

		userID := userIDValue.(uint)

		// Check request quota
		service := quota.GetGlobalService()
		allowed, usage, err := service.CheckQuota(userID, quota.QuotaTypeRequests)
		if err != nil {
			types.WriteError(w, http.StatusInternalServerError, "Failed to check quota")
			return
		}

		if !allowed {
			types.WriteJSON(w, http.StatusTooManyRequests, map[string]interface{}{
				"error":         "Request quota exceeded",
				"current_usage": usage.CurrentUsage,
				"quota_limit":   usage.QuotaLimit,
				"overage":       usage.OverageAmount,
				"period_end":    usage.PeriodEnd,
				"message":       "You have exceeded your request quota. Please upgrade your plan or wait until the next period.",
			})
			return
		}

		// Store usage in context for later increment
		ctx := context.WithValue(r.Context(), "quota_user_id", userID)
		r = r.WithContext(ctx)

		// Create response writer wrapper to capture status code
		rw := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		// Call next handler
		next.ServeHTTP(rw, r)

		// After request completes, increment usage
		// Only increment if request was successful (2xx status)
		if rw.statusCode >= 200 && rw.statusCode < 300 {
			go service.IncrementUsage(userID, quota.QuotaTypeRequests, 1)
		}
	})
}

// responseWriter wraps http.ResponseWriter to capture status code
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// shouldCheckQuota determines if a path should be subject to quota limits
func shouldCheckQuota(path string) bool {
	// Skip quota checks for these paths
	skipPaths := []string{
		"/health",
		"/api/v1/auth/login",
		"/api/v1/auth/register",
		"/api/v1/auth/refresh",
		"/api/v1/quota/usage",       // Allow users to check their quota
		"/api/v1/quota/alerts",      // Allow users to view alerts
		"/api/v1/quota/rate-limits", // Allow users to view rate limit events
	}

	for _, skip := range skipPaths {
		if path == skip || strings.HasPrefix(path, skip) {
			return false
		}
	}

	// Check quota for API routes
	return strings.HasPrefix(path, "/api/v1/")
}
