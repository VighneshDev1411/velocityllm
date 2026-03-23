package queue

import (
	"context"
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// MessageHandler processes a message from the queue.
type MessageHandler func(ctx context.Context, msg *Message) error

// RetryPolicy defines how failed messages are retried.
type RetryPolicy struct {
	MaxRetries     int
	InitialDelay   time.Duration
	MaxDelay       time.Duration
	BackoffFactor  float64
}

// DefaultRetryPolicy returns a sensible retry policy.
func DefaultRetryPolicy() RetryPolicy {
	return RetryPolicy{
		MaxRetries:    5,
		InitialDelay:  1 * time.Second,
		MaxDelay:      30 * time.Second,
		BackoffFactor: 2.0,
	}
}

// BrokerConfig configures the message broker.
type BrokerConfig struct {
	ConsumerGroup   string
	ConsumerName    string
	WorkerCount     int
	PollInterval    time.Duration
	ClaimInterval   time.Duration // how often to claim stale messages
	ClaimMaxIdle    time.Duration // max idle time before claiming
	RetryPolicy     RetryPolicy
	MaxQueueLength  int64
}

// DefaultBrokerConfig returns a production-ready config.
func DefaultBrokerConfig() BrokerConfig {
	return BrokerConfig{
		ConsumerGroup:  "velocityllm-workers",
		ConsumerName:   "worker-1",
		WorkerCount:    5,
		PollInterval:   100 * time.Millisecond,
		ClaimInterval:  30 * time.Second,
		ClaimMaxIdle:   60 * time.Second,
		RetryPolicy:    DefaultRetryPolicy(),
		MaxQueueLength: 10000,
	}
}

// Broker is a Redis Streams-based message broker with consumer groups,
// dead letter queues, and retry policies.
type Broker struct {
	mu       sync.RWMutex
	rdb      *redis.Client
	config   BrokerConfig
	handlers map[string]MessageHandler // message type → handler
	queues   map[string]bool           // registered queue names
	stats    *BrokerStats
	stopCh   chan struct{}
	wg       sync.WaitGroup
}

// BrokerStats tracks message processing metrics.
type BrokerStats struct {
	Published     int64            `json:"published"`
	Processed     int64            `json:"processed"`
	Failed        int64            `json:"failed"`
	Retried       int64            `json:"retried"`
	DeadLettered  int64            `json:"dead_lettered"`
	Acknowledged  int64            `json:"acknowledged"`
	AvgLatencyMs  float64          `json:"avg_latency_ms"`
	QueueDepths   map[string]int64 `json:"queue_depths"`
	ProcessedByType map[string]int64 `json:"processed_by_type"`
	mu            sync.RWMutex
	totalLatency  int64
}

func newBrokerStats() *BrokerStats {
	return &BrokerStats{
		QueueDepths:     make(map[string]int64),
		ProcessedByType: make(map[string]int64),
	}
}

// Global broker instance
var (
	globalBroker     *Broker
	globalBrokerLock sync.RWMutex
)

// NewBroker creates a new message broker backed by Redis Streams.
func NewBroker(rdb *redis.Client, config BrokerConfig) *Broker {
	b := &Broker{
		rdb:      rdb,
		config:   config,
		handlers: make(map[string]MessageHandler),
		queues:   make(map[string]bool),
		stats:    newBrokerStats(),
		stopCh:   make(chan struct{}),
	}

	// Register standard queues
	standardQueues := []string{
		QueueCompletions, QueueWebhooks, QueueNotifications,
		QueueAnalytics, QueueDefault, QueueDeadLetter,
	}
	for _, q := range standardQueues {
		b.queues[q] = true
		b.ensureStream(q)
	}

	return b
}

// InitGlobalBroker initializes and returns the global broker.
func InitGlobalBroker(rdb *redis.Client, config BrokerConfig) *Broker {
	b := NewBroker(rdb, config)

	globalBrokerLock.Lock()
	globalBroker = b
	globalBrokerLock.Unlock()

	log.Printf("[MessageBroker] Initialized: group=%s consumer=%s workers=%d",
		config.ConsumerGroup, config.ConsumerName, config.WorkerCount)

	return b
}

// GetGlobalBroker returns the global broker instance.
func GetGlobalBroker() *Broker {
	globalBrokerLock.RLock()
	defer globalBrokerLock.RUnlock()
	return globalBroker
}

// ── Publishing ──────────────────────────────────────────────────

// Publish sends a message to the specified queue.
func (b *Broker) Publish(ctx context.Context, queueName, msgType string, payload map[string]interface{}) (*Message, error) {
	msg := &Message{
		ID:        uuid.New().String(),
		Queue:     queueName,
		Type:      msgType,
		Payload:   payload,
		Priority:  PriorityNormal,
		Status:    StatusPending,
		Attempts:  0,
		MaxRetry:  b.config.RetryPolicy.MaxRetries,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	return b.publishMessage(ctx, msg)
}

// PublishWithPriority sends a message with a specific priority.
func (b *Broker) PublishWithPriority(ctx context.Context, queueName, msgType string, payload map[string]interface{}, priority Priority) (*Message, error) {
	msg := &Message{
		ID:        uuid.New().String(),
		Queue:     queueName,
		Type:      msgType,
		Payload:   payload,
		Priority:  priority,
		Status:    StatusPending,
		Attempts:  0,
		MaxRetry:  b.config.RetryPolicy.MaxRetries,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	return b.publishMessage(ctx, msg)
}

func (b *Broker) publishMessage(ctx context.Context, msg *Message) (*Message, error) {
	if b.rdb == nil {
		return nil, fmt.Errorf("redis not available")
	}

	// Check queue length limit
	length, _ := b.rdb.XLen(ctx, msg.Queue).Result()
	if length >= b.config.MaxQueueLength {
		return nil, fmt.Errorf("queue %s is full (%d messages)", msg.Queue, length)
	}

	// Add to Redis Stream
	streamID, err := b.rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: msg.Queue,
		Values: msg.ToMap(),
	}).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to publish: %w", err)
	}

	msg.ID = streamID
	atomic.AddInt64(&b.stats.Published, 1)

	return msg, nil
}

