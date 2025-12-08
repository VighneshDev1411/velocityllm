package streaming

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	// "github.com/yourusername/velocityllm/pkg/utils"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// SSEHandler handles Server-Sent Events streaming
type SSEHandler struct {
	manager *StreamManager
	logger  *utils.Logger

	// Configuration
	keepAliveInterval time.Duration // How often to send keepalive messages
	writeTimeout      time.Duration // Timeout for write operations
	flushInterval     time.Duration // How often to flush data
}

// NewSSEHandler creates a new SSE handler
func NewSSEHandler(manager *StreamManager, logger *utils.Logger) *SSEHandler {
	return &SSEHandler{
		manager:           manager,
		logger:            logger,
		keepAliveInterval: 15 * time.Second,       // Send keepalive every 15s
		writeTimeout:      5 * time.Second,        // 5s write timeout
		flushInterval:     100 * time.Millisecond, // Flush every 100ms
	}
}

// StreamResponse handles streaming a response via SSE
func (h *SSEHandler) StreamResponse(w http.ResponseWriter, r *http.Request, requestID string, eventStream <-chan StreamChunk) error {
	// Set SSE headers
	h.setSSEHeaders(w)

	// Create stream connection
	conn, err := h.manager.CreateStream(r.Context(), requestID, StreamTypeSSE)
	if err != nil {
		h.logger.Error("Failed to create stream", "error", err)
		return err
	}
	defer h.manager.CloseStream(conn.ID)

	h.logger.Info("Starting SSE stream",
		"stream_id", conn.ID,
		"request_id", requestID,
		"client_ip", r.RemoteAddr,
	)

	// Get flusher for progressive response
	flusher, ok := w.(http.Flusher)
	if !ok {
		return fmt.Errorf("streaming not supported")
	}

	// Send initial connection event
	if err := h.writeSSEEvent(w, flusher, "connected", map[string]interface{}{
		"stream_id":  conn.ID,
		"request_id": requestID,
		"timestamp":  time.Now().Unix(),
	}); err != nil {
		return err
	}

	// Start keepalive goroutine
	keepAliveDone := make(chan struct{})
	go h.keepAliveLoop(w, flusher, conn, keepAliveDone)
	defer close(keepAliveDone)

	// Stream chunks to client
	for {
		select {
		case chunk, ok := <-eventStream:
			if !ok {
				// Stream completed
				h.logger.Info("Stream completed", "stream_id", conn.ID)
				return h.writeSSEEvent(w, flusher, "done", map[string]interface{}{
					"stream_id":  conn.ID,
					"request_id": requestID,
					"timestamp":  time.Now().Unix(),
				})
			}

			// Write chunk as SSE event
			if err := h.writeChunk(w, flusher, conn, chunk); err != nil {
				h.logger.Error("Failed to write chunk", "error", err, "stream_id", conn.ID)
				return err
			}

		case <-conn.Ctx.Done():
			// Client disconnected or stream cancelled
			h.logger.Info("Stream context cancelled", "stream_id", conn.ID)
			return conn.Ctx.Err()

		case <-r.Context().Done():
			// Request context cancelled (client disconnected)
			h.logger.Info("Request context cancelled", "stream_id", conn.ID)
			return r.Context().Err()
		}
	}
}

// writeChunk writes a chunk as an SSE event
func (h *SSEHandler) writeChunk(w io.Writer, flusher http.Flusher, conn *StreamConnection, chunk StreamChunk) error {
	// Prepare event data
	eventData := map[string]interface{}{
		"chunk_id":    chunk.ChunkID,
		"content":     chunk.Content,
		"model":       chunk.Model,
		"done":        chunk.Done,
		"timestamp":   chunk.Timestamp.Unix(),
		"token_count": chunk.TokenCount,
	}

	// Add metadata if present
	if len(chunk.Metadata) > 0 {
		eventData["metadata"] = chunk.Metadata
	}

	// Write as SSE event
	if err := h.writeSSEEvent(w, flusher, "chunk", eventData); err != nil {
		return err
	}

	// Update connection stats
	conn.mu.Lock()
	conn.BytesSent += int64(len(chunk.Content))
	conn.LastEventTime = time.Now()
	conn.mu.Unlock()

	return nil
}

// writeSSEEvent writes a single SSE event
func (h *SSEHandler) writeSSEEvent(w io.Writer, flusher http.Flusher, eventType string, data interface{}) error {
	// Convert data to JSON
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal event data: %w", err)
	}

	// Write SSE format: "event: <type>\ndata: <json>\n\n"
	_, err = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", eventType, jsonData)
	if err != nil {
		return fmt.Errorf("failed to write SSE event: %w", err)
	}

	// Flush immediately for real-time delivery
	flusher.Flush()

	return nil
}

// keepAliveLoop sends periodic keepalive messages to keep connection alive
func (h *SSEHandler) keepAliveLoop(w io.Writer, flusher http.Flusher, conn *StreamConnection, done <-chan struct{}) {
	ticker := time.NewTicker(h.keepAliveInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			// Send keepalive comment (SSE supports comments with ":")
			_, err := fmt.Fprintf(w, ": keepalive %d\n\n", time.Now().Unix())
			if err != nil {
				h.logger.Warn("Keepalive write failed", "stream_id", conn.ID, "error", err)
				return
			}
			flusher.Flush()

			h.logger.Debug("Sent keepalive", "stream_id", conn.ID)

		case <-done:
			return

		case <-conn.Ctx.Done():
			return
		}
	}
}

