package streaming

import (
	"context"
	"errors"
	"sync"
	"time"
)

// StreamType represents the type of stream
type StreamType string

const (
	StreamTypeSSE       StreamType = "sse"       // Server-Sent Events
	StreamTypeWebSocket StreamType = "websocket" // WebSocket
)

// StreamStatus represents the status of a stream
type StreamStatus string

const (
	StreamStatusActive    StreamStatus = "active"
	StreamStatusCompleted StreamStatus = "completed"
	StreamStatusCancelled StreamStatus = "cancelled"
	StreamStatusErrored   StreamStatus = "errored"
)

// Common errors
var (
	ErrStreamNotFound = errors.New("stream not found")
	ErrStreamClosed   = errors.New("stream is closed")
)

// TokenChunk represents a single token in the stream
type TokenChunk struct {
	Token     string    `json:"token"`
	Index     int       `json:"index"`
	Timestamp time.Time `json:"timestamp"`
}

// StreamMessage represents a message in the stream
type StreamMessage struct {
	Type  string      `json:"type"` // "token", "metadata", "error", "done"
	Data  interface{} `json:"data"`
	Event string      `json:"event,omitempty"`
	ID    string      `json:"id,omitempty"`
	Retry int         `json:"retry,omitempty"`
}

// StreamMetadata contains metadata about the stream
type StreamMetadata struct {
	Model       string    `json:"model"`
	Prompt      string    `json:"prompt"`
	StartTime   time.Time `json:"start_time"`
	TokenCount  int       `json:"token_count"`
	TotalTokens int       `json:"total_tokens,omitempty"`
	Cost        float64   `json:"cost,omitempty"`
}

// StreamError represents an error in the stream
type StreamError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Type    string `json:"type"`
}

// StreamConfig holds stream configuration
type StreamConfig struct {
	BufferSize    int           // Size of token buffer
	FlushInterval time.Duration // How often to flush buffer
	Timeout       time.Duration // Stream timeout
	MaxTokens     int           // Maximum tokens to stream
	EnableMetrics bool          // Enable metrics collection
}

// DefaultStreamConfig returns default stream configuration
func DefaultStreamConfig() StreamConfig {
	return StreamConfig{
		BufferSize:    10,
		FlushInterval: 50 * time.Millisecond,
		Timeout:       30 * time.Second,
		MaxTokens:     4000,
		EnableMetrics: true,
	}
}

// Stream represents an active stream
type Stream struct {
	ID         string
	Type       StreamType
	Config     StreamConfig
	StartTime  time.Time
	TokenCount int
	Metadata   StreamMetadata
	Context    context.Context
	Cancel     context.CancelFunc
	WriteChan  chan StreamMessage
	ErrorChan  chan error
	DoneChan   chan struct{}
	mu         sync.RWMutex
	closed     bool
}

// StreamManager manages multiple streams
// (Removed duplicate definition. See manager.go for implementation.)

// StreamStats holds stream statistics
type StreamStats struct {
	TotalStreams       int64
	ActiveStreams      int
	CompletedStreams   int64
	FailedStreams      int64
	AvgStreamDuration  time.Duration
	TotalTokens        int64
	AvgTokensPerStream float64
}

// SSEWriter is an interface for SSE writing
type SSEWriter interface {
	WriteSSE(message StreamMessage) error
	Flush() error
	Close() error
}

// TokenBuffer buffers tokens before sending
type TokenBuffer struct {
	tokens    []TokenChunk
	maxSize   int
	flushTime time.Time
	mu        sync.Mutex
}

// StreamRequest represents a request to start streaming
type StreamRequest struct {
	Prompt      string            `json:"prompt"`
	Model       string            `json:"model"`
	MaxTokens   int               `json:"max_tokens,omitempty"`
	Temperature float64           `json:"temperature,omitempty"`
	Stream      bool              `json:"stream"`
	Metadata    map[string]string `json:"metadata,omitempty"`
}

// StreamResponse represents a streaming response
type StreamResponse struct {
	ID           string         `json:"id"`
	Type         string         `json:"type"`
	Model        string         `json:"model"`
	Token        string         `json:"token,omitempty"`
	Metadata     StreamMetadata `json:"metadata,omitempty"`
	Error        *StreamError   `json:"error,omitempty"`
	Finished     bool           `json:"finished"`
	FinishReason string         `json:"finish_reason,omitempty"`
}

// StreamChunk represents a chunk of streaming data
type StreamChunk struct {
	ChunkID    int               `json:"chunk_id"`
	Content    string            `json:"content"`
	Model      string            `json:"model"`
	Timestamp  time.Time         `json:"timestamp"`
	Done       bool              `json:"done"`
	TokenCount int               `json:"token_count"`
	Metadata   map[string]string `json:"metadata,omitempty"`
}

