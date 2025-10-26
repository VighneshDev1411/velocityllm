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

	// API v1 routes
	router.mux.HandleFunc("/api/v1/models", GetModelsHandler)

	// Catch-all for undefined API routes
	router.mux.HandleFunc("/api/v1/", func(w http.ResponseWriter, r *http.Request) {
		NotFoundHandler(w, r)
	})

	utils.Info("Routes configured successfully")
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
