package streaming

import (
	"time"
)

// NewTokenBuffer creates a new token buffer
func NewTokenBuffer(maxSize int) *TokenBuffer {
	return &TokenBuffer{
		tokens:    make([]TokenChunk, 0, maxSize),
		maxSize:   maxSize,
		flushTime: time.Now(),
	}
}

// Add adds a token to the buffer
func (tb *TokenBuffer) Add(token string, index int) {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	chunk := TokenChunk{
		Token:     token,
		Index:     index,
		Timestamp: time.Now(),
	}

	tb.tokens = append(tb.tokens, chunk)
}

// ShouldFlush determines if buffer should be flushed
func (tb *TokenBuffer) ShouldFlush(flushInterval time.Duration) bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	// Flush if buffer is full
	if len(tb.tokens) >= tb.maxSize {
		return true
	}

	// Flush if interval elapsed
	if time.Since(tb.flushTime) >= flushInterval {
		return true
	}

	return false
}

// Flush returns and clears buffered tokens
func (tb *TokenBuffer) Flush() []TokenChunk {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	if len(tb.tokens) == 0 {
		return nil
	}

	// Copy tokens
	flushed := make([]TokenChunk, len(tb.tokens))
	copy(flushed, tb.tokens)

	// Clear buffer
	tb.tokens = tb.tokens[:0]
	tb.flushTime = time.Now()

	return flushed
}

// Size returns current buffer size
func (tb *TokenBuffer) Size() int {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	return len(tb.tokens)
}

// Clear clears the buffer
func (tb *TokenBuffer) Clear() {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	tb.tokens = tb.tokens[:0]
	tb.flushTime = time.Now()
}

// IsFull returns true if buffer is full
func (tb *TokenBuffer) IsFull() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	return len(tb.tokens) >= tb.maxSize
}

// IsEmpty returns true if buffer is empty
func (tb *TokenBuffer) IsEmpty() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	return len(tb.tokens) == 0
}
