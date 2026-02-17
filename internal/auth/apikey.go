package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

// APIKey represents an API key for programmatic access
type APIKey struct {
	ID          string     `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	UserID      string     `gorm:"index;not null" json:"user_id"`
	Name        string     `gorm:"not null" json:"name"`
	KeyPrefix   string     `gorm:"not null" json:"key_prefix"`             // First 8 chars for display (e.g., "vlm_a1b2...")
	KeyHash     string     `gorm:"unique;not null" json:"-"`               // SHA-256 hash of full key
	Scopes      string     `gorm:"default:'read,write'" json:"scopes"`     // Comma-separated: read, write, admin
	RateLimit   int        `gorm:"default:60" json:"rate_limit"`           // Requests per minute
	Active      bool       `gorm:"default:true" json:"active"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	LastUsedAt  *time.Time `json:"last_used_at,omitempty"`
	TotalCalls  int64      `gorm:"default:0" json:"total_calls"`
	TotalTokens int64      `gorm:"default:0" json:"total_tokens"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// TableName specifies the table name
func (APIKey) TableName() string {
	return "api_keys"
}

// APIKeyUsageLog tracks per-request usage for an API key
type APIKeyUsageLog struct {
	ID        string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	KeyID     string    `gorm:"index;not null" json:"key_id"`
	Endpoint  string    `json:"endpoint"`
	Model     string    `json:"model,omitempty"`
	Tokens    int       `json:"tokens"`
	Latency   int       `json:"latency_ms"`
	Status    int       `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

// TableName specifies the table name
func (APIKeyUsageLog) TableName() string {
	return "api_key_usage_logs"
}

// generateRandomKey creates a cryptographically secure random key
func generateRandomKey(length int) (string, error) {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// hashKey creates a SHA-256 hash of the key
func hashKey(key string) string {
	h := sha256.New()
	h.Write([]byte(key))
	return hex.EncodeToString(h.Sum(nil))
}

// CreateAPIKey generates a new API key for a user
// Returns the full key (only shown once) and the APIKey record
func (s *Service) CreateAPIKey(userID, name, scopes string, rateLimit int, expiresInDays int) (*APIKey, string, error) {
	// Generate random key: vlm_<32 hex chars>
	randomPart, err := generateRandomKey(24)
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate key: %w", err)
	}
	fullKey := "vlm_" + randomPart
	prefix := fullKey[:12] + "..."

	// Hash the key for storage
	keyHash := hashKey(fullKey)

	if scopes == "" {
		scopes = "read,write"
	}
	if rateLimit <= 0 {
		rateLimit = 60
	}

	apiKey := &APIKey{
		UserID:    userID,
		Name:      name,
		KeyPrefix: prefix,
		KeyHash:   keyHash,
		Scopes:    scopes,
		RateLimit: rateLimit,
		Active:    true,
	}

	if expiresInDays > 0 {
		exp := time.Now().AddDate(0, 0, expiresInDays)
		apiKey.ExpiresAt = &exp
	}

	if err := s.db.Create(apiKey).Error; err != nil {
		return nil, "", fmt.Errorf("failed to create API key: %w", err)
	}

	return apiKey, fullKey, nil
}

// ValidateAPIKey checks if an API key is valid and returns the associated key record
func (s *Service) ValidateAPIKey(rawKey string) (*APIKey, error) {
	keyHash := hashKey(rawKey)

	var apiKey APIKey
	if err := s.db.Where("key_hash = ?", keyHash).First(&apiKey).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("invalid API key")
		}
		return nil, err
	}

	if !apiKey.Active {
		return nil, fmt.Errorf("API key is revoked")
	}

	if apiKey.ExpiresAt != nil && apiKey.ExpiresAt.Before(time.Now()) {
		return nil, fmt.Errorf("API key has expired")
	}

	// Update last used
	now := time.Now()
	s.db.Model(&apiKey).Updates(map[string]interface{}{
		"last_used_at": now,
		"total_calls":  gorm.Expr("total_calls + 1"),
	})

	return &apiKey, nil
}