// ── Handler Registration ────────────────────────────────────────

// Handle registers a handler for a message type.
func (b *Broker) Handle(msgType string, handler MessageHandler) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.handlers[msgType] = handler
	log.Printf("[MessageBroker] Registered handler for: %s", msgType)
}

// ── Consuming ───────────────────────────────────────────────────

// Start begins consuming messages from all registered queues.
func (b *Broker) Start(ctx context.Context) {
	// Start workers for each standard queue (except dead letter)
	activeQueues := []string{
		QueueCompletions, QueueWebhooks, QueueNotifications,
		QueueAnalytics, QueueDefault,
	}

	for _, q := range activeQueues {
		b.wg.Add(1)
		go b.consumeQueue(ctx, q)
	}

	// Start stale message claimer
	b.wg.Add(1)
	go b.claimStaleMessages(ctx)

	// Start stats updater
	b.wg.Add(1)
	go b.updateStats(ctx)

	log.Printf("[MessageBroker] Started consuming from %d queues", len(activeQueues))
}

func (b *Broker) consumeQueue(ctx context.Context, queueName string) {
	defer b.wg.Done()

	for {
		select {
		case <-ctx.Done():
			return
		case <-b.stopCh:
			return
		default:
		}

		// Read from consumer group
		streams, err := b.rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    b.config.ConsumerGroup,
			Consumer: b.config.ConsumerName,
			Streams:  []string{queueName, ">"},
			Count:    1,
			Block:    b.config.PollInterval,
		}).Result()

		if err != nil {
			if err == redis.Nil {
				continue // no new messages
			}
			// Consumer group might not exist yet
			if err.Error() == "NOGROUP No such key '"+queueName+"' or consumer group '"+b.config.ConsumerGroup+"' in XREADGROUP with GROUP option" {
				b.ensureStream(queueName)
				continue
			}
			time.Sleep(time.Second)
			continue
		}

		for _, stream := range streams {
			for _, entry := range stream.Messages {
				b.processEntry(ctx, queueName, entry)
			}
		}
	}
}

