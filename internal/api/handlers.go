package api

import (
	"net/http"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

var startTime = time.Now()

// HealthHandler handles health check requests
func HealthHandler(w http.ResponseWriter, r *http.Request) {
	uptime := time.Since(startTime)

	response := types.HealthResponse{
		Status:    "healthy",
		Version:   "0.1.0",
		Uptime:    uptime.String(),
		Timestamp: time.Now(),
		Services: map[string]string{
			"api":      "healthy",
			"database": "not_configured", // Will update this later
			"redis":    "not_configured", // Will update this later
		},
	}

	types.WriteJSON(w, http.StatusOK, response)
}

// RootHandler handles requests to the root path
func RootHandler(w http.ResponseWriter, r *http.Request) {
	data := map[string]interface{}{
		"name":    "VelocityLLM API",
		"version": "0.1.0",
		"message": "Welcome to VelocityLLM - High-Performance LLM Inference Engine",
		"endpoints": map[string]string{
			"health":        "/health",
			"api_v1":        "/api/v1",
			"completions":   "/api/v1/completions (coming soon)",
			"chat":          "/api/v1/chat/completions (coming soon)",
			"models":        "/api/v1/models (coming soon)",
			"documentation": "/api/v1/docs (coming soon)",
		},
	}

	types.WriteSuccess(w, "API is running", data)
}

// NotFoundHandler handles 404 errors
func NotFoundHandler(w http.ResponseWriter, r *http.Request) {
	types.WriteError(w, http.StatusNotFound, "Endpoint not found")
}