// setSSEHeaders sets the necessary headers for SSE streaming
func (h *SSEHandler) setSSEHeaders(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")          // Disable nginx buffering
	w.Header().Set("Access-Control-Allow-Origin", "*") // CORS for SSE
}

// StreamError sends an error event via SSE
func (h *SSEHandler) StreamError(w http.ResponseWriter, r *http.Request, streamID string, err error) {
	h.setSSEHeaders(w)

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming not supported", http.StatusInternalServerError)
		return
	}

	errorData := map[string]interface{}{
		"stream_id": streamID,
		"error":     err.Error(),
		"timestamp": time.Now().Unix(),
	}

	h.writeSSEEvent(w, flusher, "error", errorData)

	h.logger.Error("Sent error event", "stream_id", streamID, "error", err)
}

// Example: SimulateStreamChunks creates a mock stream for testing
// In production, this would come from your LLM inference engine
func (h *SSEHandler) SimulateStreamChunks(ctx context.Context, prompt string, model string) <-chan StreamChunk {
	chunkChan := make(chan StreamChunk)

	go func() {
		defer close(chunkChan)

		// Simulate streaming response
		response := "This is a simulated streaming response to your prompt. " +
			"Each word will be sent as a separate chunk to demonstrate real-time streaming. " +
			"In production, this would be actual LLM output."

		words := []string{}
		word := ""
		for _, char := range response {
			if char == ' ' {
				if word != "" {
					words = append(words, word+" ")
					word = ""
				}
			} else {
				word += string(char)
			}
		}
		if word != "" {
			words = append(words, word)
		}

		// Stream each word with a small delay
		for i, word := range words {
			select {
			case <-ctx.Done():
				return
			case <-time.After(50 * time.Millisecond): // 50ms between words
				chunk := StreamChunk{
					ChunkID:    i,
					Content:    word,
					Model:      model,
					Timestamp:  time.Now(),
					Done:       i == len(words)-1,
					TokenCount: 1,
				}

				chunkChan <- chunk
			}
		}
	}()

	return chunkChan
}

// BatchStreamChunks batches multiple chunks together for efficiency
// This is useful when chunks arrive faster than network can handle
func (h *SSEHandler) BatchStreamChunks(input <-chan StreamChunk, batchSize int, timeout time.Duration) <-chan []StreamChunk {
	output := make(chan []StreamChunk)

	go func() {
		defer close(output)

		batch := make([]StreamChunk, 0, batchSize)
		timer := time.NewTimer(timeout)
		defer timer.Stop()

		for {
			select {
			case chunk, ok := <-input:
				if !ok {
					// Input closed, send remaining batch
					if len(batch) > 0 {
						output <- batch
					}
					return
				}

				batch = append(batch, chunk)

				// Send batch if full
				if len(batch) >= batchSize {
					output <- batch
					batch = make([]StreamChunk, 0, batchSize)
					timer.Reset(timeout)
				}

			case <-timer.C:
				// Timeout reached, send partial batch
				if len(batch) > 0 {
					output <- batch
					batch = make([]StreamChunk, 0, batchSize)
				}
				timer.Reset(timeout)
			}
		}
	}()

	return output
}

// RetryStream implements retry logic for failed streams
func (h *SSEHandler) RetryStream(ctx context.Context, maxRetries int, retryDelay time.Duration, streamFunc func() error) error {
	var lastErr error

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			h.logger.Info("Retrying stream", "attempt", attempt, "max_retries", maxRetries)

			select {
			case <-time.After(retryDelay):
			case <-ctx.Done():
				return ctx.Err()
			}
		}

		err := streamFunc()
		if err == nil {
			return nil
		}

		lastErr = err
		h.logger.Warn("Stream attempt failed", "attempt", attempt, "error", err)

		// Exponential backoff
		retryDelay *= 2
	}

	return fmt.Errorf("stream failed after %d attempts: %w", maxRetries, lastErr)
}

// GetSSEClient creates a simple client for testing SSE endpoints
type SSEClient struct {
	url    string
	logger *utils.Logger
}

// NewSSEClient creates a new SSE client
func NewSSEClient(url string, logger *utils.Logger) *SSEClient {
	return &SSEClient{
		url:    url,
		logger: logger,
	}
}

// Connect connects to SSE endpoint and processes events
func (c *SSEClient) Connect(ctx context.Context, eventHandler func(eventType string, data map[string]interface{})) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.url, nil)
	if err != nil {
		return err
	}

	req.Header.Set("Accept", "text/event-stream")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	// Read and parse SSE events
	// This is a simplified parser - production would be more robust
	c.logger.Info("Connected to SSE endpoint", "url", c.url)

	// Note: Full SSE parsing would go here
	// For now, this is a placeholder structure

	return nil
}
