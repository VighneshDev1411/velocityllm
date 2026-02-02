package main

import (
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/api"
	"github.com/VighneshDev1411/velocityllm/internal/cache"
	"github.com/VighneshDev1411/velocityllm/internal/config"
	"github.com/VighneshDev1411/velocityllm/internal/database"
	"github.com/VighneshDev1411/velocityllm/internal/metrics"
	"github.com/VighneshDev1411/velocityllm/internal/middleware"
	"github.com/VighneshDev1411/velocityllm/internal/optimization"
	"github.com/VighneshDev1411/velocityllm/internal/streaming"
	"github.com/VighneshDev1411/velocityllm/internal/worker"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

func main() {
	// Print banner
	printBanner()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to load configuration: %v\n", err)
		os.Exit(1)
	}

	// Initialize logger
	utils.InitLogger(cfg.App.LogLevel)
	utils.Info("Starting VelocityLLM server...")

	// Connect to database
	if err := database.Connect(cfg); err != nil {
		utils.Fatal("Failed to connect to database: %v", err)
	}
	utils.Info("Database connected successfully")

	// Run migrations
	if err := database.Migrate(); err != nil {
		utils.Fatal("Failed to migrate database: %v", err)
	}
	utils.Info("Database migration completed")

	// Seed database with initial data
	if err := database.Seed(); err != nil {
		utils.Fatal("Failed to seed database: %v", err)
	}

	// ============================================
	// CONNECTION POOLING INITIALIZATION (Day 5 Evening)
	// ============================================

	// Database connection pool
	dbPoolConfig := optimization.PoolConfig{
		MinConnections:    5,
		MaxConnections:    20,
		MaxIdleTime:       5 * time.Minute,
		MaxLifetime:       30 * time.Minute,
		HealthCheckPeriod: 1 * time.Minute,
		AcquireTimeout:    5 * time.Second,
	}

	if err := optimization.InitGlobalDBPool(dbPoolConfig, cfg.GetDatabaseDSN()); err != nil {
		utils.Fatal("Failed to initialize database pool: %v", err)
	}
	utils.Info("Database connection pool initialized: %d-%d connections",
		dbPoolConfig.MinConnections, dbPoolConfig.MaxConnections)

	// Redis connection pool
	redisPoolConfig := optimization.PoolConfig{
		MinConnections:    3,
		MaxConnections:    10,
		MaxIdleTime:       5 * time.Minute,
		MaxLifetime:       30 * time.Minute,
		HealthCheckPeriod: 1 * time.Minute,
		AcquireTimeout:    5 * time.Second,
	}

	if err := optimization.InitGlobalRedisPool(redisPoolConfig, cfg.GetRedisAddr(), "", 0); err != nil {
		utils.Fatal("Failed to initialize Redis pool: %v", err)
	}
	utils.Info("Redis connection pool initialized: %d-%d connections",
		redisPoolConfig.MinConnections, redisPoolConfig.MaxConnections)

	// HTTP connection pool
	httpPoolConfig := optimization.PoolConfig{
		MinConnections:    5,
		MaxConnections:    15,
		MaxIdleTime:       5 * time.Minute,
		MaxLifetime:       30 * time.Minute,
		HealthCheckPeriod: 1 * time.Minute,
		AcquireTimeout:    5 * time.Second,
	}

	if err := optimization.InitGlobalHTTPPool(httpPoolConfig, 30*time.Second); err != nil {
		utils.Fatal("Failed to initialize HTTP pool: %v", err)
	}
	utils.Info("HTTP connection pool initialized: %d-%d connections",
		httpPoolConfig.MinConnections, httpPoolConfig.MaxConnections)

	// ============================================
	// REQUEST BATCHING INITIALIZATION (Day 5 Evening)
	// ============================================

	batchConfig := optimization.BatchConfig{
		Enabled:             true,
		MaxBatchSize:        10,
		MaxWaitTime:         100 * time.Millisecond,
		MaxTokens:           4000,
		SimilarityThreshold: 0.8,
	}

	optimization.InitGlobalRequestBatcher(batchConfig)
	utils.Info("Request batcher initialized (max batch: %d, wait: %s)",
		batchConfig.MaxBatchSize, batchConfig.MaxWaitTime)

	// ============================================
	// STREAMING INITIALIZATION (Day 6 - NEW)
	// ============================================

	streamConfig := streaming.StreamConfig{
		BufferSize:    10,
		FlushInterval: 50 * time.Millisecond,
		Timeout:       30 * time.Second,
		MaxTokens:     4000,
		EnableMetrics: true,
	}

	streaming.InitGlobalStreamManager(streamConfig)
	utils.Info("Stream manager initialized (buffer: %d, flush: %s)",
		streamConfig.BufferSize, streamConfig.FlushInterval)

	// Initialize router
	api.InitRouter(nil)

	// ============================================
	// WORKER POOL INITIALIZATION (Day 5 Morning)
	// ============================================

	workerConfig := worker.PoolConfig{
		WorkerCount: 10,
		QueueSize:   100,
		Timeout:     30 * time.Second,
	}

	if err := worker.InitGlobalPool(workerConfig); err != nil {
		utils.Fatal("Failed to initialize worker pool: %v", err)
	}
	utils.Info("Worker pool initialized: %d workers, queue size %d",
		workerConfig.WorkerCount, workerConfig.QueueSize)

	// ============================================
	// RATE LIMITER INITIALIZATION (Day 5 Afternoon)
	// ============================================

	rateLimiterConfig := middleware.RateLimiterConfig{
		RequestsPerMinute: 100,
		BurstSize:         20,
		CleanupInterval:   5 * time.Minute,
	}

	middleware.InitGlobalRateLimiter(rateLimiterConfig)
	utils.Info("Rate limiter initialized (default: %d req/min)",
		rateLimiterConfig.RequestsPerMinute)

	// ============================================
	// BACKPRESSURE HANDLER INITIALIZATION (Day 5 Afternoon)
	// ============================================

	backpressureConfig := middleware.BackpressureConfig{
		EnableLoadShedding: true,
		QueueThreshold:     80.0,
		RejectLowPriority:  true,
		AdaptiveThreshold:  true,
	}

	workerPool := worker.GetGlobalPool()
	middleware.InitGlobalBackpressureHandler(workerPool, backpressureConfig)
	utils.Info("Backpressure handler initialized (threshold: %.1f%%)",
		backpressureConfig.QueueThreshold)

	// ============================================
	// METRICS COLLECTOR INITIALIZATION (Day 5 Afternoon)
	// ============================================

	metricsConfig := metrics.MetricsConfig{
		EnableCollection:   true,
		CollectionInterval: 10 * time.Second,
		RetentionPeriod:    24 * time.Hour,
		MaxDataPoints:      1000,
		EnableTimeSeries:   true,
	}

	metrics.InitGlobalMetricsCollector(metricsConfig)
	utils.Info("Metrics collector initialized (interval: %s)",
		metricsConfig.CollectionInterval)

	// Connect to Redis (legacy)
	if err := cache.Connect(cfg); err != nil {
		utils.Fatal("Failed to connect to Redis: %v", err)
	}
	utils.Info("Redis connected successfully")

	// Setup API routes
	api.SetupRoutes()

	// Start server
	port := fmt.Sprintf("%d", cfg.Server.Port)
	if port == "0" {
		port = "8080"
	}

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      http.DefaultServeMux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		<-sigChan

		utils.Info("Shutting down server...")

		// Shutdown components
		worker.ShutdownGlobalPool()
		utils.Info("Worker pool shutdown complete")

		router := api.GetRouter()
		router.Shutdown()

		database.Close()

		os.Exit(0)
	}()

	utils.Info("Server starting on :%s", port)
	utils.Info("API available at http://localhost:%s", port)
	utils.Info("")
	utils.Info("=== System Components Initialized ===")
	utils.Info("✓ Connection Pools:")
	utils.Info("  - Database: %d-%d connections", dbPoolConfig.MinConnections, dbPoolConfig.MaxConnections)
	utils.Info("  - Redis: %d-%d connections", redisPoolConfig.MinConnections, redisPoolConfig.MaxConnections)
	utils.Info("  - HTTP: %d-%d connections", httpPoolConfig.MinConnections, httpPoolConfig.MaxConnections)
	utils.Info("✓ Request Batching: %d max batch, %s wait", batchConfig.MaxBatchSize, batchConfig.MaxWaitTime)
	utils.Info("✓ Streaming: Buffer %d tokens, flush every %s", streamConfig.BufferSize, streamConfig.FlushInterval)
	utils.Info("✓ Worker Pool: %d workers", workerConfig.WorkerCount)
	utils.Info("✓ Rate Limiter: %d req/min default", rateLimiterConfig.RequestsPerMinute)
	utils.Info("✓ Backpressure: %.0f%% threshold", backpressureConfig.QueueThreshold)
	utils.Info("✓ Metrics: Collecting every %s", metricsConfig.CollectionInterval)
	utils.Info("")
	utils.Info("Total API Endpoints: 56")
	utils.Info("")
	utils.Info("Press Ctrl+C to stop")

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		utils.Fatal("Server failed to start: %v", err)
	}
}

func printBanner() {
	banner := `
╦  ╦┌─┐┬  ┌─┐┌─┐┬┬─┐┬ ┬╦  ╦  ╔╦╗
╚╗╔╝├┤ │  │ ││  │├┬┘└┬┘║  ║  ║║║
 ╚╝ └─┘┴─┘└─┘└─┘┴┴└─ ┴ ╩═╝╩═╝╩ ╩
    Production-Grade LLM Inference Engine
    =====================================
`
	fmt.Println(banner)
}
