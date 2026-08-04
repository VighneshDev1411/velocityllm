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
	"github.com/VighneshDev1411/velocityllm/internal/auth"
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

	// Connect to database + migrate + seed
	if err := database.Connect(cfg); err != nil {
		utils.Fatal("Failed to connect to database", "error", err)
	}
	utils.Info("Database connected successfully")
	if err := database.Migrate(); err != nil {
		utils.Fatal("Failed to migrate database", "error", err)
	}
	if err := database.Seed(); err != nil {
		utils.Fatal("Failed to seed database", "error", err)
	}

	// ── Connection pools ──────────────────────────────────────────────────
	dbPoolConfig := optimization.PoolConfig{
		MinConnections: 5, MaxConnections: 20,
		MaxIdleTime: 5 * time.Minute, MaxLifetime: 30 * time.Minute,
		HealthCheckPeriod: 1 * time.Minute, AcquireTimeout: 5 * time.Second,
	}
	if err := optimization.InitGlobalDBPool(dbPoolConfig, cfg.GetDatabaseDSN()); err != nil {
		utils.Fatal("Failed to initialize database pool", "error", err)
	}

	redisPoolConfig := optimization.PoolConfig{
		MinConnections: 3, MaxConnections: 10,
		MaxIdleTime: 5 * time.Minute, MaxLifetime: 30 * time.Minute,
		HealthCheckPeriod: 1 * time.Minute, AcquireTimeout: 5 * time.Second,
	}
	if err := optimization.InitGlobalRedisPool(redisPoolConfig, cfg.GetRedisAddr(), cfg.Redis.Password, cfg.Redis.DB); err != nil {
		utils.Warn("Redis pool unavailable (non-fatal): %v", err)
	}

	httpPoolConfig := optimization.PoolConfig{
		MinConnections: 5, MaxConnections: 15,
		MaxIdleTime: 5 * time.Minute, MaxLifetime: 30 * time.Minute,
		HealthCheckPeriod: 1 * time.Minute, AcquireTimeout: 5 * time.Second,
	}
	if err := optimization.InitGlobalHTTPPool(httpPoolConfig, 30*time.Second); err != nil {
		utils.Fatal("Failed to initialize HTTP pool", "error", err)
	}

	// Request batching
	optimization.InitGlobalRequestBatcher(optimization.BatchConfig{
		Enabled: true, MaxBatchSize: 10, MaxWaitTime: 100 * time.Millisecond,
		MaxTokens: 4000, SimilarityThreshold: 0.8,
	})

	// Streaming
	streaming.InitGlobalStreamManager(streaming.StreamConfig{
		BufferSize: 10, FlushInterval: 50 * time.Millisecond,
		Timeout: 30 * time.Second, MaxTokens: 4000, EnableMetrics: true,
	})

	// Router / model registry
	api.InitRouter(nil)

	// Worker pool
	if err := worker.InitGlobalPool(worker.PoolConfig{WorkerCount: 10, QueueSize: 100, Timeout: 30 * time.Second}); err != nil {
		utils.Fatal("Failed to initialize worker pool", "error", err)
	}

	// Rate limiter
	rateLimiterConfig := middleware.RateLimiterConfig{RequestsPerMinute: 100, BurstSize: 20, CleanupInterval: 5 * time.Minute}
	middleware.InitGlobalRateLimiter(rateLimiterConfig)

	// Backpressure
	middleware.InitGlobalBackpressureHandler(worker.GetGlobalPool(), middleware.BackpressureConfig{
		EnableLoadShedding: true, QueueThreshold: 80.0, RejectLowPriority: true, AdaptiveThreshold: true,
	})

	// Metrics collector
	metrics.InitGlobalMetricsCollector(metrics.MetricsConfig{
		EnableCollection: true, CollectionInterval: 10 * time.Second,
		RetentionPeriod: 24 * time.Hour, MaxDataPoints: 1000, EnableTimeSeries: true,
	})

	// Redis (caching layer) — optional; server runs without it
	if err := cache.Connect(cfg); err != nil {
		utils.Warn("Redis unavailable (non-fatal): %v — caching disabled", err)
	} else {
		utils.Info("Redis connected successfully")
	}

	// Advanced cache manager (multi-level + semantic + analytics + tags)
	cache.InitGlobalCacheManager(cache.CacheManagerConfig{
		EnableMultiLevel: true, L1MaxSize: 10000, L1MaxMemoryMB: 100,
		L1TTL: 5 * time.Minute, L2TTL: 30 * time.Minute, WriteThrough: true,
		EnableSemantic: true, SemanticThreshold: 0.85, SemanticMaxEntries: 5000, SemanticEmbeddingDim: 384,
		EnableAnalytics: true, LegacyTTL: 10 * time.Minute,
	})
	cache.InitGlobalTaggedCache()

	// ── Auth & users ──────────────────────────────────────────────────────
	db := database.GetDB()
	if db == nil {
		utils.Fatal("Database not initialized")
	}
	if err := db.AutoMigrate(&auth.User{}); err != nil {
		utils.Fatal("Failed to migrate user table", "error", err)
	}
	auth.InitGlobalService(db)
	authService := auth.GetGlobalService()
	if err := authService.AutoMigrateUserManagement(); err != nil {
		utils.Fatal("Failed to migrate user management tables", "error", err)
	}
	if err := authService.AutoMigrateAPIKeys(); err != nil {
		utils.Fatal("Failed to migrate API key tables", "error", err)
	}
	utils.Info("Authentication service initialized")

	// Routes
	api.SetupRoutes()
	api.MarkReady()

	// Start server
	port := fmt.Sprintf("%d", cfg.Server.Port)
	if port == "0" {
		port = "8080"
	}
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      middleware.NewResponseCacheMiddleware(middleware.DefaultResponseCacheConfig())(api.HTTPCORSMiddleware(http.DefaultServeMux)),
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

		shutCtx, shutCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutCancel()

		worker.ShutdownGlobalPool()
		api.GetRouter().Shutdown()
		database.Close()

		_ = shutCtx
		os.Exit(0)
	}()

	utils.Info("Server starting on :%s", port)
	utils.Info("API available at http://localhost:%s", port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		utils.Fatal("Server failed to start", "error", err)
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
