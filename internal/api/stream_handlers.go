package api

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/VighneshDev1411/velocityllm/internal/streaming"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// StreamHandlers handles streaming-related HTTP endpoints
type StreamHandlers struct {
	manager    *streaming.StreamManager
	sseHandler *streaming.SSEHandler
	logger     *utils.Logger
}

// NewStreamHandlers creates new stream handlers
func NewStreamHandlers(manager *streaming.StreamManager, sseHandler *streaming.SSEHandler, logger *utils.Logger) *StreamHandlers {
	return &StreamHandlers{
		manager:    manager,
		sseHandler: sseHandler,
		logger:     logger,
	}
}

// StreamCompletion handles streaming completion requests
// POST /api/v1/stream/completion
func (h *StreamHandlers) StreamCompletion(c *gin.Context) {
	var req streaming.StreamRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Success:   false,
			Error:     "Invalid request body: " + err.Error(),
			Timestamp: time.Now(),
		})
		return
	}

	// Validate request
	if req.Prompt == "" {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Success:   false,
			Error:     "Invalid request: prompt is required",
			Timestamp: time.Now(),
		})
		return
	}

	// Set defaults
	if req.Model == "" {
		req.Model = "gpt-3.5-turbo" // Default model
	}
	if req.MaxTokens == 0 {
		req.MaxTokens = 1000
	}
	if req.Temperature == 0 {
		req.Temperature = 0.7
	}

	// Generate request ID
	requestID := uuid.New().String()

	h.logger.Info("Stream completion request",
		"request_id", requestID,
		"model", req.Model,
		"prompt_length", len(req.Prompt),
		"max_tokens", req.MaxTokens,
	)

	// Check if streaming is requested
	if !req.Stream {
		// For non-streaming requests, redirect to regular completion endpoint
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Success:   false,
			Error:     "Invalid request: stream must be true for this endpoint. Use /api/v1/completion for non-streaming",
			Timestamp: time.Now(),
		})
		return
	}

	// Set SSE headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	// Create mock stream (in production, this would call your LLM inference engine)
	chunkStream := h.sseHandler.SimulateStreamChunks(c.Request.Context(), req.Prompt, req.Model)

	// Stream response to client
	if err := h.sseHandler.StreamResponse(c.Writer, c.Request, requestID, chunkStream); err != nil {
		h.logger.Error("Stream completion failed",
			"request_id", requestID,
			"error", err,
		)
		// Note: Can't send JSON error after SSE has started
		return
	}

	h.logger.Info("Stream completion successful",
		"request_id", requestID,
	)
}

// GetStreamStatus retrieves the status of a specific stream
// GET /api/v1/stream/status/:id
func (h *StreamHandlers) GetStreamStatus(c *gin.Context) {
	streamID := c.Param("id")

	if streamID == "" {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Success:   false,
			Error:     "Invalid request: stream_id is required",
			Timestamp: time.Now(),
		})
		return
	}

	// Get stream status
	status, err := h.manager.GetStreamStatus(streamID)
	if err != nil {
		if err == streaming.ErrStreamNotFound {
			c.JSON(http.StatusNotFound, types.ErrorResponse{
				Success:   false,
				Error:     "Stream not found: No active stream with the given ID",
				Timestamp: time.Now(),
			})
			return
		}

		c.JSON(http.StatusInternalServerError, types.ErrorResponse{
			Success:   false,
			Error:     "Failed to get stream status: " + err.Error(),
			Timestamp: time.Now(),
		})
		return
	}

	c.JSON(http.StatusOK, types.SuccessResponse{
		Success:   true,
		Data:      status,
		Timestamp: time.Now(),
	})
}

