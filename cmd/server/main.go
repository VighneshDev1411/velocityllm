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
	"github.com/VighneshDev1411/velocityllm/internal/worker"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

func main() {
	// Print banner
	printBanner()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		utils.Fatal("Failed to load configuration: %v", err)
	}

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

	if err := optimization.InitGlobalRedisPool(redisPoolConfig, cfg.GetRedisAddr(), cfg.Redis.Password, cfg.Redis.DB); err != nil {
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
	// REQUEST BATCHING INITIALIZATION (Day 5 Evening - NEW)
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

	rateLimiterConfig := middleware.RateLimiterConfig{
		RequestsPerMinute: 100,
		BurstSize:         20,
		CleanupInterval:   5 * time.Minute,
	}

	middleware.InitGlobalRateLimiter(rateLimiterConfig)
	utils.Info("Rate limiter initialized (default: %d req/min)",
		rateLimiterConfig.RequestsPerMinute)

	backpressureConfig := middleware.BackpressureConfig{
		EnableLoadShedding: true,
		QueueThreshold:     80.0,
		RejectLowPriority:  true,
		AdaptiveThreshold:  true,
	}

	middleware.InitGlobalBackpressureHandler(backpressureConfig)
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

	// Connect to Redis (legacy, will be replaced by pool)
	if err := cache.Connect(cfg); err != nil {
		utils.Fatal("Failed to connect to Redis: %v", err)
	}
	utils.Info("Redis connected successfully")

	// Setup API routes
	api.SetupRoutes()

	// Start server
	port := fmt.Sprintf("%d", cfg.Server.Port)

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

		// Shutdown components in order
		worker.ShutdownGlobalPool()
		utils.Info("Worker pool shutdown complete")

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
	utils.Info("✓ Worker Pool: %d workers", workerConfig.WorkerCount)
	utils.Info("✓ Rate Limiter: %d req/min default", rateLimiterConfig.RequestsPerMinute)
	utils.Info("✓ Backpressure: %.0f%% threshold", backpressureConfig.QueueThreshold)
	utils.Info("✓ Metrics: Collecting every %s", metricsConfig.CollectionInterval)
	utils.Info("")
	utils.Info("Total API Endpoints: 52")
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
