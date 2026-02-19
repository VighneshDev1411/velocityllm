package quota

import (
	"time"

	"gorm.io/gorm"
)

// QuotaType defines the type of quota
type QuotaType string

const (
	QuotaTypeRequests QuotaType = "requests"
	QuotaTypeTokens   QuotaType = "tokens"
	QuotaTypeCost     QuotaType = "cost"
)

// QuotaPeriod defines the time period for quota reset
type QuotaPeriod string

const (
	QuotaPeriodHourly  QuotaPeriod = "hourly"
	QuotaPeriodDaily   QuotaPeriod = "daily"
	QuotaPeriodWeekly  QuotaPeriod = "weekly"
	QuotaPeriodMonthly QuotaPeriod = "monthly"
)

// AlertType defines the type of alert
type AlertType string

const (
	AlertTypeEmail   AlertType = "email"
	AlertTypeWebhook AlertType = "webhook"
	AlertTypeSlack   AlertType = "slack"
)

// UserQuota represents custom quota overrides for a user
type UserQuota struct {
	ID        uint            `gorm:"primaryKey" json:"id"`
	UserID    uint            `gorm:"index;not null" json:"user_id"`
	Type      QuotaType       `gorm:"type:varchar(20);not null" json:"type"`
	Period    QuotaPeriod     `gorm:"type:varchar(20);not null" json:"period"`
	Limit     int64           `gorm:"not null" json:"limit"` // Custom limit (overrides tier default)
	SoftLimit int64           `json:"soft_limit"`            // Warning threshold (e.g., 80% of limit)
	HardLimit int64           `json:"hard_limit"`            // Absolute maximum (e.g., 120% of limit with grace)
	Enabled   bool            `gorm:"default:true" json:"enabled"`
	Reason    string          `gorm:"type:text" json:"reason"` // Why this custom quota was set
	CreatedBy uint            `json:"created_by"`              // Admin who created this
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
	DeletedAt gorm.DeletedAt  `gorm:"index" json:"-"`
}

// QuotaUsage tracks current usage against quotas
type QuotaUsage struct {
	ID            uint        `gorm:"primaryKey" json:"id"`
	UserID        uint        `gorm:"index;not null" json:"user_id"`
	Type          QuotaType   `gorm:"type:varchar(20);not null" json:"type"`
	Period        QuotaPeriod `gorm:"type:varchar(20);not null" json:"period"`
	PeriodStart   time.Time   `gorm:"index;not null" json:"period_start"`
	PeriodEnd     time.Time   `gorm:"not null" json:"period_end"`
	CurrentUsage  int64       `gorm:"default:0" json:"current_usage"`
	QuotaLimit    int64       `json:"quota_limit"`    // Current applicable limit
	IsOverLimit   bool        `gorm:"default:false" json:"is_over_limit"`
	OverageAmount int64       `gorm:"default:0" json:"overage_amount"`
	LastCheckedAt time.Time   `json:"last_checked_at"`
	CreatedAt     time.Time   `json:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at"`
}

// UsageAlert represents alerts sent when quota thresholds are reached
type UsageAlert struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	UserID       uint      `gorm:"index;not null" json:"user_id"`
	Type         AlertType `gorm:"type:varchar(20);not null" json:"type"`
	QuotaType    QuotaType `gorm:"type:varchar(20);not null" json:"quota_type"`
	Threshold    int       `gorm:"not null" json:"threshold"` // Percentage (e.g., 80, 90, 100)
	Message      string    `gorm:"type:text;not null" json:"message"`
	CurrentUsage int64     `json:"current_usage"`
	QuotaLimit   int64     `json:"quota_limit"`
	Sent         bool      `gorm:"default:false" json:"sent"`
	SentAt       *time.Time `json:"sent_at,omitempty"`
	Error        string    `gorm:"type:text" json:"error,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

// AlertConfiguration stores user preferences for alerts
type AlertConfiguration struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	UserID            uint      `gorm:"uniqueIndex;not null" json:"user_id"`
	EmailEnabled      bool      `gorm:"default:true" json:"email_enabled"`
	WebhookEnabled    bool      `gorm:"default:false" json:"webhook_enabled"`
	WebhookURL        string    `gorm:"type:varchar(500)" json:"webhook_url,omitempty"`
	SlackEnabled      bool      `gorm:"default:false" json:"slack_enabled"`
	SlackWebhookURL   string    `gorm:"type:varchar(500)" json:"slack_webhook_url,omitempty"`
	ThresholdWarning  int       `gorm:"default:80" json:"threshold_warning"`  // 80% usage
	ThresholdCritical int       `gorm:"default:90" json:"threshold_critical"` // 90% usage
	ThresholdExceeded int       `gorm:"default:100" json:"threshold_exceeded"` // 100% usage
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// RateLimitEvent logs rate limit enforcement events
type RateLimitEvent struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	UserID       uint      `gorm:"index;not null" json:"user_id"`
	QuotaType    QuotaType `gorm:"type:varchar(20);not null" json:"quota_type"`
	RequestPath  string    `gorm:"type:varchar(255)" json:"request_path"`
	CurrentUsage int64     `json:"current_usage"`
	QuotaLimit   int64     `json:"quota_limit"`
	Blocked      bool      `gorm:"default:true" json:"blocked"`
	Message      string    `gorm:"type:text" json:"message"`
	CreatedAt    time.Time `json:"created_at"`
}

// TableName overrides
func (UserQuota) TableName() string {
	return "user_quotas"
}

func (QuotaUsage) TableName() string {
	return "quota_usage"
}

func (UsageAlert) TableName() string {
	return "usage_alerts"
}

func (AlertConfiguration) TableName() string {
	return "alert_configurations"
}

func (RateLimitEvent) TableName() string {
	return "rate_limit_events"
}

// AutoMigrate runs migrations for all quota tables
func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&UserQuota{},
		&QuotaUsage{},
		&UsageAlert{},
		&AlertConfiguration{},
		&RateLimitEvent{},
	)
}