// CancelStream cancels an active stream
// DELETE /api/v1/stream/:id
func (h *StreamHandlers) CancelStream(c *gin.Context) {
	streamID := c.Param("id")

	if streamID == "" {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Success:   false,
			Error:     "Invalid request: stream_id is required",
			Timestamp: time.Now(),
		})
		return
	}

	h.logger.Info("Cancelling stream", "stream_id", streamID)

	// Cancel the stream
	if err := h.manager.CancelStream(streamID); err != nil {
		if err == streaming.ErrStreamNotFound {
			c.JSON(http.StatusNotFound, types.ErrorResponse{
				Success:   false,
				Error:     "Stream not found: No active stream with the given ID",
				Timestamp: time.Now(),
			})
			return
		}

		c.JSON(http.StatusInternalServerError, types.ErrorResponse{
			Success:   false,
			Error:     "Failed to cancel stream: " + err.Error(),
			Timestamp: time.Now(),
		})
		return
	}

	c.JSON(http.StatusOK, types.SuccessResponse{
		Success:   true,
		Message:   "Stream cancelled successfully",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"stream_id":    streamID,
			"cancelled_at": time.Now(),
		},
	})
}

// GetStreamMetrics returns streaming performance metrics
// GET /api/v1/stream/metrics
func (h *StreamHandlers) GetStreamMetrics(c *gin.Context) {
	metrics := h.manager.GetMetrics()

	c.JSON(http.StatusOK, types.SuccessResponse{
		Success:   true,
		Data:      metrics,
		Timestamp: time.Now(),
	})
}

// GetActiveStreams returns all currently active streams
// GET /api/v1/stream/active
func (h *StreamHandlers) GetActiveStreams(c *gin.Context) {
	streams := h.manager.GetActiveStreams()

	// Build response
	streamList := make([]map[string]interface{}, 0, len(streams))
	for _, stream := range streams {
		streamList = append(streamList, stream.GetMetadata())
	}

	c.JSON(http.StatusOK, types.SuccessResponse{
		Success:   true,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"count":   len(streamList),
			"streams": streamList,
		},
	})
}

// GetStreamStats returns detailed streaming statistics
// GET /api/v1/stream/stats
func (h *StreamHandlers) GetStreamStats(c *gin.Context) {
	stats := h.manager.GetStats()

	c.JSON(http.StatusOK, types.SuccessResponse{
		Success:   true,
		Data:      stats,
		Timestamp: time.Now(),
	})
}

// StreamHealthCheck checks the health of the streaming system
// GET /api/v1/stream/health
func (h *StreamHandlers) StreamHealthCheck(c *gin.Context) {
	health := h.manager.HealthCheck()

	status := http.StatusOK
	if health["status"] == "critical" {
		status = http.StatusServiceUnavailable
	} else if health["status"] == "warning" {
		status = http.StatusOK // Still operational
	}

	c.JSON(status, types.SuccessResponse{
		Success:   health["status"] != "critical",
		Data:      health,
		Timestamp: time.Now(),
	})
}

// TestStreamEndpoint is a simple test endpoint to verify streaming works
// GET /api/v1/stream/test
func (h *StreamHandlers) TestStreamEndpoint(c *gin.Context) {
	requestID := uuid.New().String()

	h.logger.Info("Test stream request", "request_id", requestID)

	// Set SSE headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	// Create simple test stream
	chunkStream := make(chan streaming.StreamChunk, 10)
	go func() {
		defer close(chunkStream)

		words := []string{"Test", "streaming", "is", "working", "perfectly!"}
		for i, word := range words {
			select {
			case <-c.Request.Context().Done():
				return
			case <-time.After(500 * time.Millisecond):
				chunkStream <- streaming.StreamChunk{
					ChunkID:   i,
					Content:   word + " ",
					Model:     "test",
					Timestamp: time.Now(),
					Done:      i == len(words)-1,
				}
			}
		}
	}()

	// Stream response
	if err := h.sseHandler.StreamResponse(c.Writer, c.Request, requestID, chunkStream); err != nil {
		h.logger.Error("Test stream failed", "error", err)
		return
	}
}

