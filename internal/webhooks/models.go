package webhooks

import (
	"time"

	"gorm.io/gorm"
)

// EventType defines the types of events that can trigger webhooks
type EventType string

const (
	EventRequestCompleted  EventType = "request.completed"
	EventRequestFailed     EventType = "request.failed"
	EventQuotaWarning      EventType = "quota.warning"
	EventQuotaExceeded     EventType = "quota.exceeded"
	EventKeyCreated        EventType = "apikey.created"
	EventKeyRevoked        EventType = "apikey.revoked"
	EventUserCreated       EventType = "user.created"
	EventUserDeleted       EventType = "user.deleted"
	EventSubscriptionChanged EventType = "subscription.changed"
	EventSystemAlert       EventType = "system.alert"
	EventLoadTestCompleted EventType = "loadtest.completed"
	EventModelDown         EventType = "model.down"
	EventModelRecovered    EventType = "model.recovered"
)

// WebhookEndpoint represents a registered webhook URL
type WebhookEndpoint struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	UserID      uint      `gorm:"index;not null" json:"user_id"`
	Name        string    `gorm:"type:varchar(255);not null" json:"name"`
	URL         string    `gorm:"type:varchar(500);not null" json:"url"`
	Secret      string    `gorm:"type:varchar(255)" json:"secret,omitempty"` // HMAC signing secret
	Events      string    `gorm:"type:text;not null" json:"events"`          // Comma-separated event types
	Active      bool      `gorm:"default:true" json:"active"`
	Description string    `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// WebhookDelivery represents a single webhook delivery attempt
type WebhookDelivery struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	EndpointID   uint      `gorm:"index;not null" json:"endpoint_id"`
	EventType    EventType `gorm:"type:varchar(50);not null" json:"event_type"`
	Payload      string    `gorm:"type:text;not null" json:"payload"`
	StatusCode   int       `json:"status_code"`
	ResponseBody string    `gorm:"type:text" json:"response_body,omitempty"`
	Success      bool      `gorm:"default:false" json:"success"`
	LatencyMs    int64     `json:"latency_ms"`
	Attempt      int       `gorm:"default:1" json:"attempt"`
	MaxRetries   int       `gorm:"default:3" json:"max_retries"`
	Error        string    `gorm:"type:text" json:"error,omitempty"`
	DeliveredAt  time.Time `json:"delivered_at"`
	CreatedAt    time.Time `json:"created_at"`
}

// EventLog stores all events for audit trail
type EventLog struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `gorm:"index" json:"user_id"`
	EventType EventType `gorm:"type:varchar(50);index;not null" json:"event_type"`
	Source    string    `gorm:"type:varchar(100)" json:"source"`
	Payload   string    `gorm:"type:text;not null" json:"payload"`
	Metadata  string    `gorm:"type:text" json:"metadata,omitempty"`
	CreatedAt time.Time `gorm:"index" json:"created_at"`
}

func (WebhookEndpoint) TableName() string  { return "webhook_endpoints" }
func (WebhookDelivery) TableName() string  { return "webhook_deliveries" }
func (EventLog) TableName() string         { return "event_logs" }

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&WebhookEndpoint{},
		&WebhookDelivery{},
		&EventLog{},
	)
}
