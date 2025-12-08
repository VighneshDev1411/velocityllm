package streaming

import (
	"context"
	"sync"
	"time"
)

// StreamType represents the type of streaming connection
type StreamType string

const (
	StreamTypeSSE       StreamType = "sse"       // Server-Sent Events
	StreamTypeWebSocket StreamType = "websocket" // WebSocket connection
)

// StreamStatus represents the current status of a stream
type StreamStatus string

const (
	StreamStatusActive    StreamStatus = "active"
	StreamStatusCompleted StreamStatus = "completed"
	StreamStatusCancelled StreamStatus = "cancelled"
	StreamStatusError     StreamStatus = "error"
)

// StreamEvent represents a single event in the stream
type StreamEvent struct {
	ID        string                 `json:"id"`        // Event ID
	Type      string                 `json:"type"`      // Event type (chunk, error, done)
	Data      map[string]interface{} `json:"data"`      // Event data
	Timestamp time.Time              `json:"timestamp"` // When event was created
}

// StreamChunk represents a single chunk of streamed content
type StreamChunk struct {
	RequestID string    `json:"request_id"` // Associated request ID
	ChunkID   int       `json:"chunk_id"`   // Chunk sequence number
	Content   string    `json:"content"`    // Chunk content (token/word)
	Model     string    `json:"model"`      // Model that generated this
	Timestamp time.Time `json:"timestamp"`  // When chunk was generated
	Done      bool      `json:"done"`       // Is this the final chunk?

	// Metadata
	TokenCount int               `json:"token_count,omitempty"` // Tokens in this chunk
	Metadata   map[string]string `json:"metadata,omitempty"`    // Additional metadata
}

// StreamConnection represents an active streaming connection
type StreamConnection struct {
	ID        string       // Unique connection ID
	RequestID string       // Associated request ID
	Type      StreamType   // Connection type (SSE/WebSocket)
	Status    StreamStatus // Current status

	// Channels
	EventChan chan StreamEvent // Channel for sending events
	DoneChan  chan struct{}    // Signal completion
	ErrorChan chan error       // Error channel

	// Context
	Ctx    context.Context    // Connection context
	Cancel context.CancelFunc // Cancel function

	// Metadata
	ClientIP      string    // Client IP address
	UserAgent     string    // Client user agent
	StartTime     time.Time // When connection started
	LastEventTime time.Time // Last event sent time

	// Stats
	EventCount int   // Number of events sent
	BytesSent  int64 // Total bytes sent

	mu sync.RWMutex // Protects connection state
}

// StreamRequest represents a request to start streaming
type StreamRequest struct {
	Prompt      string            `json:"prompt" binding:"required"`
	Model       string            `json:"model"`
	MaxTokens   int               `json:"max_tokens"`
	Temperature float32           `json:"temperature"`
	Stream      bool              `json:"stream"`
	Metadata    map[string]string `json:"metadata"`
}

// StreamMetrics holds metrics for streaming operations
type StreamMetrics struct {
	TotalStreams     int64 `json:"total_streams"`
	ActiveStreams    int64 `json:"active_streams"`
	CompletedStreams int64 `json:"completed_streams"`
	CancelledStreams int64 `json:"cancelled_streams"`
	ErroredStreams   int64 `json:"errored_streams"`

	// Performance
	AvgStreamDuration  float64 `json:"avg_stream_duration_ms"`
	AvgChunksPerStream float64 `json:"avg_chunks_per_stream"`
	TotalBytesStreamed int64   `json:"total_bytes_streamed"`

	// By Type
	SSEStreams       int64 `json:"sse_streams"`
	WebSocketStreams int64 `json:"websocket_streams"`

	// Timing
	LastUpdated time.Time `json:"last_updated"`

	mu sync.RWMutex // Protects metrics
}

// NewStreamConnection creates a new stream connection
func NewStreamConnection(id, requestID string, streamType StreamType, ctx context.Context) *StreamConnection {
	connCtx, cancel := context.WithCancel(ctx)

	return &StreamConnection{
		ID:            id,
		RequestID:     requestID,
		Type:          streamType,
		Status:        StreamStatusActive,
		EventChan:     make(chan StreamEvent, 100), // Buffered for backpressure
		DoneChan:      make(chan struct{}),
		ErrorChan:     make(chan error, 1),
		Ctx:           connCtx,
		Cancel:        cancel,
		StartTime:     time.Now(),
		LastEventTime: time.Now(),
		EventCount:    0,
		BytesSent:     0,
	}
}

