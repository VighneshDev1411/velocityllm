package database

import (
	"fmt"

	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ChatRepository struct {
	db *gorm.DB
}

func NewChatRepository() *ChatRepository {
	return &ChatRepository{db: DB}
}

// ── Conversations ───────────────────────────────────────────────────────────

func (r *ChatRepository) CreateConversation(conv *types.Conversation) error {
	return r.db.Create(conv).Error
}

func (r *ChatRepository) GetConversation(id uuid.UUID) (*types.Conversation, error) {
	var conv types.Conversation
	err := r.db.Preload("Messages", func(db *gorm.DB) *gorm.DB {
		return db.Order("created_at ASC")
	}).First(&conv, "id = ?", id).Error
	return &conv, err
}

func (r *ChatRepository) ListConversations(userID string, limit, offset int) ([]types.Conversation, int64, error) {
	var convs []types.Conversation
	var total int64

	q := r.db.Model(&types.Conversation{})
	if userID != "" {
		q = q.Where("user_id = ?", userID)
	}
	q.Count(&total)

	err := q.Order("updated_at DESC").Limit(limit).Offset(offset).Find(&convs).Error
	return convs, total, err
}

func (r *ChatRepository) UpdateConversation(id uuid.UUID, updates map[string]interface{}) error {
	return r.db.Model(&types.Conversation{}).Where("id = ?", id).Updates(updates).Error
}

func (r *ChatRepository) DeleteConversation(id uuid.UUID) error {
	// Messages deleted via CASCADE
	return r.db.Where("id = ?", id).Delete(&types.Conversation{}).Error
}

// ── Messages ────────────────────────────────────────────────────────────────

func (r *ChatRepository) AddMessage(msg *types.Message) error {
	if err := r.db.Create(msg).Error; err != nil {
		return err
	}
	// Update conversation counters
	return r.db.Model(&types.Conversation{}).Where("id = ?", msg.ConversationID).
		UpdateColumns(map[string]interface{}{
			"message_cnt":  gorm.Expr("message_cnt + 1"),
			"total_tokens": gorm.Expr("total_tokens + ?", msg.TokenCount),
			"total_cost":   gorm.Expr("total_cost + ?", msg.Cost),
			"updated_at":   gorm.Expr("NOW()"),
		}).Error
}

func (r *ChatRepository) GetMessages(conversationID uuid.UUID, limit int) ([]types.Message, error) {
	var msgs []types.Message
	q := r.db.Where("conversation_id = ?", conversationID).Order("created_at ASC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	err := q.Find(&msgs).Error
	return msgs, err
}

func (r *ChatRepository) UpdateMessage(id uuid.UUID, content string) error {
	return r.db.Model(&types.Message{}).Where("id = ?", id).Update("content", content).Error
}

func (r *ChatRepository) DeleteMessage(id uuid.UUID) error {
	return r.db.Where("id = ?", id).Delete(&types.Message{}).Error
}

// GetConversationStats returns aggregate stats
func (r *ChatRepository) GetConversationStats() (map[string]interface{}, error) {
	var totalConvs int64
	var totalMsgs int64

	r.db.Model(&types.Conversation{}).Count(&totalConvs)
	r.db.Model(&types.Message{}).Count(&totalMsgs)

	var totalTokens, totalCost struct {
		Val float64
	}
	r.db.Model(&types.Conversation{}).Select("COALESCE(SUM(total_tokens),0) as val").Scan(&totalTokens)
	r.db.Model(&types.Conversation{}).Select("COALESCE(SUM(total_cost),0) as val").Scan(&totalCost)

	return map[string]interface{}{
		"total_conversations": totalConvs,
		"total_messages":      totalMsgs,
		"total_tokens":        int64(totalTokens.Val),
		"total_cost":          fmt.Sprintf("%.4f", totalCost.Val),
	}, nil
}
