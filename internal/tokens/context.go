package tokens

import (
	"fmt"
	"sync"
	"time"
)

// ContextManager manages conversation context and token budgets
type ContextManager struct {
	counter       *TokenCounter
	contexts      map[string]*Context
	mu            sync.RWMutex
	maxContextAge time.Duration
	cleanupTicker *time.Ticker
	stats         *ContextStats
}

// Context represents a conversation context
type Context struct {
	ID            string
	Messages      []Message
	TotalTokens   int
	MaxTokens     int
	CreatedAt     time.Time
	LastAccessed  time.Time
	SystemPrompt  string
	Metadata      map[string]interface{}
	mu            sync.RWMutex
}

// ContextStats tracks context manager statistics
type ContextStats struct {
	TotalContexts     int64
	ActiveContexts    int
	TotalMessages     int64
	TotalTokens       int64
	ContextsCreated   int64
	ContextsExpired   int64
	MessagesTruncated int64
	mu                sync.RWMutex
}

// ContextConfig configuration for context manager
type ContextConfig struct {
	MaxContextAge     time.Duration
	CleanupInterval   time.Duration
	DefaultMaxTokens  int
	EnableAutoCleanup bool
}

// NewContextManager creates a new context manager
func NewContextManager(config ContextConfig) *ContextManager {
	cm := &ContextManager{
		counter:       GetGlobalCounter(),
		contexts:      make(map[string]*Context),
		maxContextAge: config.MaxContextAge,
		stats:         &ContextStats{},
	}

	// Start cleanup goroutine if enabled
	if config.EnableAutoCleanup {
		cm.cleanupTicker = time.NewTicker(config.CleanupInterval)
		go cm.cleanupLoop()
	}

	return cm
}

// CreateContext creates a new conversation context
func (cm *ContextManager) CreateContext(id string, maxTokens int, systemPrompt string) (*Context, error) {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if _, exists := cm.contexts[id]; exists {
		return nil, fmt.Errorf("context already exists: %s", id)
	}

	ctx := &Context{
		ID:           id,
		Messages:     make([]Message, 0),
		MaxTokens:    maxTokens,
		CreatedAt:    time.Now(),
		LastAccessed: time.Now(),
		SystemPrompt: systemPrompt,
		Metadata:     make(map[string]interface{}),
	}

	// Add system prompt if provided
	if systemPrompt != "" {
		ctx.Messages = append(ctx.Messages, Message{
			Role:    "system",
			Content: systemPrompt,
		})
		ctx.TotalTokens = cm.counter.Count(systemPrompt)
	}

	cm.contexts[id] = ctx
	cm.stats.mu.Lock()
	cm.stats.ContextsCreated++
	cm.stats.ActiveContexts++
	cm.stats.TotalContexts++
	cm.stats.mu.Unlock()

	return ctx, nil
}

// GetContext retrieves a context by ID
func (cm *ContextManager) GetContext(id string) (*Context, error) {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	ctx, exists := cm.contexts[id]
	if !exists {
		return nil, fmt.Errorf("context not found: %s", id)
	}

	ctx.LastAccessed = time.Now()
	return ctx, nil
}

// AddMessage adds a message to context with automatic truncation
func (cm *ContextManager) AddMessage(contextID string, role, content string) error {
	cm.mu.RLock()
	ctx, exists := cm.contexts[contextID]
	cm.mu.RUnlock()

	if !exists {
		return fmt.Errorf("context not found: %s", contextID)
	}

	ctx.mu.Lock()
	defer ctx.mu.Unlock()

	msg := Message{
		Role:    role,
		Content: content,
	}

	messageTokens := cm.counter.Count(content) + 4 // +4 for role and formatting
	newTotal := ctx.TotalTokens + messageTokens

	// If adding this message exceeds limit, truncate old messages
	if ctx.MaxTokens > 0 && newTotal > ctx.MaxTokens {
		ctx.Messages, ctx.TotalTokens = cm.truncateMessages(ctx.Messages, ctx.MaxTokens-messageTokens)
		cm.stats.mu.Lock()
		cm.stats.MessagesTruncated++
		cm.stats.mu.Unlock()
	}

	ctx.Messages = append(ctx.Messages, msg)
	ctx.TotalTokens += messageTokens
	ctx.LastAccessed = time.Now()

	cm.stats.mu.Lock()
	cm.stats.TotalMessages++
	cm.stats.TotalTokens += int64(messageTokens)
	cm.stats.mu.Unlock()

	return nil
}

// truncateMessages removes oldest messages to fit within token limit
// Preserves system message if present
func (cm *ContextManager) truncateMessages(messages []Message, targetTokens int) ([]Message, int) {
	if len(messages) == 0 {
		return messages, 0
	}

	result := make([]Message, 0, len(messages))
	totalTokens := 0
	startIdx := 0

	// Keep system message if present
	if len(messages) > 0 && messages[0].Role == "system" {
		result = append(result, messages[0])
		totalTokens = cm.counter.Count(messages[0].Content) + 4
		startIdx = 1
	}

	// Add messages from newest to oldest until we hit limit
	for i := len(messages) - 1; i >= startIdx; i-- {
		msgTokens := cm.counter.Count(messages[i].Content) + 4
		if totalTokens+msgTokens > targetTokens {
			break
		}
		result = append([]Message{messages[i]}, result...)
		totalTokens += msgTokens
	}

	return result, totalTokens
}

