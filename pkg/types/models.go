package types

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BaseModel struct {
	ID        uuid.UUID      `gorm:"type:uuid;primary_key;" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (base *BaseModel) BeforeCreate(tx *gorm.DB) error {
	if base.ID == uuid.Nil {
		base.ID = uuid.New()
	}
	return nil
}

type Request struct {
	BaseModel
	Model          string  `gorm:"type:varchar(100);not null" json:"model"`
	Prompt         string  `gorm:"type:text;not null" json:"prompt"`
	Response       string  `gorm:"type:text" json:"response"`
	TokensPrompt   int     `gorm:"not null;default:0" json:"tokens_prompt"`
	TokensResponse int     `gorm:"not null;default:0" json:"tokens_response"`
	TokensTotal    int     `gorm:"not null;default:0" json:"tokens_total"`
	Latency        int     `gorm:"not null;default:0" json:"latency"` // in milliseconds
	Cost           float64 `gorm:"type:decimal(10,6);not null;default:0" json:"cost"`
	Status         string  `gorm:"type:varchar(50);not null;default:'pending'" json:"status"`
	Error          string  `gorm:"type:text" json:"error,omitempty"`
	CacheHit       bool    `gorm:"not null;default:false" json:"cache_hit"`
	Provider       string  `gorm:"type:varchar(50)" json:"provider"` // openai, anthropic, local
}

type Model struct {
	BaseModel
	Name         string  `gorm:"type:varchar(100);uniqueIndex;not null" json:"name"`
	Provider     string  `gorm:"type:varchar(50);not null" json:"provider"`
	CostPerToken float64 `gorm:"type:decimal(10,8);not null;default:0" json:"cost_per_token"`
	MaxTokens    int     `gorm:"not null;default:4096" json:"max_tokens"`
	Available    bool    `gorm:"not null;default:true" json:"available"`
	Endpoint     string  `gorm:"type:varchar(255)" json:"endpoint,omitempty"`
	Description  string  `gorm:"type:text" json:"description,omitempty"`
}

type CacheEntry struct {
	BaseModel
	Key       string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"key"`
	Value     string    `gorm:"type:text;not null" json:"value"`
	Embedding string    `gorm:"type:text" json:"embedding,omitempty"` // JSON array of floats
	Hits      int       `gorm:"not null;default:0" json:"hits"`
	ExpiresAt time.Time `gorm:"index" json:"expires_at"`
	Model     string    `gorm:"type:varchar(100)" json:"model"`
}

func (Request) TableName() string {
	return "requests"
}

func (Model) TableName() string {
	return "models"
}

func (CacheEntry) TableName() string {
	return "cache_entries"
}

// Conversation represents a multi-turn chat conversation
type Conversation struct {
	BaseModel
	Title      string    `gorm:"type:varchar(255);not null;default:'New Chat'" json:"title"`
	Model      string    `gorm:"type:varchar(100);not null;default:'gpt-3.5-turbo'" json:"model"`
	UserID     string    `gorm:"type:varchar(100);index" json:"user_id,omitempty"`
	MessageCnt int       `gorm:"not null;default:0" json:"message_count"`
	TotalTokens int      `gorm:"not null;default:0" json:"total_tokens"`
	TotalCost  float64   `gorm:"type:decimal(10,6);not null;default:0" json:"total_cost"`
	Messages   []Message `gorm:"foreignKey:ConversationID;constraint:OnDelete:CASCADE" json:"messages,omitempty"`
}

// Message represents a single message in a conversation
type Message struct {
	BaseModel
	ConversationID uuid.UUID `gorm:"type:uuid;not null;index" json:"conversation_id"`
	Role           string    `gorm:"type:varchar(20);not null" json:"role"` // user, assistant, system
	Content        string    `gorm:"type:text;not null" json:"content"`
	TokenCount     int       `gorm:"not null;default:0" json:"token_count"`
	Cost           float64   `gorm:"type:decimal(10,6);not null;default:0" json:"cost"`
	Model          string    `gorm:"type:varchar(100)" json:"model,omitempty"`
	Latency        int       `gorm:"not null;default:0" json:"latency"` // ms
}

func (Conversation) TableName() string {
	return "conversations"
}

func (Message) TableName() string {
	return "messages"
}
