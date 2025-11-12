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
	"github.com/VighneshDev1411/velocityllm/internal/router"
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

	// Initialize router
	router.InitGlobalRouter(nil) // nil = use default config

	// ============================================
	// WORKER POOL INITIALIZATION (Day 5)
	// ============================================

	// Configure worker pool
	workerConfig := worker.PoolConfig{
		WorkerCount: 10,               // 10 concurrent workers
		QueueSize:   100,              // Queue up to 100 jobs
		Timeout:     30 * time.Second, // 30 second timeout
	}

	// Initialize and start worker pool
	if err := worker.InitGlobalPool(workerConfig); err != nil {
		utils.Fatal("Failed to initialize worker pool: %v", err)
	}
	utils.Info("Worker pool initialized: %d workers, queue size %d",
		workerConfig.WorkerCount, workerConfig.QueueSize)

	// ============================================
	// RATE LIMITER INITIALIZATION (Day 5 - NEW)
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
	// BACKPRESSURE HANDLER INITIALIZATION (Day 5 - NEW)
	// ============================================

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
	// METRICS COLLECTOR INITIALIZATION (Day 5 - NEW)
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

	// Connect to Redis
	if err := cache.Connect(cfg); err != nil {
		utils.Fatal("Failed to connect to Redis: %v", err)
	}
	utils.Info("Redis connected successfully")

	// Setup API routes
	api.SetupRoutes()

	// Start server
	server := &http.Server{
		Addr:         cfg.GetServerAddr(),
		Handler:      http.DefaultServeMux,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
		IdleTimeout:  cfg.Server.IdleTimeout,
	}

	// Graceful shutdown
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		<-sigChan

		utils.Info("Shutting down server...")

		// Shutdown worker pool
		worker.ShutdownGlobalPool()
		utils.Info("Worker pool shutdown complete")

		// Shutdown router
		routerInstance := router.GetGlobalRouter()
		routerInstance.Shutdown()

		// Close database
		database.Close()

		os.Exit(0)
	}()

	utils.Info("Server starting on %s", cfg.GetServerAddr())
	utils.Info("API available at http://localhost:%d", cfg.Server.Port)
	utils.Info("")
	utils.Info("=== System Components Initialized ===")
	utils.Info("✓ Worker Pool: %d workers", workerConfig.WorkerCount)
	utils.Info("✓ Rate Limiter: %d req/min default", rateLimiterConfig.RequestsPerMinute)
	utils.Info("✓ Backpressure: %.0f%% threshold", backpressureConfig.QueueThreshold)
	utils.Info("✓ Metrics: Collecting every %s", metricsConfig.CollectionInterval)
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