// StreamEvent represents an event to be sent to a stream
type StreamEvent struct {
	Type      string                 `json:"type"`
	Data      interface{}            `json:"data"`
	ID        string                 `json:"id,omitempty"`
	Retry     int                    `json:"retry,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
	Metadata  map[string]interface{} `json:"metadata,omitempty"`
}

// StreamConnection represents an active streaming connection
type StreamConnection struct {
	ID            string
	RequestID     string
	Type          StreamType
	Status        StreamStatus
	StartTime     time.Time
	LastEventTime time.Time
	EventCount    int
	BytesSent     int64
	Ctx           context.Context
	Cancel        context.CancelFunc
	EventChan     chan StreamEvent
	Error         error
	mu            sync.RWMutex
}

// NewStreamConnection creates a new stream connection
func NewStreamConnection(streamID, requestID string, streamType StreamType, ctx context.Context) *StreamConnection {
	connCtx, cancel := context.WithCancel(ctx)

	return &StreamConnection{
		ID:            streamID,
		RequestID:     requestID,
		Type:          streamType,
		Status:        StreamStatusActive,
		StartTime:     time.Now(),
		LastEventTime: time.Now(),
		EventCount:    0,
		BytesSent:     0,
		Ctx:           connCtx,
		Cancel:        cancel,
		EventChan:     make(chan StreamEvent, 100),
	}
}

// Close closes the stream connection
func (sc *StreamConnection) Close() {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	if sc.Status == StreamStatusCompleted || sc.Status == StreamStatusCancelled {
		return
	}

	sc.Status = StreamStatusCompleted
	sc.Cancel()
	close(sc.EventChan)
}

// SendEvent sends an event to the stream
func (sc *StreamConnection) SendEvent(event StreamEvent) error {
	sc.mu.RLock()
	if sc.Status != StreamStatusActive {
		sc.mu.RUnlock()
		return ErrStreamClosed
	}
	sc.mu.RUnlock()

	select {
	case sc.EventChan <- event:
		sc.mu.Lock()
		sc.EventCount++
		sc.LastEventTime = time.Now()
		sc.mu.Unlock()
		return nil
	case <-sc.Ctx.Done():
		return sc.Ctx.Err()
	case <-time.After(5 * time.Second):
		return errors.New("send event timeout")
	}
}

// SetError sets an error on the connection
func (sc *StreamConnection) SetError(err error) {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	sc.Error = err
	sc.Status = StreamStatusErrored
	sc.Cancel()
}

// GetMetadata returns connection metadata
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
		"duration":        time.Since(sc.StartTime).Seconds(),
	}
}

// StreamMetrics tracks streaming metrics
type StreamMetrics struct {
	TotalStreams      int64     `json:"total_streams"`
	ActiveStreams     int64     `json:"active_streams"`
	CompletedStreams  int64     `json:"completed_streams"`
	CancelledStreams  int64     `json:"cancelled_streams"`
	ErroredStreams    int64     `json:"errored_streams"`
	TotalEvents       int64     `json:"total_events"`
	TotalBytesSent    int64     `json:"total_bytes_sent"`
	AvgEventsPerStream float64  `json:"avg_events_per_stream"`
	AvgBytesPerStream  float64  `json:"avg_bytes_per_stream"`
	LastUpdated       time.Time `json:"last_updated"`
	mu                sync.RWMutex
}

// UpdateMetrics updates metrics based on a connection
func (sm *StreamMetrics) UpdateMetrics(conn *StreamConnection, completed bool) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if !completed {
		sm.TotalStreams++
		sm.ActiveStreams++
	} else {
		sm.ActiveStreams--
		sm.CompletedStreams++
		sm.TotalEvents += int64(conn.EventCount)
		sm.TotalBytesSent += conn.BytesSent

		if sm.CompletedStreams > 0 {
			sm.AvgEventsPerStream = float64(sm.TotalEvents) / float64(sm.CompletedStreams)
			sm.AvgBytesPerStream = float64(sm.TotalBytesSent) / float64(sm.CompletedStreams)
		}
	}

	sm.LastUpdated = time.Now()
}

// IncrementCancelled increments cancelled stream count
func (sm *StreamMetrics) IncrementCancelled() {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.CancelledStreams++
	sm.LastUpdated = time.Now()
}

// IncrementErrored increments errored stream count
func (sm *StreamMetrics) IncrementErrored() {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	sm.ErroredStreams++
	sm.LastUpdated = time.Now()
}

// GetSnapshot returns a copy of the current metrics
func (sm *StreamMetrics) GetSnapshot() StreamMetrics {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	return StreamMetrics{
		TotalStreams:       sm.TotalStreams,
		ActiveStreams:      sm.ActiveStreams,
		CompletedStreams:   sm.CompletedStreams,
		CancelledStreams:   sm.CancelledStreams,
		ErroredStreams:     sm.ErroredStreams,
		TotalEvents:        sm.TotalEvents,
		TotalBytesSent:     sm.TotalBytesSent,
		AvgEventsPerStream: sm.AvgEventsPerStream,
		AvgBytesPerStream:  sm.AvgBytesPerStream,
		LastUpdated:        sm.LastUpdated,
	}
}
