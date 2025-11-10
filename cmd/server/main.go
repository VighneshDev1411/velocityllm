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
	// WORKER POOL INITIALIZATION (Day 5 - NEW)
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
