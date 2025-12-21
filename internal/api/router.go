package api

import (
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/streaming"
	"github.com/VighneshDev1411/velocityllm/internal/worker"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/gin-gonic/gin"
)

// Router manages all API routes
type Router struct {
	engine         *gin.Engine
	streamHandlers *StreamHandlers
	workerHandlers *WorkerHandlers
	logger         *utils.Logger
}

// NewRouter creates a new API router
func NewRouter(
	streamManager *streaming.StreamManager,
	sseHandler *streaming.SSEHandler,
	workerPool *worker.WorkerPool,
	logger *utils.Logger,
) *Router {
	// Set Gin mode based on environment
	gin.SetMode(gin.ReleaseMode) // Change to gin.DebugMode for development

	engine := gin.New()

	// Global middleware
	engine.Use(gin.Recovery())
	engine.Use(CORSMiddleware())
	engine.Use(LoggerMiddleware(logger))

	// Create handlers
	streamHandlers := NewStreamHandlers(streamManager, sseHandler, logger)
	workerHandlers := NewWorkerHandlers(workerPool, logger)

	router := &Router{
		engine:         engine,
		streamHandlers: streamHandlers,
		workerHandlers: workerHandlers,
		logger:         logger,
	}

	// Setup routes
	router.setupRoutes()

	return router
}

// setupRoutes configures all API routes
func (r *Router) setupRoutes() {
	// API v1 group
	v1 := r.engine.Group("/api/v1")

	// Health check (no auth required)
	v1.GET("/health", r.HealthCheck)
	v1.GET("/ping", r.Ping)

	// Streaming endpoints
	streamGroup := v1.Group("/stream")
	{
		// Main streaming endpoint
		streamGroup.POST("/completion", r.streamHandlers.StreamCompletion)

		// OpenAI-compatible chat endpoint
		streamGroup.POST("/chat/completions", r.streamHandlers.StreamChatCompletion)

		// Stream management
		streamGroup.GET("/status/:id", r.streamHandlers.GetStreamStatus)
		streamGroup.DELETE("/:id", r.streamHandlers.CancelStream)
		streamGroup.GET("/active", r.streamHandlers.GetActiveStreams)

		// Monitoring & metrics
		streamGroup.GET("/metrics", r.streamHandlers.GetStreamMetrics)
		streamGroup.GET("/stats", r.streamHandlers.GetStreamStats)
		streamGroup.GET("/health", r.streamHandlers.StreamHealthCheck)

		// Testing & utilities
		streamGroup.GET("/test", r.streamHandlers.TestStreamEndpoint)
		streamGroup.POST("/broadcast", r.streamHandlers.BroadcastMessage)
		streamGroup.GET("/logs/export", r.streamHandlers.ExportStreamLogs)
	}

	// Worker pool endpoints
	workerGroup := v1.Group("/worker")
	{
		// Job management
		workerGroup.POST("/jobs", r.workerHandlers.SubmitJob)
		workerGroup.POST("/jobs/batch", r.workerHandlers.BatchSubmitJobs)
		workerGroup.GET("/jobs/:id", r.workerHandlers.GetJobStatus)
		workerGroup.DELETE("/jobs/:id", r.workerHandlers.CancelJob)

		// Worker management
		workerGroup.GET("/workers/:id", r.workerHandlers.GetWorkerDetails)
		workerGroup.GET("/stats", r.workerHandlers.GetWorkerStats)

		// Monitoring & metrics
		workerGroup.GET("/metrics", r.workerHandlers.GetPoolMetrics)
		workerGroup.GET("/health", r.workerHandlers.GetPoolHealth)
		workerGroup.GET("/config", r.workerHandlers.GetPoolConfig)
		workerGroup.GET("/queues", r.workerHandlers.GetQueueStats)
		workerGroup.GET("/performance", r.workerHandlers.GetPerformanceStats)
	}

	// Legacy/Future endpoints placeholder
	// Add your other endpoints here (database, cache, etc.)
	v1.GET("/models", r.ListModels)
	v1.GET("/stats", r.GetSystemStats)
}

// GetEngine returns the Gin engine
func (r *Router) GetEngine() *gin.Engine {
	return r.engine
}

// HealthCheck returns the health status of the API
func (r *Router) HealthCheck(c *gin.Context) {
	c.JSON(200, gin.H{
		"status":  "healthy",
		"service": "VelocityLLM",
		"version": "1.0.0",
	})
}

// Ping returns a simple pong response
func (r *Router) Ping(c *gin.Context) {
	c.JSON(200, gin.H{
		"message": "pong",
	})
}

// ListModels returns available models (placeholder)
func (r *Router) ListModels(c *gin.Context) {
	c.JSON(200, gin.H{
		"models": []string{
			"gpt-3.5-turbo",
			"gpt-4",
			"claude-2",
			"llama-2",
		},
	})
}

// GetSystemStats returns system statistics (placeholder)
func (r *Router) GetSystemStats(c *gin.Context) {
	workerMetrics := r.workerHandlers.pool.GetMetrics()
	streamMetrics := r.streamHandlers.manager.GetMetrics()

	c.JSON(200, gin.H{
		"uptime_seconds": 3600,
		"total_requests": 1000,
		"worker_pool": map[string]interface{}{
			"total_workers":     workerMetrics.TotalWorkers,
			"busy_workers":      workerMetrics.BusyWorkers,
			"jobs_processed":    workerMetrics.TotalJobsProcessed,
			"queue_utilization": workerMetrics.QueueUtilization,
		},
		"streaming": map[string]interface{}{
			"active_streams":    streamMetrics.ActiveStreams,
			"total_streams":     streamMetrics.TotalStreams,
			"completed_streams": streamMetrics.CompletedStreams,
		},
	})
}

// CORSMiddleware handles CORS headers
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}

// LoggerMiddleware logs HTTP requests
func LoggerMiddleware(logger *utils.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Start timer
		start := time.Now()
		path := c.Request.URL.Path
		raw := c.Request.URL.RawQuery

		// Process request
		c.Next()

		// Calculate latency
		latency := time.Since(start)

		// Get status code
		statusCode := c.Writer.Status()

		// Build log message
		if raw != "" {
			path = path + "?" + raw
		}

		logger.Info("HTTP Request",
			"method", c.Request.Method,
			"path", path,
			"status", statusCode,
			"latency_ms", latency.Milliseconds(),
			"client_ip", c.ClientIP(),
		)
	}
}
