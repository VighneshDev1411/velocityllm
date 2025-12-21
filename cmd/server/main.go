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
	"github.com/VighneshDev1411/velocityllm/internal/worker"
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
	logger.Info("Starting VelocityLLM Server - Day 7: Worker Pool & gRPC")

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
	)

	// Initialize worker pool
	logger.Info("Initializing worker pool")

	workerPoolConfig := worker.DefaultWorkerPoolConfig()
	workerPool := worker.NewWorkerPool(workerPoolConfig, logger)

	logger.Info("Worker pool initialized",
		"min_workers", workerPoolConfig.MinWorkers,
		"max_workers", workerPoolConfig.MaxWorkers,
		"queue_size", workerPoolConfig.QueueSize,
	)

	// Initialize router
	logger.Info("Setting up API routes")
	router := api.NewRouter(streamManager, sseHandler, workerPool, logger)

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

	// Shutdown worker pool first
	logger.Info("Shutting down worker pool")
	if err := workerPool.Shutdown(ctx); err != nil {
		logger.Error("Worker pool shutdown error", "error", err)
	}

	// Shutdown stream manager
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
║         VelocityLLM API Endpoints - Day 7 Edition           ║
╚══════════════════════════════════════════════════════════════╝

📡 STREAMING ENDPOINTS (Day 6):
   POST   ` + baseURL + `/api/v1/stream/completion
   POST   ` + baseURL + `/api/v1/stream/chat/completions
   GET    ` + baseURL + `/api/v1/stream/test
   GET    ` + baseURL + `/api/v1/stream/metrics
   GET    ` + baseURL + `/api/v1/stream/health

⚙️  WORKER POOL ENDPOINTS (Day 7 - NEW!):
   POST   ` + baseURL + `/api/v1/worker/jobs
          → Submit a job to the worker pool
   
   POST   ` + baseURL + `/api/v1/worker/jobs/batch
          → Submit multiple jobs at once
   
   GET    ` + baseURL + `/api/v1/worker/jobs/:id
          → Get job status by ID
   
   DELETE ` + baseURL + `/api/v1/worker/jobs/:id
          → Cancel a pending/running job
   
   GET    ` + baseURL + `/api/v1/worker/workers/:id
          → Get worker details by ID

📊 WORKER MONITORING (Day 7 - NEW!):
   GET    ` + baseURL + `/api/v1/worker/metrics
          → Worker pool performance metrics
   
   GET    ` + baseURL + `/api/v1/worker/stats
          → Detailed worker statistics
   
   GET    ` + baseURL + `/api/v1/worker/health
          → Worker pool health check
   
   GET    ` + baseURL + `/api/v1/worker/config
          → Worker pool configuration
   
   GET    ` + baseURL + `/api/v1/worker/queues
          → Job queue statistics
   
   GET    ` + baseURL + `/api/v1/worker/performance
          → Performance metrics

🔧 SYSTEM ENDPOINTS:
   GET    ` + baseURL + `/api/v1/health
          → Overall system health
   
   GET    ` + baseURL + `/api/v1/stats
          → System statistics (streaming + workers)

📚 EXAMPLE USAGE:

   # Submit a job to worker pool:
   curl -X POST ` + baseURL + `/api/v1/worker/jobs \
     -H "Content-Type: application/json" \
     -d '{
       "type": "inference",
       "priority": "high",
       "payload": {
         "prompt": "Hello, world!",
         "model": "gpt-3.5-turbo"
       },
       "timeout_seconds": 60
     }'

   # Check job status:
   curl ` + baseURL + `/api/v1/worker/jobs/{job_id}

   # Get worker pool metrics:
   curl ` + baseURL + `/api/v1/worker/metrics

   # Get worker pool health:
   curl ` + baseURL + `/api/v1/worker/health

   # Batch submit jobs:
   curl -X POST ` + baseURL + `/api/v1/worker/jobs/batch \
     -H "Content-Type: application/json" \
     -d '{
       "jobs": [
         {"type": "inference", "priority": "high", "payload": {...}},
         {"type": "inference", "priority": "normal", "payload": {...}}
       ]
     }'

   # Stream completion (from Day 6):
   curl -N -X POST ` + baseURL + `/api/v1/stream/completion \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Hello", "stream": true}'

╔══════════════════════════════════════════════════════════════╗
║  Day 7 Complete: Worker Pool + gRPC Ready! 🎉               ║
║  Total Endpoints: 74+                                        ║
║  Press Ctrl+C to shutdown gracefully                         ║
╚══════════════════════════════════════════════════════════════╝
	`)
}
