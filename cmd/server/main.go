package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/api"
	"github.com/VighneshDev1411/velocityllm/internal/streaming"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

const (
	defaultPort     = "8080"
	shutdownTimeout = 30 * time.Second
	readTimeout     = 60 * time.Second
	writeTimeout    = 60 * time.Second
	idleTimeout     = 120 * time.Second
	maxHeaderBytes  = 1 << 20 // 1 MB
)

func main() {
	// Initialize logger
	logger := utils.NewLogger()
	logger.Info("Starting VelocityLLM Server with Streaming Support")

	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	// Initialize streaming components
	logger.Info("Initializing streaming components")

	// Create stream manager with configuration
	streamManagerConfig := streaming.DefaultStreamManagerConfig()
	streamManager := streaming.NewStreamManager(streamManagerConfig, logger)

	// Create SSE handler
	sseHandler := streaming.NewSSEHandler(streamManager, logger)

	logger.Info("Stream manager initialized",
		"max_connections", streamManagerConfig.MaxConnections,
		"idle_timeout", streamManagerConfig.IdleTimeout,
		"cleanup_interval", streamManagerConfig.CleanupInterval,
	)

	// Initialize router
	logger.Info("Setting up API routes")
	router := api.NewRouter(streamManager, sseHandler, logger)

	// Configure HTTP server
	server := &http.Server{
		Addr:           fmt.Sprintf(":%s", port),
		Handler:        router.GetEngine(),
		ReadTimeout:    readTimeout,
		WriteTimeout:   writeTimeout,
		IdleTimeout:    idleTimeout,
		MaxHeaderBytes: maxHeaderBytes,
	}

	// Start server in goroutine
	go func() {
		logger.Info("Server starting",
			"port", port,
			"read_timeout", readTimeout,
			"write_timeout", writeTimeout,
		)

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("Server failed to start", "error", err)
			os.Exit(1)
		}
	}()

	logger.Info("🚀 VelocityLLM Server is running!",
		"port", port,
		"health_check", fmt.Sprintf("http://localhost:%s/api/v1/health", port),
		"stream_test", fmt.Sprintf("http://localhost:%s/api/v1/stream/test", port),
	)

	// Print available endpoints
	printEndpoints(port, logger)

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server gracefully...")

	// Create shutdown context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	// Shutdown stream manager first
	logger.Info("Shutting down stream manager")
	if err := streamManager.Shutdown(ctx); err != nil {
		logger.Error("Stream manager shutdown error", "error", err)
	}

	// Shutdown HTTP server
	logger.Info("Shutting down HTTP server")
	if err := server.Shutdown(ctx); err != nil {
		logger.Error("Server forced to shutdown", "error", err)
	}

	logger.Info("Server exited successfully")
}

// printEndpoints prints all available API endpoints
func printEndpoints(port string, logger *utils.Logger) {
	baseURL := fmt.Sprintf("http://localhost:%s", port)

	logger.Info("\n" + `
╔══════════════════════════════════════════════════════════════╗
║             VelocityLLM Streaming API Endpoints              ║
╚══════════════════════════════════════════════════════════════╝

📡 STREAMING ENDPOINTS:
   POST   ` + baseURL + `/api/v1/stream/completion
          → Stream LLM completions with SSE
   
   POST   ` + baseURL + `/api/v1/stream/chat/completions
          → OpenAI-compatible chat streaming
   
   GET    ` + baseURL + `/api/v1/stream/test?message=hello
          → Test streaming functionality
   
   GET    ` + baseURL + `/api/v1/stream/status/:id
          → Get stream status by ID
   
   DELETE ` + baseURL + `/api/v1/stream/:id
          → Cancel active stream
   
   GET    ` + baseURL + `/api/v1/stream/active
          → List all active streams

📊 MONITORING ENDPOINTS:
   GET    ` + baseURL + `/api/v1/stream/metrics
          → Stream performance metrics
   
   GET    ` + baseURL + `/api/v1/stream/stats
          → Detailed streaming statistics
   
   GET    ` + baseURL + `/api/v1/stream/health
          → Streaming system health check
   
   GET    ` + baseURL + `/api/v1/stream/logs/export
          → Export streaming logs (JSON/CSV)

🔧 UTILITY ENDPOINTS:
   POST   ` + baseURL + `/api/v1/stream/broadcast
          → Broadcast message to all streams
   
   GET    ` + baseURL + `/api/v1/health
          → API health check
   
   GET    ` + baseURL + `/api/v1/ping
          → Simple ping test
   
   GET    ` + baseURL + `/api/v1/models
          → List available models

📚 EXAMPLE USAGE:

   # Test streaming with curl:
   curl -N ` + baseURL + `/api/v1/stream/test

   # Stream a completion:
   curl -N -X POST ` + baseURL + `/api/v1/stream/completion \
     -H "Content-Type: application/json" \
     -d '{
       "prompt": "Tell me a story",
       "model": "gpt-3.5-turbo",
       "stream": true,
       "max_tokens": 100
     }'

   # Get streaming metrics:
   curl ` + baseURL + `/api/v1/stream/metrics

   # Check active streams:
   curl ` + baseURL + `/api/v1/stream/active

╔══════════════════════════════════════════════════════════════╗
║  Press Ctrl+C to shutdown gracefully                         ║
╚══════════════════════════════════════════════════════════════╝
	`)
}