// StreamChatCompletion handles streaming chat completion (OpenAI-compatible format)
// POST /api/v1/stream/chat/completions
func (h *StreamHandlers) StreamChatCompletion(c *gin.Context) {
	var req struct {
		Model       string                   `json:"model"`
		Messages    []map[string]interface{} `json:"messages"`
		Stream      bool                     `json:"stream"`
		MaxTokens   int                      `json:"max_tokens"`
		Temperature float32                  `json:"temperature"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Success:   false,
			Error:     "Invalid request body: " + err.Error(),
			Timestamp: time.Now(),
		})
		return
	}

	// Validate messages
	if len(req.Messages) == 0 {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Success:   false,
			Error:     "Invalid request: messages array is required and cannot be empty",
			Timestamp: time.Now(),
		})
		return
	}

	// Extract last user message as prompt
	var prompt string
	for i := len(req.Messages) - 1; i >= 0; i-- {
		msg := req.Messages[i]
		if role, ok := msg["role"].(string); ok && role == "user" {
			if content, ok := msg["content"].(string); ok {
				prompt = content
				break
			}
		}
	}

	if prompt == "" {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Success:   false,
			Error:     "Invalid request: No user message found in messages array",
			Timestamp: time.Now(),
		})
		return
	}

	// Set defaults
	if req.Model == "" {
		req.Model = "gpt-3.5-turbo"
	}
	if req.MaxTokens == 0 {
		req.MaxTokens = 1000
	}

	requestID := uuid.New().String()

	h.logger.Info("Stream chat completion request",
		"request_id", requestID,
		"model", req.Model,
		"message_count", len(req.Messages),
	)

	// Set SSE headers
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	// Create stream
	chunkStream := h.sseHandler.SimulateStreamChunks(c.Request.Context(), prompt, req.Model)

	// Stream response
	if err := h.sseHandler.StreamResponse(c.Writer, c.Request, requestID, chunkStream); err != nil {
		h.logger.Error("Stream chat completion failed",
			"request_id", requestID,
			"error", err,
		)
		return
	}
}

// BroadcastMessage broadcasts a message to all active streams (admin only)
// POST /api/v1/stream/broadcast
func (h *StreamHandlers) BroadcastMessage(c *gin.Context) {
	var req struct {
		Message string                 `json:"message" binding:"required"`
		Type    string                 `json:"type"`
		Data    map[string]interface{} `json:"data"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Success:   false,
			Error:     "Invalid request body: " + err.Error(),
			Timestamp: time.Now(),
		})
		return
	}

	// Set default type
	if req.Type == "" {
		req.Type = "system"
	}

	// Create broadcast event
	event := streaming.StreamEvent{
		ID:   uuid.New().String(),
		Type: req.Type,
		Data: map[string]interface{}{
			"message": req.Message,
		},
		Timestamp: time.Now(),
	}

	// Add additional data if provided
	if req.Data != nil {
		for k, v := range req.Data {
			event.Data[k] = v
		}
	}

	h.logger.Info("Broadcasting message to all streams", "message", req.Message)

	// Broadcast to all streams
	h.manager.BroadcastEvent(event)

	c.JSON(http.StatusOK, types.SuccessResponse{
		Success:   true,
		Message:   "Message broadcasted successfully",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"event_id":       event.ID,
			"active_streams": len(h.manager.GetActiveStreams()),
		},
	})
}

// ExportStreamLogs exports streaming logs for analysis
// GET /api/v1/stream/logs/export
func (h *StreamHandlers) ExportStreamLogs(c *gin.Context) {
	// Get query parameters
	format := c.DefaultQuery("format", "json") // json or csv

	streams := h.manager.GetActiveStreams()

	if format == "csv" {
		// Export as CSV
		c.Header("Content-Type", "text/csv")
		c.Header("Content-Disposition", "attachment; filename=stream_logs.csv")

		// Write CSV header
		c.Writer.Write([]byte("stream_id,request_id,type,status,start_time,event_count,bytes_sent\n"))

		// Write data
		for _, stream := range streams {
			metadata := stream.GetMetadata()
			line := []byte(fmt.Sprintf("%v,%v,%v,%v,%v,%v,%v\n",
				metadata["id"],
				metadata["request_id"],
				metadata["type"],
				metadata["status"],
				metadata["start_time"],
				metadata["event_count"],
				metadata["bytes_sent"],
			))
			c.Writer.Write(line)
		}
	} else {
		// Export as JSON
		streamList := make([]map[string]interface{}, 0, len(streams))
		for _, stream := range streams {
			streamList = append(streamList, stream.GetMetadata())
		}

		c.JSON(http.StatusOK, types.SuccessResponse{
			Success:   true,
			Timestamp: time.Now(),
			Data: map[string]interface{}{
				"count":       len(streamList),
				"streams":     streamList,
				"exported_at": time.Now(),
			},
		})
	}
}
