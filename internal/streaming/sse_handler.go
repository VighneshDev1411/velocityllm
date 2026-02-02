package streaming

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// SSEHandler handles Server-Sent Events streaming
type SSEHandler struct {
	writer  http.ResponseWriter
	flusher http.Flusher
	closed  bool
}

// NewSSEHandler creates a new SSE handler
func NewSSEHandler(w http.ResponseWriter) (*SSEHandler, error) {
	// Check if ResponseWriter supports flushing
	flusher, ok := w.(http.Flusher)
	if !ok {
		return nil, fmt.Errorf("streaming not supported")
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("X-Accel-Buffering", "no") // Disable nginx buffering

	return &SSEHandler{
		writer:  w,
		flusher: flusher,
		closed:  false,
	}, nil
}

// WriteSSE writes an SSE message
func (h *SSEHandler) WriteSSE(message StreamMessage) error {
	if h.closed {
		return fmt.Errorf("SSE handler is closed")
	}

	// Format SSE message
	var sseMessage string

	// Add event type if specified
	if message.Event != "" {
		sseMessage += fmt.Sprintf("event: %s\n", message.Event)
	}

	// Add ID if specified
	if message.ID != "" {
		sseMessage += fmt.Sprintf("id: %s\n", message.ID)
	}

	// Add retry if specified
	if message.Retry > 0 {
		sseMessage += fmt.Sprintf("retry: %d\n", message.Retry)
	}

	// Serialize data to JSON
	dataJSON, err := json.Marshal(message.Data)
	if err != nil {
		return fmt.Errorf("failed to marshal data: %w", err)
	}

	// Add data
	sseMessage += fmt.Sprintf("data: %s\n\n", string(dataJSON))

	// Write to response
	_, err = fmt.Fprint(h.writer, sseMessage)
	if err != nil {
		return fmt.Errorf("failed to write SSE message: %w", err)
	}

	// Flush immediately
	h.flusher.Flush()

	return nil
}

// WriteToken writes a token as SSE
func (h *SSEHandler) WriteToken(token string, index int) error {
	message := StreamMessage{
		Type: "token",
		Data: TokenChunk{
			Token:     token,
			Index:     index,
			Timestamp: time.Now(),
		},
	}

	return h.WriteSSE(message)
}

// WriteMetadata writes metadata as SSE
func (h *SSEHandler) WriteMetadata(metadata StreamMetadata) error {
	message := StreamMessage{
		Type: "metadata",
		Data: metadata,
	}

	return h.WriteSSE(message)
}

// WriteError writes an error as SSE
func (h *SSEHandler) WriteError(code, errMessage, errType string) error {
	message := StreamMessage{
		Type: "error",
		Data: StreamError{
			Code:    code,
			Message: errMessage,
			Type:    errType,
		},
	}

	return h.WriteSSE(message)
}

// WriteDone writes completion message
func (h *SSEHandler) WriteDone() error {
	message := StreamMessage{
		Type: "done",
		Data: map[string]string{
			"status": "completed",
		},
	}

	return h.WriteSSE(message)
}

// WriteComment writes an SSE comment (for keepalive)
func (h *SSEHandler) WriteComment(comment string) error {
	if h.closed {
		return fmt.Errorf("SSE handler is closed")
	}

	_, err := fmt.Fprintf(h.writer, ": %s\n\n", comment)
	if err != nil {
		return err
	}

	h.flusher.Flush()
	return nil
}

// Flush flushes the writer
func (h *SSEHandler) Flush() error {
	if h.closed {
		return fmt.Errorf("SSE handler is closed")
	}

	h.flusher.Flush()
	return nil
}

// Close closes the handler
func (h *SSEHandler) Close() error {
	if h.closed {
		return nil
	}

	h.closed = true

	// Write final done message
	h.WriteDone()

	return nil
}

// IsClosed returns true if handler is closed
func (h *SSEHandler) IsClosed() bool {
	return h.closed
}

// SimulateTokenStream simulates streaming tokens (for testing)
func SimulateTokenStream(prompt string, model string) <-chan string {
	tokenChan := make(chan string, 10)

	go func() {
		defer close(tokenChan)

		// Simulate response based on prompt
		response := fmt.Sprintf("This is a simulated streaming response from %s. ", model)
		response += "The tokens are being generated one by one in real-time. "
		response += fmt.Sprintf("Your prompt was: %s", prompt)

		// Split into words (tokens)
		words := []string{}
		word := ""

		for _, char := range response {
			if char == ' ' {
				if word != "" {
					words = append(words, word)
					word = ""
				}
				words = append(words, " ")
			} else {
				word += string(char)
			}
		}

		if word != "" {
			words = append(words, word)
		}

		// Stream each token with delay
		for _, token := range words {
			time.Sleep(50 * time.Millisecond) // Simulate generation delay
			tokenChan <- token
		}
	}()

	return tokenChan
}

// Global stream manager
var globalStreamManager *StreamManager
var globalStreamManagerMu sync.RWMutex

// InitGlobalStreamManager initializes the global stream manager
func InitGlobalStreamManager(config StreamConfig) {
	globalStreamManagerMu.Lock()
	defer globalStreamManagerMu.Unlock()

	// Create manager config from stream config
	managerConfig := &StreamManagerConfig{
		MaxConnections:     1000,
		IdleTimeout:        5 * time.Minute,
		CleanupInterval:    1 * time.Minute,
		MaxEventBufferSize: config.BufferSize,
	}

	logger := utils.NewLogger()
	globalStreamManager = NewStreamManager(managerConfig, logger)
}

// GetGlobalStreamManager returns the global stream manager
func GetGlobalStreamManager() *StreamManager {
	globalStreamManagerMu.RLock()
	defer globalStreamManagerMu.RUnlock()
	return globalStreamManager
}
