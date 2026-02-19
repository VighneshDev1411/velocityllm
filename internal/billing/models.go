package billing

import (
	"time"

	"gorm.io/gorm"
)

// SubscriptionTier represents different subscription levels
type SubscriptionTier string

const (
	TierFree       SubscriptionTier = "free"
	TierPro        SubscriptionTier = "pro"
	TierEnterprise SubscriptionTier = "enterprise"
)

// Subscription represents a user's subscription plan
type Subscription struct {
	ID                string           `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	UserID            string           `gorm:"index;not null" json:"user_id"`
	Tier              SubscriptionTier `gorm:"not null;default:'free'" json:"tier"`
	Status            string           `gorm:"not null;default:'active'" json:"status"` // active, cancelled, expired
	BillingCycleStart time.Time        `json:"billing_cycle_start"`
	BillingCycleEnd   time.Time        `json:"billing_cycle_end"`
	StripeCustomerID  string           `json:"stripe_customer_id,omitempty"`
	StripeSubID       string           `json:"stripe_subscription_id,omitempty"`
	CreatedAt         time.Time        `json:"created_at"`
	UpdatedAt         time.Time        `json:"updated_at"`
}

// TableName specifies the table name
func (Subscription) TableName() string {
	return "subscriptions"
}

// Invoice represents a billing invoice
type Invoice struct {
	ID          string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	UserID      string    `gorm:"index;not null" json:"user_id"`
	Amount      float64   `gorm:"not null" json:"amount"`
	Currency    string    `gorm:"default:'usd'" json:"currency"`
	Status      string    `gorm:"default:'pending'" json:"status"` // pending, paid, failed
	PeriodStart time.Time `json:"period_start"`
	PeriodEnd   time.Time `json:"period_end"`
	DueDate     time.Time `json:"due_date"`
	PaidAt      *time.Time `json:"paid_at,omitempty"`
	Items       string    `gorm:"type:jsonb" json:"items"` // JSON array of line items
	CreatedAt   time.Time `json:"created_at"`
}

// TableName specifies the table name
func (Invoice) TableName() string {
	return "invoices"
}

// UsageRecord tracks individual API usage for billing
type UsageRecord struct {
	ID        string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	UserID    string    `gorm:"index;not null" json:"user_id"`
	APIKeyID  string    `gorm:"index" json:"api_key_id,omitempty"`
	Model     string    `gorm:"index" json:"model"`
	Tokens    int       `json:"tokens"`
	Cost      float64   `json:"cost"`
	Timestamp time.Time `gorm:"index" json:"timestamp"`
}

// TableName specifies the table name
func (UsageRecord) TableName() string {
	return "usage_records"
}

// TierLimits defines limits for each subscription tier
type TierLimits struct {
	RequestsPerMonth int
	TokensPerMonth   int
	MaxAPIKeys       int
	SupportLevel     string
	PricePerMonth    float64
}

// GetTierLimits returns limits for a given tier
func GetTierLimits(tier SubscriptionTier) TierLimits {
	limits := map[SubscriptionTier]TierLimits{
		TierFree: {
			RequestsPerMonth: 1000,
			TokensPerMonth:   100000,
			MaxAPIKeys:       2,
			SupportLevel:     "community",
			PricePerMonth:    0,
		},
		TierPro: {
			RequestsPerMonth: 50000,
			TokensPerMonth:   5000000,
			MaxAPIKeys:       10,
			SupportLevel:     "email",
			PricePerMonth:    49,
		},
		TierEnterprise: {
			RequestsPerMonth: -1, // unlimited
			TokensPerMonth:   -1, // unlimited
			MaxAPIKeys:       -1, // unlimited
			SupportLevel:     "priority",
			PricePerMonth:    499,
		},
	}
	return limits[tier]
}

// Service handles billing operations
type Service struct {
	db *gorm.DB
}

// NewService creates a new billing service
func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

// AutoMigrate runs migrations for billing tables
func (s *Service) AutoMigrate() error {
	return s.db.AutoMigrate(&Subscription{}, &Invoice{}, &UsageRecord{})
}

// Model pricing (cost per 1M tokens)
var ModelPricing = map[string]float64{
	"gpt-4":                    0.03,   // $30 per 1M tokens
	"gpt-4-turbo":              0.01,   // $10 per 1M tokens
	"gpt-3.5-turbo":            0.001,  // $1 per 1M tokens
	"claude-3-opus-20240229":   0.015,  // $15 per 1M tokens
	"claude-3-sonnet-20240229": 0.003,  // $3 per 1M tokens
	"claude-3-haiku-20240307":  0.00025, // $0.25 per 1M tokens
	"claude-sonnet-4-20250514": 0.003,  // $3 per 1M tokens (estimate)
}

// CalculateCost calculates cost for a given model and token count
func CalculateCost(model string, tokens int) float64 {
	pricePerMillion, exists := ModelPricing[model]
	if !exists {
		pricePerMillion = 0.01 // default $10 per 1M tokens
	}
	return (float64(tokens) / 1000000.0) * pricePerMillion
}