func (b *Broker) processEntry(ctx context.Context, queueName string, entry redis.XMessage) {
	start := time.Now()

	// Convert stream entry to Message
	msg, err := MessageFromMap(entry.Values)
	if err != nil {
		log.Printf("[MessageBroker] Failed to parse message %s: %v", entry.ID, err)
		b.rdb.XAck(ctx, queueName, b.config.ConsumerGroup, entry.ID)
		return
	}
	msg.ID = entry.ID
	msg.Queue = queueName
	msg.Status = StatusProcessing
	msg.Attempts++

	// Find handler
	b.mu.RLock()
	handler, exists := b.handlers[msg.Type]
	b.mu.RUnlock()

	if !exists {
		// No handler registered — acknowledge and skip
		log.Printf("[MessageBroker] No handler for type=%s, skipping", msg.Type)
		b.rdb.XAck(ctx, queueName, b.config.ConsumerGroup, entry.ID)
		return
	}

	// Execute handler with timeout
	handlerCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	err = handler(handlerCtx, msg)
	cancel()

	latency := time.Since(start).Milliseconds()

	if err != nil {
		atomic.AddInt64(&b.stats.Failed, 1)
		b.handleFailure(ctx, queueName, entry.ID, msg, err)
	} else {
		// Success — acknowledge
		b.rdb.XAck(ctx, queueName, b.config.ConsumerGroup, entry.ID)
		atomic.AddInt64(&b.stats.Processed, 1)
		atomic.AddInt64(&b.stats.Acknowledged, 1)

		b.stats.mu.Lock()
		b.stats.ProcessedByType[msg.Type]++
		b.stats.totalLatency += latency
		processed := atomic.LoadInt64(&b.stats.Processed)
		if processed > 0 {
			b.stats.AvgLatencyMs = float64(b.stats.totalLatency) / float64(processed)
		}
		b.stats.mu.Unlock()
	}
}

func (b *Broker) handleFailure(ctx context.Context, queueName, streamID string, msg *Message, err error) {
	msg.Error = err.Error()
	msg.Status = StatusFailed

	if msg.Attempts >= msg.MaxRetry {
		// Move to dead letter queue
		b.moveToDLQ(ctx, queueName, streamID, msg)
		return
	}

	// Schedule retry with backoff
	msg.Status = StatusRetrying
	delay := b.calculateBackoff(msg.Attempts)

	atomic.AddInt64(&b.stats.Retried, 1)
	log.Printf("[MessageBroker] Retrying message %s (attempt %d/%d) in %v: %v",
		streamID, msg.Attempts, msg.MaxRetry, delay, err)

	// Re-publish after delay
	go func() {
		time.Sleep(delay)
		retryCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		msg.UpdatedAt = time.Now()
		b.rdb.XAdd(retryCtx, &redis.XAddArgs{
			Stream: queueName,
			Values: msg.ToMap(),
		})
	}()

	// Acknowledge the original (we'll re-publish it)
	b.rdb.XAck(ctx, queueName, b.config.ConsumerGroup, streamID)
}

func (b *Broker) moveToDLQ(ctx context.Context, queueName, streamID string, msg *Message) {
	msg.Status = StatusDead
	msg.UpdatedAt = time.Now()

	// Add to dead letter queue with original queue info
	if msg.Metadata == nil {
		msg.Metadata = make(map[string]string)
	}
	msg.Metadata["original_queue"] = queueName
	msg.Metadata["original_id"] = streamID
	msg.Metadata["dead_at"] = time.Now().Format(time.RFC3339)

	b.rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: QueueDeadLetter,
		Values: msg.ToMap(),
	})

	// Acknowledge from original queue
	b.rdb.XAck(ctx, queueName, b.config.ConsumerGroup, streamID)

	atomic.AddInt64(&b.stats.DeadLettered, 1)
	log.Printf("[MessageBroker] Message moved to DLQ: type=%s attempts=%d error=%s",
		msg.Type, msg.Attempts, msg.Error)
}