// SendEvent sends an event through the stream
func (sc *StreamConnection) SendEvent(event StreamEvent) error {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	if sc.Status != StreamStatusActive {
		return ErrStreamNotActive
	}

	select {
	case sc.EventChan <- event:
		sc.EventCount++
		sc.LastEventTime = time.Now()
		return nil
	case <-sc.Ctx.Done():
		return ErrStreamCancelled
	default:
		return ErrStreamBufferFull
	}
}

// Close closes the stream connection
func (sc *StreamConnection) Close() {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	if sc.Status == StreamStatusActive {
		sc.Status = StreamStatusCompleted
		close(sc.DoneChan)
		sc.Cancel()
	}
}

// SetError sets the stream to error state
func (sc *StreamConnection) SetError(err error) {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	sc.Status = StreamStatusError
	select {
	case sc.ErrorChan <- err:
	default:
	}
	sc.Cancel()
}

// GetStatus returns the current stream status
func (sc *StreamConnection) GetStatus() StreamStatus {
	sc.mu.RLock()
	defer sc.mu.RUnlock()
	return sc.Status
}

// GetMetadata returns stream metadata
func (sc *StreamConnection) GetMetadata() map[string]interface{} {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	return map[string]interface{}{
		"id":              sc.ID,
		"request_id":      sc.RequestID,
		"type":            sc.Type,
		"status":          sc.Status,
		"start_time":      sc.StartTime,
		"last_event_time": sc.LastEventTime,
		"event_count":     sc.EventCount,
		"bytes_sent":      sc.BytesSent,
		"duration_ms":     time.Since(sc.StartTime).Milliseconds(),
	}
}

// Custom errors
var (
	ErrStreamNotActive   = NewStreamError("stream is not active")
	ErrStreamCancelled   = NewStreamError("stream was cancelled")
	ErrStreamBufferFull  = NewStreamError("stream buffer is full")
	ErrStreamNotFound    = NewStreamError("stream not found")
	ErrInvalidStreamType = NewStreamError("invalid stream type")
)

// StreamError represents a streaming error
type StreamError struct {
	Message string
}

func NewStreamError(message string) *StreamError {
	return &StreamError{Message: message}
}

func (e *StreamError) Error() string {
	return e.Message
}

// UpdateMetrics updates stream metrics
func (sm *StreamMetrics) UpdateMetrics(conn *StreamConnection, completed bool) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.TotalStreams++

	if completed {
		sm.CompletedStreams++
		sm.ActiveStreams--

		// Update averages
		duration := time.Since(conn.StartTime).Seconds() * 1000 // ms
		sm.AvgStreamDuration = (sm.AvgStreamDuration*float64(sm.CompletedStreams-1) + duration) / float64(sm.CompletedStreams)
		sm.AvgChunksPerStream = (sm.AvgChunksPerStream*float64(sm.CompletedStreams-1) + float64(conn.EventCount)) / float64(sm.CompletedStreams)
		sm.TotalBytesStreamed += conn.BytesSent
	} else {
		sm.ActiveStreams++
	}

	// Update by type
	switch conn.Type {
	case StreamTypeSSE:
		sm.SSEStreams++
	case StreamTypeWebSocket:
		sm.WebSocketStreams++
	}

	sm.LastUpdated = time.Now()
}

// IncrementCancelled increments cancelled stream count
func (sm *StreamMetrics) IncrementCancelled() {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.CancelledStreams++
	sm.ActiveStreams--
	sm.LastUpdated = time.Now()
}

// IncrementErrored increments errored stream count
func (sm *StreamMetrics) IncrementErrored() {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	sm.ErroredStreams++
	sm.ActiveStreams--
	sm.LastUpdated = time.Now()
}

// GetSnapshot returns a snapshot of current metrics
func (sm *StreamMetrics) GetSnapshot() StreamMetrics {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	return StreamMetrics{
		TotalStreams:       sm.TotalStreams,
		ActiveStreams:      sm.ActiveStreams,
		CompletedStreams:   sm.CompletedStreams,
		CancelledStreams:   sm.CancelledStreams,
		ErroredStreams:     sm.ErroredStreams,
		AvgStreamDuration:  sm.AvgStreamDuration,
		AvgChunksPerStream: sm.AvgChunksPerStream,
		TotalBytesStreamed: sm.TotalBytesStreamed,
		SSEStreams:         sm.SSEStreams,
		WebSocketStreams:   sm.WebSocketStreams,
		LastUpdated:        sm.LastUpdated,
	}
}