// GetMessages returns all messages in context
func (cm *ContextManager) GetMessages(contextID string) ([]Message, error) {
	cm.mu.RLock()
	ctx, exists := cm.contexts[contextID]
	cm.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("context not found: %s", contextID)
	}

	ctx.mu.RLock()
	defer ctx.mu.RUnlock()

	// Return copy to prevent external modification
	messages := make([]Message, len(ctx.Messages))
	copy(messages, ctx.Messages)
	return messages, nil
}

// GetTokenCount returns current token count for context
func (cm *ContextManager) GetTokenCount(contextID string) (int, error) {
	cm.mu.RLock()
	ctx, exists := cm.contexts[contextID]
	cm.mu.RUnlock()

	if !exists {
		return 0, fmt.Errorf("context not found: %s", contextID)
	}

	ctx.mu.RLock()
	defer ctx.mu.RUnlock()

	return ctx.TotalTokens, nil
}

// RemainingTokens returns how many tokens remain in context budget
func (cm *ContextManager) RemainingTokens(contextID string) (int, error) {
	cm.mu.RLock()
	ctx, exists := cm.contexts[contextID]
	cm.mu.RUnlock()

	if !exists {
		return 0, fmt.Errorf("context not found: %s", contextID)
	}

	ctx.mu.RLock()
	defer ctx.mu.RUnlock()

	if ctx.MaxTokens == 0 {
		return -1, nil // Unlimited
	}

	remaining := ctx.MaxTokens - ctx.TotalTokens
	if remaining < 0 {
		return 0, nil
	}
	return remaining, nil
}

// ClearContext removes all messages from context except system prompt
func (cm *ContextManager) ClearContext(contextID string) error {
	cm.mu.RLock()
	ctx, exists := cm.contexts[contextID]
	cm.mu.RUnlock()

	if !exists {
		return fmt.Errorf("context not found: %s", contextID)
	}

	ctx.mu.Lock()
	defer ctx.mu.Unlock()

	// Keep only system message if present
	if len(ctx.Messages) > 0 && ctx.Messages[0].Role == "system" {
		ctx.Messages = ctx.Messages[:1]
		ctx.TotalTokens = cm.counter.Count(ctx.Messages[0].Content) + 4
	} else {
		ctx.Messages = make([]Message, 0)
		ctx.TotalTokens = 0
	}

	return nil
}

// DeleteContext removes a context completely
func (cm *ContextManager) DeleteContext(contextID string) error {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	if _, exists := cm.contexts[contextID]; !exists {
		return fmt.Errorf("context not found: %s", contextID)
	}

	delete(cm.contexts, contextID)
	cm.stats.mu.Lock()
	cm.stats.ActiveContexts--
	cm.stats.mu.Unlock()

	return nil
}

// cleanupLoop periodically removes expired contexts
func (cm *ContextManager) cleanupLoop() {
	for range cm.cleanupTicker.C {
		cm.cleanupExpiredContexts()
	}
}

// cleanupExpiredContexts removes contexts that haven't been accessed recently
func (cm *ContextManager) cleanupExpiredContexts() {
	cm.mu.Lock()
	defer cm.mu.Unlock()

	now := time.Now()
	expired := make([]string, 0)

	for id, ctx := range cm.contexts {
		ctx.mu.RLock()
		age := now.Sub(ctx.LastAccessed)
		ctx.mu.RUnlock()

		if age > cm.maxContextAge {
			expired = append(expired, id)
		}
	}

	for _, id := range expired {
		delete(cm.contexts, id)
		cm.stats.mu.Lock()
		cm.stats.ContextsExpired++
		cm.stats.ActiveContexts--
		cm.stats.mu.Unlock()
	}
}

// GetStats returns context manager statistics
func (cm *ContextManager) GetStats() *ContextStats {
	cm.stats.mu.RLock()
	defer cm.stats.mu.RUnlock()

	return &ContextStats{
		TotalContexts:     cm.stats.TotalContexts,
		ActiveContexts:    cm.stats.ActiveContexts,
		TotalMessages:     cm.stats.TotalMessages,
		TotalTokens:       cm.stats.TotalTokens,
		ContextsCreated:   cm.stats.ContextsCreated,
		ContextsExpired:   cm.stats.ContextsExpired,
		MessagesTruncated: cm.stats.MessagesTruncated,
	}
}

// ListContexts returns all active context IDs
func (cm *ContextManager) ListContexts() []string {
	cm.mu.RLock()
	defer cm.mu.RUnlock()

	ids := make([]string, 0, len(cm.contexts))
	for id := range cm.contexts {
		ids = append(ids, id)
	}
	return ids
}

// Shutdown stops cleanup goroutine
func (cm *ContextManager) Shutdown() {
	if cm.cleanupTicker != nil {
		cm.cleanupTicker.Stop()
	}
}

// Global context manager
var globalContextManager *ContextManager
var contextManagerOnce sync.Once

// InitGlobalContextManager initializes global context manager
func InitGlobalContextManager(config ContextConfig) *ContextManager {
	contextManagerOnce.Do(func() {
		globalContextManager = NewContextManager(config)
	})
	return globalContextManager
}

// GetGlobalContextManager returns global context manager
func GetGlobalContextManager() *ContextManager {
	return globalContextManager
}
