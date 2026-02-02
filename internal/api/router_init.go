package api

import (
	"context"

	"github.com/VighneshDev1411/velocityllm/internal/streaming"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// SimpleRouter holds router components for shutdown
type SimpleRouter struct {
	streamManager *streaming.StreamManager
}

var globalRouter *SimpleRouter

// InitRouter initializes the router (placeholder for compatibility)
func InitRouter(config interface{}) {
	manager := streaming.GetGlobalStreamManager()
	globalRouter = &SimpleRouter{
		streamManager: manager,
	}
	utils.Info("Router initialized")
}

// GetRouter returns the global router
func GetRouter() *SimpleRouter {
	return globalRouter
}

// Shutdown gracefully shuts down router components
func (r *SimpleRouter) Shutdown() {
	if r == nil {
		return
	}

	if r.streamManager != nil {
		ctx := context.Background()
		r.streamManager.Shutdown(ctx)
		utils.Info("Stream manager shut down")
	}
}

// Additional handlers file content will be added in a separate file
