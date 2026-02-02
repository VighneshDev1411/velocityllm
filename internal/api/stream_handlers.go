package api

import (
	"context"
	"net/http"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/streaming"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/gin-gonic/gin"
)

// StreamHandlers handles streaming-related HTTP requests
type StreamHandlers struct {
	manager    *streaming.StreamManager
	sseHandler *streaming.SSEHandler
	logger     *utils.Logger
}

// NewStreamHandlers creates a new stream handlers instance
func NewStreamHandlers(manager *streaming.StreamManager, sseHandler *streaming.SSEHandler, logger *utils.Logger) *StreamHandlers {
	return &StreamHandlers{
		manager:    manager,
		sseHandler: sseHandler,
		logger:     logger,
	}
}

// StreamCompletion handles streaming completion requests
func (sh *StreamHandlers) StreamCompletion(c *gin.Context) {
	var req types.CompletionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Error:   "Invalid request body",
			Message: err.Error(),
		})
		return
	}

	// Validate
	if req.Prompt == "" {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Error:   "Prompt is required",
			Message: "Prompt field cannot be empty",
		})
		return
	}

	// Set default model
	if req.Model == "" {
		req.Model = "gpt-3.5-turbo"
	}

	sh.logger.Info("Starting streaming completion",
		"model", req.Model,
		"prompt_length", len(req.Prompt))

	// Create SSE handler
	sseHandler, err := streaming.NewSSEHandler(c.Writer)
	if err != nil {
		c.JSON(http.StatusInternalServerError, types.ErrorResponse{
			Error:   "SSE not supported",
			Message: err.Error(),
		})
		return
	}
	defer sseHandler.Close()

	// Simulate token stream
	tokenChan := streaming.SimulateTokenStream(req.Prompt, req.Model)

	// Stream tokens
	index := 0
	for {
		select {
		case token, ok := <-tokenChan:
			if !ok {
				// Stream complete
				if err := sseHandler.WriteDone(); err != nil {
					sh.logger.Error("Failed to write done", "error", err)
				}
				sh.logger.Debug("Streaming completed successfully")
				return
			}

			if err := sseHandler.WriteToken(token, index); err != nil {
				sh.logger.Error("Failed to write token", "error", err)
				return
			}
			index++

		case <-c.Request.Context().Done():
			sh.logger.Info("Client disconnected")
			return
		}
	}
}

// StreamChatCompletion handles OpenAI-compatible chat completion streaming
func (sh *StreamHandlers) StreamChatCompletion(c *gin.Context) {
	// For now, use the same handler as regular completion
	sh.StreamCompletion(c)
}

