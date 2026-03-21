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
	"github.com/VighneshDev1411/velocityllm/internal/billing"
	"github.com/VighneshDev1411/velocityllm/internal/cache"
	"github.com/VighneshDev1411/velocityllm/internal/cluster"
	"github.com/VighneshDev1411/velocityllm/internal/loadbalancer"
	"github.com/VighneshDev1411/velocityllm/internal/config"
	"github.com/VighneshDev1411/velocityllm/internal/database"
	"github.com/VighneshDev1411/velocityllm/internal/loadtest"
	"github.com/VighneshDev1411/velocityllm/internal/metrics"
	"github.com/VighneshDev1411/velocityllm/internal/middleware"
	"github.com/VighneshDev1411/velocityllm/internal/optimization"
	"github.com/VighneshDev1411/velocityllm/internal/prompts"
	"github.com/VighneshDev1411/velocityllm/internal/quota"
	"github.com/VighneshDev1411/velocityllm/internal/router"
	"github.com/VighneshDev1411/velocityllm/internal/streaming"
	"github.com/VighneshDev1411/velocityllm/internal/tokens"
	"github.com/VighneshDev1411/velocityllm/internal/notifications"
	webhooksPkg "github.com/VighneshDev1411/velocityllm/internal/webhooks"
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
		utils.Fatal("Failed to connect to database", "error", err)
	}
	utils.Info("Database connected successfully")

	// Run migrations
	if err := database.Migrate(); err != nil {
		utils.Fatal("Failed to migrate database", "error", err)
	}
	utils.Info("Database migration completed")

	// Seed database with initial data
	if err := database.Seed(); err != nil {
		utils.Fatal("Failed to seed database", "error", err)
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
		utils.Fatal("Failed to initialize database pool", "error", err)
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
		utils.Warn("Redis pool unavailable (non-fatal): %v", err)
	} else {
		utils.Info("Redis connection pool initialized: %d-%d connections",
			redisPoolConfig.MinConnections, redisPoolConfig.MaxConnections)
	}

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
		utils.Fatal("Failed to initialize HTTP pool", "error", err)
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
		utils.Fatal("Failed to initialize worker pool", "error", err)
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

	// Connect to Redis (legacy) — optional, server runs without it
	if err := cache.Connect(cfg); err != nil {
		utils.Warn("Redis unavailable (non-fatal): %v — caching disabled", err)
	} else {
		utils.Info("Redis connected successfully")
	}

	// ============================================
	// CLUSTER / HORIZONTAL SCALING INIT (Day 32)
	// ============================================

	// Build a stable node ID: prefer NODE_ID env var, else hostname:port
	nodeID := cfg.Cluster.NodeID
	if nodeID == "" {
		hostname, _ := os.Hostname()
		nodeID = fmt.Sprintf("%s:%d", hostname, cfg.Server.Port)
	}

	rdb := cache.GetClient()

	if rdb != nil {
		// 1. Node registry — registers this instance & starts heartbeat
		nodeRegistry := cluster.InitGlobalNodeRegistry(rdb, nodeID, cfg.App.Version, cfg.Server.Port)
		clusterCtx := context.Background()
		if err := nodeRegistry.Register(clusterCtx); err != nil {
			utils.Error("Failed to register cluster node (non-fatal): %v", err)
		}

		// 2. Cluster coordinator — leader election
		coordinator := cluster.InitGlobalCoordinator(nodeRegistry, rdb)
		coordinator.Start(clusterCtx)

		// 3. Distributed rate limiter — Redis sliding-window, cluster-wide limits
		middleware.InitGlobalDistributedRateLimiter(rdb, rateLimiterConfig)
		utils.Info("Distributed rate limiter initialised (Redis sliding-window)")

		utils.Info("Cluster initialised: node=%s", nodeID)
	} else {
		utils.Warn("Skipping cluster/rate-limiter init (Redis unavailable)")
	}

	// ============================================
	// LOAD BALANCER INIT (Day 33)
	// ============================================
	// Seed with the current node as the only backend.
	// In a multi-node deployment, additional backends are discovered via the
	// Node Registry and added with lb.AddBackend().
	selfBackend := &loadbalancer.Backend{
		ID:      nodeID,
		Address: fmt.Sprintf("127.0.0.1:%d", cfg.Server.Port),
		Weight:  100,
		Active:  true,
		Healthy: true,
	}
	lb := loadbalancer.InitGlobal(loadbalancer.AlgorithmLeastConnections, []*loadbalancer.Backend{selfBackend})

	// Health checker probes backends every 15s
	lbHealthChecker := loadbalancer.NewHealthChecker(lb, 15*time.Second, 3*time.Second, "/health/live")
	lbHealthChecker.Start()

	utils.Info("Load balancer initialised: algorithm=least_connections backends=1")

	// ============================================
	// ADVANCED CACHING INITIALIZATION (Day 7)
	// ============================================
	cacheManagerConfig := cache.CacheManagerConfig{
		// Multi-level cache
		EnableMultiLevel: true,
		L1MaxSize:        10000,         // 10k entries in L1
		L1MaxMemoryMB:    100,           // 100 MB for L1
		L1TTL:            5 * time.Minute,  // L1 TTL: 5 minutes
		L2TTL:            30 * time.Minute, // L2 TTL: 30 minutes
		WriteThrough:     true,          // Write to both L1 and L2

		// Semantic cache
		EnableSemantic:       true,
		SemanticThreshold:    0.85,  // 85% similarity required
		SemanticMaxEntries:   5000,  // Max semantic cache entries
		SemanticEmbeddingDim: 384,   // Embedding dimension

		// Analytics
		EnableAnalytics: true,

		// Legacy compatibility
		LegacyTTL: 10 * time.Minute,
	}

	cache.InitGlobalCacheManager(cacheManagerConfig)
	cache.InitGlobalTaggedCache()
	utils.Info("Advanced cache manager initialized (multi-level + semantic + analytics + tags)")

	// ============================================
	// ORCHESTRATION INITIALIZATION (Day 8)
	// ============================================
	orchestrator := router.NewOrchestrator(nil)

	// Register example chains
	// Chain 1: Simple sequential chain
	simpleChain := router.NewModelChain("simple-chain").
		AddStep(router.ChainStep{
			Name:    "analyze",
			ModelID: "gpt-3.5-turbo",
			Type:    router.StepTypeSequential,
		}).
		AddStep(router.ChainStep{
			Name:      "refine",
			ModelID:   "gpt-4",
			Type:      router.StepTypeSequential,
			Transform: router.ChainPreviousResultTransform(),
		})
	orchestrator.RegisterChain(simpleChain)

	// Chain 2: Conditional chain with fallback
	conditionalChain := router.NewModelChain("conditional-chain").
		AddStep(router.ChainStep{
			Name:    "primary",
			ModelID: "gpt-4",
			Type:    router.StepTypeSequential,
			Timeout: 5 * time.Second,
			Optional: false,
		}).
		AddStep(router.ChainStep{
			Name:      "fallback",
			ModelID:   "gpt-3.5-turbo",
			Type:      router.StepTypeConditional,
			Condition: router.OnlyIfPreviousSucceededCondition(),
			Optional:  true,
		})
	orchestrator.RegisterChain(conditionalChain)

	api.SetOrchestrator(orchestrator)
	utils.Info("Orchestrator initialized successfully")

	// ============================================
	// PROMPT TEMPLATE INITIALIZATION (Day 9)
	// ============================================
	prompts.InitGlobalManager()
	utils.Info("Prompt template manager initialized with default templates")

	// ============================================
	// TOKEN & CONTEXT MANAGEMENT (Day 10)
	// ============================================
	tokens.InitGlobalContextManager(tokens.ContextConfig{
		MaxContextAge:     30 * time.Minute,
		CleanupInterval:   5 * time.Minute,
		DefaultMaxTokens:  4096,
		EnableAutoCleanup: true,
	})
	utils.Info("Context manager initialized (max age: 30m, auto-cleanup enabled)")

	// ============================================
	// AUTHENTICATION & USER MANAGEMENT (Day 12)
	// ============================================

	// Get database instance
	db := database.GetDB()
	if db == nil {
		utils.Fatal("Database not initialized")
	}

	// Auto-migrate user table
	if err := db.AutoMigrate(&auth.User{}); err != nil {
		utils.Fatal("Failed to migrate user table", "error", err)
	}
	utils.Info("User table migrated successfully")

	// Initialize auth service
	auth.InitGlobalService(db)
	utils.Info("Authentication service initialized")

	// Auto-migrate user management tables (Day 19)
	authService := auth.GetGlobalService()
	if err := authService.AutoMigrateUserManagement(); err != nil {
		utils.Fatal("Failed to migrate user management tables", "error", err)
	}
	utils.Info("User management tables migrated (activity_logs, teams, team_members)")

	// Auto-migrate API key tables (Day 20)
	if err := authService.AutoMigrateAPIKeys(); err != nil {
		utils.Fatal("Failed to migrate API key tables", "error", err)
	}
	utils.Info("API key tables migrated (api_keys, api_key_usage_logs)")

	// Initialize billing service (Day 21)
	billingService := billing.NewService(db)
	if err := billingService.AutoMigrate(); err != nil {
		utils.Fatal("Failed to migrate billing tables", "error", err)
	}
	api.InitBillingService(billingService)
	utils.Info("Billing service initialized (subscriptions, invoices, usage_records)")

	// Initialize quota service (Day 22)
	quota.InitGlobalService(db, billingService)
	if err := quota.AutoMigrate(db); err != nil {
		utils.Fatal("Failed to migrate quota tables", "error", err)
	}
	utils.Info("Quota service initialized (user_quotas, quota_usage, usage_alerts, alert_configurations, rate_limit_events)")

	// Initialize load test service (Day 23)
	loadtest.InitGlobalService(db)
	if err := loadtest.AutoMigrate(db); err != nil {
		utils.Fatal("Failed to migrate load test tables", "error", err)
	}
	utils.Info("Load test service initialized (load_test_configs, load_test_runs, load_test_metrics, request_results, benchmark_comparisons)")

	// Initialize webhook service (Day 24)
	webhooksPkg.InitGlobalService(db)
	if err := webhooksPkg.AutoMigrate(db); err != nil {
		utils.Fatal("Failed to migrate webhook tables", "error", err)
	}
	utils.Info("Webhook service initialized (webhook_endpoints, webhook_deliveries, event_logs)")

	// Initialize notification service (Day 44)
	notifications.GetService()
	utils.Info("Notification service initialized")

	// Setup API routes
	api.SetupRoutes()

	// Signal that all components are initialised (readiness / startup probes)
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

		// Mark node as draining so load balancer stops sending traffic
		if reg := cluster.GetGlobalNodeRegistry(); reg != nil {
			reg.SetDraining(shutCtx)
		}
		lbHealthChecker.Stop()

		// Stop coordinator (releases leader lock if held)
		if coord := cluster.GetGlobalCoordinator(); coord != nil {
			coord.Stop()
		}

		// Deregister node from cluster
		if reg := cluster.GetGlobalNodeRegistry(); reg != nil {
			reg.Deregister(shutCtx)
		}

		worker.ShutdownGlobalPool()
		utils.Info("Worker pool shutdown complete")

		r := api.GetRouter()
		r.Shutdown()

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
	utils.Info("✓ Cluster Node: %s", nodeID)
	utils.Info("  - Node registry: active (heartbeat every 10s)")
	utils.Info("  - Leader election: running")
	utils.Info("  - Distributed rate limiter: Redis sliding-window")
	utils.Info("  - Distributed locks: Redis SETNX + Lua")
	utils.Info("")
	utils.Info("✓ Load Balancer: algorithm=least_connections")
	utils.Info("  - Health probes: /health/live, /health/ready, /health/startup")
	utils.Info("  - Nginx config:  deployments/nginx/nginx.conf")
	utils.Info("  - HAProxy config: deployments/haproxy/haproxy.cfg")
	utils.Info("")
	utils.Info("Total API Endpoints: 66")
	utils.Info("")
	utils.Info("Press Ctrl+C to stop")

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
