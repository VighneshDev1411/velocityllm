package tokens

import (
	"strings"
	"sync"
	"unicode"
)

// TokenCounter provides token counting and estimation
type TokenCounter struct {
	cache map[string]int
	mu    sync.RWMutex
}

// NewTokenCounter creates a new token counter
func NewTokenCounter() *TokenCounter {
	return &TokenCounter{
		cache: make(map[string]int),
	}
}

// Count counts tokens in text using estimation algorithm
// This is a simplified version - production should use tiktoken or similar
func (tc *TokenCounter) Count(text string) int {
	tc.mu.RLock()
	if cached, exists := tc.cache[text]; exists {
		tc.mu.RUnlock()
		return cached
	}
	tc.mu.RUnlock()

	// Simple estimation: ~0.75 tokens per word (GPT average)
	// More accurate for production: use tiktoken library
	words := tc.countWords(text)
	tokens := int(float64(words) * 0.75)

	// Add punctuation and special characters (~10% overhead)
	specialChars := tc.countSpecialChars(text)
	tokens += specialChars / 4

	// Cache result
	tc.mu.Lock()
	tc.cache[text] = tokens
	tc.mu.Unlock()

	return tokens
}

// CountMessages counts total tokens in message array
func (tc *TokenCounter) CountMessages(messages []Message) int {
	total := 0
	for _, msg := range messages {
		// Add tokens for role (~1 token)
		total += 1
		// Add tokens for content
		total += tc.Count(msg.Content)
		// Add message formatting overhead (~3 tokens per message)
		total += 3
	}
	return total
}

// EstimateResponseTokens estimates tokens needed for response
func (tc *TokenCounter) EstimateResponseTokens(promptTokens, maxTokens int) int {
	if maxTokens > 0 {
		return maxTokens
	}
	// Default estimation: 2x prompt length (reasonable for most completions)
	estimated := promptTokens * 2
	// Cap at 4096 tokens (common model limit)
	if estimated > 4096 {
		return 4096
	}
	return estimated
}

// WillFitInContext checks if text fits within token limit
func (tc *TokenCounter) WillFitInContext(text string, limit int) bool {
	return tc.Count(text) <= limit
}

// TruncateToFit truncates text to fit within token limit
func (tc *TokenCounter) TruncateToFit(text string, limit int) string {
	currentTokens := tc.Count(text)
	if currentTokens <= limit {
		return text
	}

	// Binary search for correct length
	words := strings.Fields(text)
	left, right := 0, len(words)

	for left < right {
		mid := (left + right + 1) / 2
		truncated := strings.Join(words[:mid], " ")
		if tc.Count(truncated) <= limit {
			left = mid
		} else {
			right = mid - 1
		}
	}

	result := strings.Join(words[:left], " ")
	if left < len(words) {
		result += "..."
	}
	return result
}

// countWords counts words in text
func (tc *TokenCounter) countWords(text string) int {
	return len(strings.Fields(text))
}

// countSpecialChars counts special characters
func (tc *TokenCounter) countSpecialChars(text string) int {
	count := 0
	for _, r := range text {
		if !unicode.IsLetter(r) && !unicode.IsSpace(r) {
			count++
		}
	}
	return count
}

// Message represents a chat message
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// GetCacheSize returns the size of the token cache
func (tc *TokenCounter) GetCacheSize() int {
	tc.mu.RLock()
	defer tc.mu.RUnlock()
	return len(tc.cache)
}

// ClearCache clears the token counting cache
func (tc *TokenCounter) ClearCache() {
	tc.mu.Lock()
	defer tc.mu.Unlock()
	tc.cache = make(map[string]int)
}

// Global token counter
var globalCounter *TokenCounter
var counterOnce sync.Once

// GetGlobalCounter returns the global token counter instance
func GetGlobalCounter() *TokenCounter {
	counterOnce.Do(func() {
		globalCounter = NewTokenCounter()
	})
	return globalCounter
}
