package queue

import (
	"encoding/json"
	"time"
)

// Message represents a message in the queue system.
type Message struct {
	ID        string                 `json:"id"`
	Queue     string                 `json:"queue"`
	Type      string                 `json:"type"`
	Payload   map[string]interface{} `json:"payload"`
	Priority  Priority               `json:"priority"`
	Status    MessageStatus          `json:"status"`
	Attempts  int                    `json:"attempts"`
	MaxRetry  int                    `json:"max_retry"`
	CreatedAt time.Time              `json:"created_at"`
	UpdatedAt time.Time              `json:"updated_at"`
	Error     string                 `json:"error,omitempty"`
	Metadata  map[string]string      `json:"metadata,omitempty"`
}

// Priority levels for message ordering.
type Priority int

const (
	PriorityLow      Priority = 0
	PriorityNormal   Priority = 1
	PriorityHigh     Priority = 2
	PriorityCritical Priority = 3
)

func (p Priority) String() string {
	switch p {
	case PriorityLow:
		return "low"
	case PriorityNormal:
		return "normal"
	case PriorityHigh:
		return "high"
	case PriorityCritical:
		return "critical"
	}
	return "unknown"
}

// MessageStatus tracks the lifecycle of a message.
type MessageStatus string

const (
	StatusPending    MessageStatus = "pending"
	StatusProcessing MessageStatus = "processing"
	StatusCompleted  MessageStatus = "completed"
	StatusFailed     MessageStatus = "failed"
	StatusDead       MessageStatus = "dead" // moved to dead letter queue
	StatusRetrying   MessageStatus = "retrying"
)

// Queue names used by the system.
const (
	QueueCompletions  = "velocityllm:queue:completions"
	QueueWebhooks     = "velocityllm:queue:webhooks"
	QueueNotifications = "velocityllm:queue:notifications"
	QueueAnalytics    = "velocityllm:queue:analytics"
	QueueDefault      = "velocityllm:queue:default"
	QueueDeadLetter   = "velocityllm:queue:dead_letter"
)

// Message types for routing to handlers.
const (
	TypeCompletionRequest = "completion.request"
	TypeCompletionBatch   = "completion.batch"
	TypeWebhookDelivery   = "webhook.delivery"
	TypeNotification      = "notification.send"
	TypeAnalyticsEvent    = "analytics.event"
	TypeCacheInvalidation = "cache.invalidation"
	TypeModelHealthCheck  = "model.healthcheck"
)

// ToMap serializes a Message for Redis Stream XADD.
func (m *Message) ToMap() map[string]interface{} {
	payload, _ := json.Marshal(m.Payload)
	metadata, _ := json.Marshal(m.Metadata)
	return map[string]interface{}{
		"id":         m.ID,
		"queue":      m.Queue,
		"type":       m.Type,
		"payload":    string(payload),
		"priority":   int(m.Priority),
		"status":     string(m.Status),
		"attempts":   m.Attempts,
		"max_retry":  m.MaxRetry,
		"created_at": m.CreatedAt.UnixMilli(),
		"error":      m.Error,
		"metadata":   string(metadata),
	}
}

// MessageFromMap deserializes a Redis Stream entry into a Message.
func MessageFromMap(values map[string]interface{}) (*Message, error) {
	msg := &Message{}

	if v, ok := values["id"].(string); ok {
		msg.ID = v
	}
	if v, ok := values["queue"].(string); ok {
		msg.Queue = v
	}
	if v, ok := values["type"].(string); ok {
		msg.Type = v
	}
	if v, ok := values["status"].(string); ok {
		msg.Status = MessageStatus(v)
	}
	if v, ok := values["error"].(string); ok {
		msg.Error = v
	}

	// Parse payload JSON
	if v, ok := values["payload"].(string); ok {
		var payload map[string]interface{}
		if err := json.Unmarshal([]byte(v), &payload); err == nil {
			msg.Payload = payload
		}
	}

	// Parse metadata JSON
	if v, ok := values["metadata"].(string); ok {
		var meta map[string]string
		if err := json.Unmarshal([]byte(v), &meta); err == nil {
			msg.Metadata = meta
		}
	}

	return msg, nil
}