func (b *Broker) calculateBackoff(attempt int) time.Duration {
	policy := b.config.RetryPolicy
	delay := policy.InitialDelay
	for i := 1; i < attempt; i++ {
		delay = time.Duration(float64(delay) * policy.BackoffFactor)
	}
	if delay > policy.MaxDelay {
		delay = policy.MaxDelay
	}
	return delay
}

// ── Stale Message Recovery ──────────────────────────────────────

func (b *Broker) claimStaleMessages(ctx context.Context) {
	defer b.wg.Done()

	ticker := time.NewTicker(b.config.ClaimInterval)
	defer ticker.Stop()

	queues := []string{
		QueueCompletions, QueueWebhooks, QueueNotifications,
		QueueAnalytics, QueueDefault,
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-b.stopCh:
			return
		case <-ticker.C:
			for _, q := range queues {
				b.claimFromQueue(ctx, q)
			}
		}
	}
}

func (b *Broker) claimFromQueue(ctx context.Context, queueName string) {
	// Claim messages that have been pending too long (crashed consumer)
	messages, _, err := b.rdb.XAutoClaim(ctx, &redis.XAutoClaimArgs{
		Stream:   queueName,
		Group:    b.config.ConsumerGroup,
		Consumer: b.config.ConsumerName,
		MinIdle:  b.config.ClaimMaxIdle,
		Start:    "0-0",
		Count:    10,
	}).Result()
	if err != nil {
		return
	}

	for _, entry := range messages {
		b.processEntry(ctx, queueName, entry)
	}
}

// ── Stats ───────────────────────────────────────────────────────

func (b *Broker) updateStats(ctx context.Context) {
	defer b.wg.Done()

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	queues := []string{
		QueueCompletions, QueueWebhooks, QueueNotifications,
		QueueAnalytics, QueueDefault, QueueDeadLetter,
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-b.stopCh:
			return
		case <-ticker.C:
			b.stats.mu.Lock()
			for _, q := range queues {
				length, err := b.rdb.XLen(ctx, q).Result()
				if err == nil {
					b.stats.QueueDepths[q] = length
				}
			}
			b.stats.mu.Unlock()
		}
	}
}

// GetStats returns current broker statistics.
func (b *Broker) GetStats() map[string]interface{} {
	b.stats.mu.RLock()
	defer b.stats.mu.RUnlock()

	return map[string]interface{}{
		"published":         atomic.LoadInt64(&b.stats.Published),
		"processed":         atomic.LoadInt64(&b.stats.Processed),
		"failed":            atomic.LoadInt64(&b.stats.Failed),
		"retried":           atomic.LoadInt64(&b.stats.Retried),
		"dead_lettered":     atomic.LoadInt64(&b.stats.DeadLettered),
		"acknowledged":      atomic.LoadInt64(&b.stats.Acknowledged),
		"avg_latency_ms":    b.stats.AvgLatencyMs,
		"queue_depths":      b.stats.QueueDepths,
		"processed_by_type": b.stats.ProcessedByType,
		"consumer_group":    b.config.ConsumerGroup,
		"consumer_name":     b.config.ConsumerName,
		"worker_count":      b.config.WorkerCount,
		"retry_policy": map[string]interface{}{
			"max_retries":    b.config.RetryPolicy.MaxRetries,
			"initial_delay":  b.config.RetryPolicy.InitialDelay.String(),
			"max_delay":      b.config.RetryPolicy.MaxDelay.String(),
			"backoff_factor": b.config.RetryPolicy.BackoffFactor,
		},
	}
}

