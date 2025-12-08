package streaming

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// StreamManager manages all active streaming connections
type StreamManager struct {
	connections map[string]*StreamConnection // Active connections by ID
	mu          sync.RWMutex                 // Protects connections map
	metrics     *StreamMetrics               // Stream metrics
	logger      *utils.Logger                // Logger instance

	// Configuration
	maxConnections     int           // Max concurrent connections
	idleTimeout        time.Duration // Timeout for idle connections
	cleanupInterval    time.Duration // How often to cleanup stale connections
	maxEventBufferSize int           // Max events to buffer per connection

	// Cleanup
	stopCleanup chan struct{}  // Signal to stop cleanup goroutine
	wg          sync.WaitGroup // Wait for cleanup goroutine
}

// StreamManagerConfig holds configuration for stream manager
type StreamManagerConfig struct {
	MaxConnections     int
	IdleTimeout        time.Duration
	CleanupInterval    time.Duration
	MaxEventBufferSize int
}

// DefaultStreamManagerConfig returns default configuration
func DefaultStreamManagerConfig() *StreamManagerConfig {
	return &StreamManagerConfig{
		MaxConnections:     1000,            // Max 1000 concurrent streams
		IdleTimeout:        5 * time.Minute, // 5 min idle timeout
		CleanupInterval:    1 * time.Minute, // Cleanup every minute
		MaxEventBufferSize: 100,             // Buffer 100 events
	}
}

// NewStreamManager creates a new stream manager
func NewStreamManager(config *StreamManagerConfig, logger *utils.Logger) *StreamManager {
	if config == nil {
		config = DefaultStreamManagerConfig()
	}

	sm := &StreamManager{
		connections:        make(map[string]*StreamConnection),
		metrics:            &StreamMetrics{LastUpdated: time.Now()},
		logger:             logger,
		maxConnections:     config.MaxConnections,
		idleTimeout:        config.IdleTimeout,
		cleanupInterval:    config.CleanupInterval,
		maxEventBufferSize: config.MaxEventBufferSize,
		stopCleanup:        make(chan struct{}),
	}

	// Start background cleanup goroutine
	sm.wg.Add(1)
	go sm.cleanupRoutine()

	return sm
}

// CreateStream creates a new streaming connection
func (sm *StreamManager) CreateStream(ctx context.Context, requestID string, streamType StreamType) (*StreamConnection, error) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	// Check if we've hit max connections
	if len(sm.connections) >= sm.maxConnections {
		return nil, fmt.Errorf("max concurrent streams reached (%d)", sm.maxConnections)
	}

	// Generate unique stream ID
	streamID := uuid.New().String()

	// Create new connection
	conn := NewStreamConnection(streamID, requestID, streamType, ctx)

	// Store connection
	sm.connections[streamID] = conn

	// Update metrics
	sm.metrics.UpdateMetrics(conn, false)

	sm.logger.Info("Stream created",
		"stream_id", streamID,
		"request_id", requestID,
		"type", streamType,
		"active_streams", len(sm.connections),
	)

	return conn, nil
}

// GetStream retrieves a stream by ID
func (sm *StreamManager) GetStream(streamID string) (*StreamConnection, error) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	conn, exists := sm.connections[streamID]
	if !exists {
		return nil, ErrStreamNotFound
	}

	return conn, nil
}

// CloseStream closes a stream connection
func (sm *StreamManager) CloseStream(streamID string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	conn, exists := sm.connections[streamID]
	if !exists {
		return ErrStreamNotFound
	}

	// Close the connection
	conn.Close()

	// Update metrics
	sm.metrics.UpdateMetrics(conn, true)

	// Remove from active connections
	delete(sm.connections, streamID)

	sm.logger.Info("Stream closed",
		"stream_id", streamID,
		"duration_ms", time.Since(conn.StartTime).Milliseconds(),
		"events_sent", conn.EventCount,
		"bytes_sent", conn.BytesSent,
	)

	return nil
}

// CancelStream cancels a stream connection
func (sm *StreamManager) CancelStream(streamID string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	conn, exists := sm.connections[streamID]
	if !exists {
		return ErrStreamNotFound
	}

	// Cancel the connection
	conn.mu.Lock()
	conn.Status = StreamStatusCancelled
	conn.Cancel()
	conn.mu.Unlock()

	// Update metrics
	sm.metrics.IncrementCancelled()

	// Remove from active connections
	delete(sm.connections, streamID)

	sm.logger.Info("Stream cancelled",
		"stream_id", streamID,
		"duration_ms", time.Since(conn.StartTime).Milliseconds(),
	)

	return nil
}

// StreamError marks a stream as errored
func (sm *StreamManager) StreamError(streamID string, err error) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	conn, exists := sm.connections[streamID]
	if !exists {
		return ErrStreamNotFound
	}

	// Set error on connection
	conn.SetError(err)

	// Update metrics
	sm.metrics.IncrementErrored()

	// Remove from active connections
	delete(sm.connections, streamID)

	sm.logger.Error("Stream error",
		"stream_id", streamID,
		"error", err,
		"duration_ms", time.Since(conn.StartTime).Milliseconds(),
	)

	return nil
}

// SendEvent sends an event to a specific stream
func (sm *StreamManager) SendEvent(streamID string, event StreamEvent) error {
	conn, err := sm.GetStream(streamID)
	if err != nil {
		return err
	}

	return conn.SendEvent(event)
}