// ListAPIKeys returns all API keys for a user
func (s *Service) ListAPIKeys(userID string) ([]APIKey, error) {
	var keys []APIKey
	if err := s.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&keys).Error; err != nil {
		return nil, err
	}
	return keys, nil
}

// RevokeAPIKey deactivates an API key
func (s *Service) RevokeAPIKey(keyID, userID string) error {
	result := s.db.Model(&APIKey{}).Where("id = ? AND user_id = ?", keyID, userID).Update("active", false)
	if result.RowsAffected == 0 {
		return fmt.Errorf("API key not found")
	}
	return result.Error
}

// RotateAPIKey revokes the old key and creates a new one with the same settings
func (s *Service) RotateAPIKey(keyID, userID string) (*APIKey, string, error) {
	// Find existing key
	var oldKey APIKey
	if err := s.db.Where("id = ? AND user_id = ?", keyID, userID).First(&oldKey).Error; err != nil {
		return nil, "", fmt.Errorf("API key not found")
	}

	// Revoke old key
	s.db.Model(&oldKey).Update("active", false)

	// Calculate remaining expiry days
	expiresInDays := 0
	if oldKey.ExpiresAt != nil {
		remaining := time.Until(*oldKey.ExpiresAt)
		if remaining > 0 {
			expiresInDays = int(remaining.Hours() / 24)
		}
	}

	// Create new key with same settings
	return s.CreateAPIKey(userID, oldKey.Name+" (rotated)", oldKey.Scopes, oldKey.RateLimit, expiresInDays)
}

// DeleteAPIKey permanently deletes an API key
func (s *Service) DeleteAPIKey(keyID, userID string) error {
	// Delete usage logs first
	s.db.Where("key_id = ?", keyID).Delete(&APIKeyUsageLog{})
	result := s.db.Where("id = ? AND user_id = ?", keyID, userID).Delete(&APIKey{})
	if result.RowsAffected == 0 {
		return fmt.Errorf("API key not found")
	}
	return result.Error
}

// GetAPIKeyUsage returns usage logs for a specific key
func (s *Service) GetAPIKeyUsage(keyID string, limit int) ([]APIKeyUsageLog, error) {
	var logs []APIKeyUsageLog
	if limit <= 0 {
		limit = 50
	}
	if err := s.db.Where("key_id = ?", keyID).Order("created_at DESC").Limit(limit).Find(&logs).Error; err != nil {
		return nil, err
	}
	return logs, nil
}

// GetAPIKeyStats returns aggregated stats for a key
func (s *Service) GetAPIKeyStats(keyID string) (map[string]interface{}, error) {
	var key APIKey
	if err := s.db.Where("id = ?", keyID).First(&key).Error; err != nil {
		return nil, err
	}

	var totalLogs int64
	s.db.Model(&APIKeyUsageLog{}).Where("key_id = ?", keyID).Count(&totalLogs)

	var callsToday int64
	s.db.Model(&APIKeyUsageLog{}).Where("key_id = ? AND created_at > ?", keyID, time.Now().Truncate(24*time.Hour)).Count(&callsToday)

	// Avg latency
	var avgLatency float64
	s.db.Model(&APIKeyUsageLog{}).Where("key_id = ?", keyID).Select("COALESCE(AVG(latency), 0)").Scan(&avgLatency)

	return map[string]interface{}{
		"key_id":       keyID,
		"name":         key.Name,
		"total_calls":  key.TotalCalls,
		"total_tokens": key.TotalTokens,
		"calls_today":  callsToday,
		"avg_latency":  avgLatency,
		"active":       key.Active,
		"created_at":   key.CreatedAt,
		"last_used_at": key.LastUsedAt,
		"expires_at":   key.ExpiresAt,
	}, nil
}

// HasScope checks if an API key has a specific scope
func (k *APIKey) HasScope(scope string) bool {
	scopes := strings.Split(k.Scopes, ",")
	for _, s := range scopes {
		if strings.TrimSpace(s) == scope || strings.TrimSpace(s) == "admin" {
			return true
		}
	}
	return false
}

// AutoMigrateAPIKeys runs migrations for API key tables
func (s *Service) AutoMigrateAPIKeys() error {
	return s.db.AutoMigrate(&APIKey{}, &APIKeyUsageLog{})
}