// GetStreamStatus returns the status of a specific stream
func (sh *StreamHandlers) GetStreamStatus(c *gin.Context) {
	streamID := c.Param("id")
	if streamID == "" {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Error:   "Stream ID is required",
			Message: "Missing stream ID parameter",
		})
		return
	}

	status, err := sh.manager.GetStreamStatus(streamID)
	if err != nil {
		if err == streaming.ErrStreamNotFound {
			c.JSON(http.StatusNotFound, types.ErrorResponse{
				Error:   "Stream not found",
				Message: "No stream found with the given ID",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, types.ErrorResponse{
			Error:   "Failed to get stream status",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, types.SuccessResponse{
		Message: "Stream status retrieved",
		Data:    status,
	})
}

// CancelStream cancels a specific stream
func (sh *StreamHandlers) CancelStream(c *gin.Context) {
	streamID := c.Param("id")
	if streamID == "" {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Error:   "Stream ID is required",
			Message: "Missing stream ID parameter",
		})
		return
	}

	if err := sh.manager.CancelStream(streamID); err != nil {
		if err == streaming.ErrStreamNotFound {
			c.JSON(http.StatusNotFound, types.ErrorResponse{
				Error:   "Stream not found",
				Message: "No stream found with the given ID",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, types.ErrorResponse{
			Error:   "Failed to cancel stream",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, types.SuccessResponse{
		Message: "Stream cancelled successfully",
		Data:    nil,
	})
}

// GetActiveStreams returns all active streams
func (sh *StreamHandlers) GetActiveStreams(c *gin.Context) {
	streams := sh.manager.GetActiveStreams()

	streamInfo := make([]map[string]interface{}, 0, len(streams))
	for _, conn := range streams {
		streamInfo = append(streamInfo, conn.GetMetadata())
	}

	c.JSON(http.StatusOK, types.SuccessResponse{
		Message: "Active streams retrieved",
		Data: map[string]interface{}{
			"count":   len(streams),
			"streams": streamInfo,
		},
	})
}

// GetStreamMetrics returns current stream metrics
func (sh *StreamHandlers) GetStreamMetrics(c *gin.Context) {
	metrics := sh.manager.GetMetrics()

	// Convert to map to avoid lock copy warning
	metricsMap := map[string]interface{}{
		"total_streams":         metrics.TotalStreams,
		"active_streams":        metrics.ActiveStreams,
		"completed_streams":     metrics.CompletedStreams,
		"cancelled_streams":     metrics.CancelledStreams,
		"errored_streams":       metrics.ErroredStreams,
		"total_events":          metrics.TotalEvents,
		"total_bytes_sent":      metrics.TotalBytesSent,
		"avg_events_per_stream": metrics.AvgEventsPerStream,
		"avg_bytes_per_stream":  metrics.AvgBytesPerStream,
		"last_updated":          metrics.LastUpdated,
	}

	c.JSON(http.StatusOK, types.SuccessResponse{
		Message: "Stream metrics retrieved",
		Data:    metricsMap,
	})
}

// GetStreamStats returns detailed stream statistics
func (sh *StreamHandlers) GetStreamStats(c *gin.Context) {
	stats := sh.manager.GetStats()

	c.JSON(http.StatusOK, types.SuccessResponse{
		Message: "Stream statistics retrieved",
		Data:    stats,
	})
}

// StreamHealthCheck performs a health check on the streaming system
func (sh *StreamHandlers) StreamHealthCheck(c *gin.Context) {
	health := sh.manager.HealthCheck()
	c.JSON(http.StatusOK, health)
}

// TestStreamEndpoint is a simple test endpoint for SSE
func (sh *StreamHandlers) TestStreamEndpoint(c *gin.Context) {
	sh.logger.Info("Starting test SSE stream")

	// Create SSE handler
	sseHandler, err := streaming.NewSSEHandler(c.Writer)
	if err != nil {
		c.JSON(http.StatusInternalServerError, types.ErrorResponse{
			Error:   "SSE not supported",
			Message: err.Error(),
		})
		return
	}
	defer sseHandler.Close()

	// Send test messages
	messages := []string{
		"Hello",
		"from",
		"Server-Sent",
		"Events!",
		"This",
		"is",
		"a",
		"test",
		"stream.",
	}

	for i, msg := range messages {
		if err := sseHandler.WriteToken(msg, i); err != nil {
			sh.logger.Error("Failed to write token", "error", err)
			return
		}
		time.Sleep(100 * time.Millisecond)
	}

	if err := sseHandler.WriteDone(); err != nil {
		sh.logger.Error("Failed to write done", "error", err)
		return
	}

	sh.logger.Debug("Test SSE stream completed")
}

// BroadcastMessage sends a message to all active streams
func (sh *StreamHandlers) BroadcastMessage(c *gin.Context) {
	var req struct {
		Message string                 `json:"message" binding:"required"`
		Type    string                 `json:"type"`
		Data    map[string]interface{} `json:"data"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Error:   "Invalid request body",
			Message: err.Error(),
		})
		return
	}

	// Set default type
	if req.Type == "" {
		req.Type = "system"
	}

	// Create broadcast event data
	eventData := map[string]interface{}{
		"message": req.Message,
	}

	// Add additional data if provided
	if req.Data != nil {
		for k, v := range req.Data {
			eventData[k] = v
		}
	}

	event := streaming.StreamEvent{
		Type:      req.Type,
		Data:      eventData,
		Timestamp: time.Now(),
	}

	sh.logger.Info("Broadcasting message to all streams", "message", req.Message)

	// Broadcast to all streams
	sh.manager.BroadcastEvent(event)

	c.JSON(http.StatusOK, types.SuccessResponse{
		Message: "Message broadcast to all active streams",
		Data: map[string]interface{}{
			"active_streams": len(sh.manager.GetActiveStreams()),
		},
	})
}

// ExportStreamLogs exports stream logs (placeholder)
func (sh *StreamHandlers) ExportStreamLogs(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, types.ErrorResponse{
		Error:   "Not implemented",
		Message: "Export stream logs functionality not yet implemented",
	})
}

// Shutdown gracefully shuts down the stream manager
func (sh *StreamHandlers) Shutdown(ctx context.Context) error {
	return sh.manager.Shutdown(ctx)
}
