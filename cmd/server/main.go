package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/api"
	"github.com/VighneshDev1411/velocityllm/internal/config"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		utils.Fatal("Failed to load configuration: %v", err)
	}

	utils.Info("Starting %s v%s in %s mode",
		cfg.App.Name,
		cfg.App.Version,
		cfg.App.Environment,
	)

	// Create router and setup routes
	router := api.NewRouter()
	router.SetupRoutes()

	// Create HTTP server
	server := &http.Server{
		Addr:         cfg.GetServerAddr(),
		Handler:      router.GetHandler(),
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
		IdleTimeout:  cfg.Server.IdleTimeout,
	}

	// Start server in a goroutine
	go func() {
		utils.Info("Server starting on %s", cfg.GetServerAddr())
		utils.Info("Environment: %s", cfg.App.Environment)
		utils.Info("Log Level: %s", cfg.App.LogLevel)
		utils.Info("Press Ctrl+C to shutdown")

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			utils.Fatal("Server failed to start: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	utils.Info("Shutting down server...")

	// Create shutdown context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Attempt graceful shutdown
	if err := server.Shutdown(ctx); err != nil {
		utils.Error("Server forced to shutdown: %v", err)
	}

	utils.Info("Server stopped gracefully")
}
