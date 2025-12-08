package api

import (
	"net/http"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/cache"
	"github.com/VighneshDev1411/velocityllm/internal/database"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

var startTime = time.Now()

// HealthHandler handles health check requests
func HealthHandler(w http.ResponseWriter, r *http.Request) {
	uptime := time.Since(startTime)

	// Check database health
	dbStatus := "healthy"
	if err := database.HealthCheck(); err != nil {
		dbStatus = "unhealthy"
	}

	// Check Redis health
	redisStatus := "healthy"
	if err := cache.HealthCheck(); err != nil {
		redisStatus = "unhealthy"
	}

	response := types.HealthResponse{
		Status:    "healthy",
		Service:   "velocityllm",
		Version:   "0.1.0",
		Uptime:    int64(uptime.Seconds()),
		Timestamp: time.Now(),
		Checks: map[string]types.HealthCheck{
			"api":      {Status: "healthy"},
			"database": {Status: dbStatus},
			"redis":    {Status: redisStatus},
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
			"models":        "/api/v1/models",
			"requests":      "/api/v1/requests",
			"request_stats": "/api/v1/requests/stats",
			"cache":         "/api/v1/cache (coming soon)",
			"completions":   "/api/v1/completions (coming soon)",
			"chat":          "/api/v1/chat/completions (coming soon)",
			"documentation": "/api/v1/docs (coming soon)",
		},
	}

	types.WriteSuccess(w, "API is running", data)
}

// NotFoundHandler handles 404 errors
func NotFoundHandler(w http.ResponseWriter, r *http.Request) {
	types.WriteError(w, http.StatusNotFound, "Endpoint not found")
}

// GetModelsHandler returns all available models
func GetModelsHandler(w http.ResponseWriter, r *http.Request) {
	var models []types.Model

	// Query database for all models
	if err := database.GetDB().Find(&models).Error; err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to fetch models")
		return
	}

	types.WriteSuccess(w, "Models retrieved successfully", models)
}
