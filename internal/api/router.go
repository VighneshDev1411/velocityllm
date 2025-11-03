package api

import (
	"net/http"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// Router holds all route definitions
type Router struct {
	mux *http.ServeMux
}

// NewRouter creates a new router instance
func NewRouter() *Router {
	return &Router{
		mux: http.NewServeMux(),
	}
}

// SetupRoutes configures all application routes
func (router *Router) SetupRoutes() {
	utils.Info("Setting up routes...")

	// Root endpoint
	router.mux.HandleFunc("/", RootHandler)

	// Health check endpoint
	router.mux.HandleFunc("/health", HealthHandler)

	// Model endpoints
	router.mux.HandleFunc("/api/v1/models", GetModelsHandler)

	// Request endpoints
	router.mux.HandleFunc("/api/v1/requests", handleRequestRoutes)
	router.mux.HandleFunc("/api/v1/requests/stats", GetRequestStatsHandler)

	// Cache endpoints
	router.mux.HandleFunc("/api/v1/cache/stats", GetCacheStatsHandler)
	router.mux.HandleFunc("/api/v1/cache/clear", ClearCacheHandler)
	router.mux.HandleFunc("/api/v1/cache/flush", FlushAllCacheHandler)
	router.mux.HandleFunc("/api/v1/cache/test", TestCacheHandler)

	// Completion endpoints
	router.mux.HandleFunc("/api/v1/completions", CompletionHandler)

	// Catch-all for undefined API routes
	router.mux.HandleFunc("/api/v1/", func(w http.ResponseWriter, r *http.Request) {
		NotFoundHandler(w, r)
	})

	utils.Info("Routes configured successfully")
}

// handleRequestRoutes routes request operations based on HTTP method
func handleRequestRoutes(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		// Check if ID is provided
		if r.URL.Query().Get("id") != "" {
			GetRequestHandler(w, r)
		} else {
			ListRequestsHandler(w, r)
		}
	case http.MethodPost:
		CreateRequestHandler(w, r)
	case http.MethodPut, http.MethodPatch:
		UpdateRequestHandler(w, r)
	case http.MethodDelete:
		DeleteRequestHandler(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// GetHandler returns the HTTP handler with all middlewares applied
func (router *Router) GetHandler() http.Handler {
	// Apply middlewares in order: Recovery -> Logging -> CORS -> Routes
	handler := Chain(
		router.mux,
		RecoveryMiddleware,
		LoggingMiddleware,
		CORSMiddleware,
	)

	return handler
}