// BroadcastEvent sends an event to all active streams (useful for system messages)
func (sm *StreamManager) BroadcastEvent(event StreamEvent) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	for streamID, conn := range sm.connections {
		if err := conn.SendEvent(event); err != nil {
			sm.logger.Warn("Failed to broadcast event",
				"stream_id", streamID,
				"error", err,
			)
		}
	}
}

// GetActiveStreams returns all active stream connections
func (sm *StreamManager) GetActiveStreams() []*StreamConnection {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	streams := make([]*StreamConnection, 0, len(sm.connections))
	for _, conn := range sm.connections {
		streams = append(streams, conn)
	}

	return streams
}

// GetStreamStatus returns the status of a specific stream
func (sm *StreamManager) GetStreamStatus(streamID string) (map[string]interface{}, error) {
	conn, err := sm.GetStream(streamID)
	if err != nil {
		return nil, err
	}

	return conn.GetMetadata(), nil
}

// GetMetrics returns current stream metrics
func (sm *StreamManager) GetMetrics() StreamMetrics {
	return sm.metrics.GetSnapshot()
}

// GetStats returns detailed statistics
func (sm *StreamManager) GetStats() map[string]interface{} {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	metrics := sm.metrics.GetSnapshot()

	// Calculate additional stats
	activeByType := make(map[StreamType]int)
	oldestStream := time.Now()
	totalEvents := 0
	totalBytes := int64(0)

	for _, conn := range sm.connections {
		conn.mu.RLock()
		activeByType[conn.Type]++
		if conn.StartTime.Before(oldestStream) {
			oldestStream = conn.StartTime
		}
		totalEvents += conn.EventCount
		totalBytes += conn.BytesSent
		conn.mu.RUnlock()
	}

	return map[string]interface{}{
		"metrics":                   metrics,
		"active_connections":        len(sm.connections),
		"active_by_type":            activeByType,
		"oldest_stream_age_seconds": time.Since(oldestStream).Seconds(),
		"current_total_events":      totalEvents,
		"current_total_bytes":       totalBytes,
		"max_connections":           sm.maxConnections,
		"idle_timeout_seconds":      sm.idleTimeout.Seconds(),
	}
}

// cleanupRoutine runs periodic cleanup of stale connections
func (sm *StreamManager) cleanupRoutine() {
	defer sm.wg.Done()

	ticker := time.NewTicker(sm.cleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			sm.cleanup()
		case <-sm.stopCleanup:
			sm.logger.Info("Stream cleanup routine stopping")
			return
		}
	}
}

// cleanup removes idle and stale connections
func (sm *StreamManager) cleanup() {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	now := time.Now()
	toRemove := []string{}

	for streamID, conn := range sm.connections {
		conn.mu.RLock()

		// Check if stream is idle
		idleDuration := now.Sub(conn.LastEventTime)
		isIdle := idleDuration > sm.idleTimeout

		// Check if stream is in terminal state
		isTerminal := conn.Status != StreamStatusActive

		conn.mu.RUnlock()

		if isIdle || isTerminal {
			toRemove = append(toRemove, streamID)

			sm.logger.Info("Cleaning up stream",
				"stream_id", streamID,
				"reason", map[bool]string{true: "idle", false: "terminal"}[isIdle],
				"idle_duration_seconds", idleDuration.Seconds(),
			)
		}
	}

	// Remove stale connections
	for _, streamID := range toRemove {
		conn := sm.connections[streamID]
		conn.Close()
		delete(sm.connections, streamID)
	}

	if len(toRemove) > 0 {
		sm.logger.Info("Cleanup completed",
			"removed_count", len(toRemove),
			"active_streams", len(sm.connections),
		)
	}
}

// Shutdown gracefully shuts down the stream manager
func (sm *StreamManager) Shutdown(ctx context.Context) error {
	sm.logger.Info("Shutting down stream manager",
		"active_streams", len(sm.connections),
	)

	// Stop cleanup routine
	close(sm.stopCleanup)

	// Close all active streams
	sm.mu.Lock()
	for streamID, conn := range sm.connections {
		conn.Close()
		sm.logger.Info("Closed stream during shutdown", "stream_id", streamID)
	}
	sm.connections = make(map[string]*StreamConnection)
	sm.mu.Unlock()

	// Wait for cleanup goroutine with timeout
	done := make(chan struct{})
	go func() {
		sm.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		sm.logger.Info("Stream manager shutdown complete")
		return nil
	case <-ctx.Done():
		sm.logger.Warn("Stream manager shutdown timeout")
		return ctx.Err()
	}
}

// HealthCheck performs a health check on the stream manager
func (sm *StreamManager) HealthCheck() map[string]interface{} {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	activeCount := len(sm.connections)
	utilizationPercent := float64(activeCount) / float64(sm.maxConnections) * 100

	status := "healthy"
	if utilizationPercent > 90 {
		status = "critical"
	} else if utilizationPercent > 75 {
		status = "warning"
	}

	return map[string]interface{}{
		"status":              status,
		"active_streams":      activeCount,
		"max_streams":         sm.maxConnections,
		"utilization_percent": utilizationPercent,
		"metrics":             sm.metrics.GetSnapshot(),
	}
}