// GetQueueInfo returns detailed info for a specific queue.
func (b *Broker) GetQueueInfo(ctx context.Context, queueName string) (map[string]interface{}, error) {
	if b.rdb == nil {
		return nil, fmt.Errorf("redis not available")
	}

	length, _ := b.rdb.XLen(ctx, queueName).Result()

	// Get consumer group info
	groups, _ := b.rdb.XInfoGroups(ctx, queueName).Result()
	groupInfo := make([]map[string]interface{}, 0)
	for _, g := range groups {
		groupInfo = append(groupInfo, map[string]interface{}{
			"name":      g.Name,
			"consumers": g.Consumers,
			"pending":   g.Pending,
			"last_id":   g.LastDeliveredID,
		})
	}

	return map[string]interface{}{
		"queue":           queueName,
		"length":          length,
		"consumer_groups": groupInfo,
		"max_length":      b.config.MaxQueueLength,
	}, nil
}

// GetDeadLetterMessages returns messages in the dead letter queue.
func (b *Broker) GetDeadLetterMessages(ctx context.Context, count int64) ([]map[string]interface{}, error) {
	if b.rdb == nil {
		return nil, fmt.Errorf("redis not available")
	}

	entries, err := b.rdb.XRevRange(ctx, QueueDeadLetter, "+", "-").Result()
	if err != nil {
		return nil, err
	}

	if int64(len(entries)) > count {
		entries = entries[:count]
	}

	result := make([]map[string]interface{}, 0, len(entries))
	for _, e := range entries {
		msg, _ := MessageFromMap(e.Values)
		if msg != nil {
			result = append(result, map[string]interface{}{
				"stream_id": e.ID,
				"type":      msg.Type,
				"error":     msg.Error,
				"attempts":  msg.Attempts,
				"queue":     msg.Queue,
				"metadata":  msg.Metadata,
				"payload":   msg.Payload,
			})
		}
	}
	return result, nil
}

// ReplayDeadLetter moves a message from DLQ back to its original queue.
func (b *Broker) ReplayDeadLetter(ctx context.Context, streamID string) error {
	if b.rdb == nil {
		return fmt.Errorf("redis not available")
	}

	entries, err := b.rdb.XRange(ctx, QueueDeadLetter, streamID, streamID).Result()
	if err != nil || len(entries) == 0 {
		return fmt.Errorf("message not found in DLQ: %s", streamID)
	}

	msg, err := MessageFromMap(entries[0].Values)
	if err != nil {
		return err
	}

	// Determine original queue
	originalQueue := QueueDefault
	if msg.Metadata != nil {
		if q, ok := msg.Metadata["original_queue"]; ok {
			originalQueue = q
		}
	}

	// Reset and re-publish
	msg.Status = StatusPending
	msg.Attempts = 0
	msg.Error = ""
	msg.UpdatedAt = time.Now()

	_, err = b.rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: originalQueue,
		Values: msg.ToMap(),
	}).Result()
	if err != nil {
		return err
	}

	// Remove from DLQ
	b.rdb.XDel(ctx, QueueDeadLetter, streamID)

	log.Printf("[MessageBroker] Replayed DLQ message %s to %s", streamID, originalQueue)
	return nil
}

// ── Stream Setup ────────────────────────────────────────────────

func (b *Broker) ensureStream(queueName string) {
	if b.rdb == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Create stream with consumer group (MKSTREAM creates it if needed)
	err := b.rdb.XGroupCreateMkStream(ctx, queueName, b.config.ConsumerGroup, "0").Err()
	if err != nil && err.Error() != "BUSYGROUP Consumer Group name already exists" {
		// Not an error if group already exists
		log.Printf("[MessageBroker] Stream setup for %s: %v", queueName, err)
	}
}

// ── Shutdown ────────────────────────────────────────────────────

// Stop gracefully shuts down the broker.
func (b *Broker) Stop() {
	close(b.stopCh)
	b.wg.Wait()
	log.Printf("[MessageBroker] Stopped")
}
