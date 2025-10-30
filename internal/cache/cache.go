package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// CacheService handles caching operations
type CacheService struct {
	defaultTTL time.Duration
}

// NewCacheService creates a new cache service instance
func NewCacheService(defaultTTL time.Duration) *CacheService {
	return &CacheService{
		defaultTTL: defaultTTL,
	}
}

// GenerateKey creates a cache key from a prompt
func (s *CacheService) GenerateKey(prompt string, model string) string {
	// Create a unique key by hashing prompt + model
	data := fmt.Sprintf("%s:%s", model, prompt)
	hash := sha256.Sum256([]byte(data))
	return "cache:" + hex.EncodeToString(hash[:])
}

// Set stores a value in cache
func (s *CacheService) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	if RedisClient == nil {
		return fmt.Errorf("redis not connected")
	}

	// Use default TTL if not specified
	if ttl == 0 {
		ttl = s.defaultTTL
	}

	// Serialize value to JSON
	jsonData, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("failed to marshal value: %w", err)
	}

	// Store in Redis
	err = RedisClient.Set(ctx, key, jsonData, ttl).Err()
	if err != nil {
		return fmt.Errorf("failed to set cache: %w", err)
	}

	utils.Debug("Cache SET: key=%s, ttl=%v", key, ttl)
	return nil
}

// Get retrieves a value from cache
func (s *CacheService) Get(ctx context.Context, key string, dest interface{}) (bool, error) {
	if RedisClient == nil {
		return false, fmt.Errorf("redis not connected")
	}

	// Get from Redis
	jsonData, err := RedisClient.Get(ctx, key).Result()
	if err != nil {
		// Key not found (cache miss)
		if err.Error() == "redis: nil" {
			utils.Debug("Cache MISS: key=%s", key)
			return false, nil
		}
		return false, fmt.Errorf("failed to get cache: %w", err)
	}

	// Deserialize JSON to destination
	if err := json.Unmarshal([]byte(jsonData), dest); err != nil {
		return false, fmt.Errorf("failed to unmarshal value: %w", err)
	}

	utils.Debug("Cache HIT: key=%s", key)
	return true, nil
}

// Delete removes a key from cache
func (s *CacheService) Delete(ctx context.Context, key string) error {
	if RedisClient == nil {
		return fmt.Errorf("redis not connected")
	}

	err := RedisClient.Del(ctx, key).Err()
	if err != nil {
		return fmt.Errorf("failed to delete cache: %w", err)
	}

	utils.Debug("Cache DELETE: key=%s", key)
	return nil
}

// Exists checks if a key exists in cache
func (s *CacheService) Exists(ctx context.Context, key string) (bool, error) {
	if RedisClient == nil {
		return false, fmt.Errorf("redis not connected")
	}

	count, err := RedisClient.Exists(ctx, key).Result()
	if err != nil {
		return false, err
	}

	return count > 0, nil
}

// GetTTL returns the remaining time to live for a key
func (s *CacheService) GetTTL(ctx context.Context, key string) (time.Duration, error) {
	if RedisClient == nil {
		return 0, fmt.Errorf("redis not connected")
	}

	ttl, err := RedisClient.TTL(ctx, key).Result()
	if err != nil {
		return 0, err
	}

	return ttl, nil
}

// SetWithExpiry stores a value with custom expiration
func (s *CacheService) SetWithExpiry(ctx context.Context, key string, value interface{}, expiryTime time.Time) error {
	ttl := time.Until(expiryTime)
	if ttl <= 0 {
		return fmt.Errorf("expiry time must be in the future")
	}

	return s.Set(ctx, key, value, ttl)
}

// Increment increments a counter in cache
func (s *CacheService) Increment(ctx context.Context, key string) (int64, error) {
	if RedisClient == nil {
		return 0, fmt.Errorf("redis not connected")
	}

	val, err := RedisClient.Incr(ctx, key).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to increment: %w", err)
	}

	return val, nil
}

// GetMultiple retrieves multiple keys at once
func (s *CacheService) GetMultiple(ctx context.Context, keys []string) (map[string]string, error) {
	if RedisClient == nil {
		return nil, fmt.Errorf("redis not connected")
	}

	if len(keys) == 0 {
		return make(map[string]string), nil
	}

	// Get all keys at once using MGET
	values, err := RedisClient.MGet(ctx, keys...).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get multiple keys: %w", err)
	}

	// Build result map
	result := make(map[string]string)
	for i, key := range keys {
		if values[i] != nil {
			result[key] = values[i].(string)
		}
	}

	return result, nil
}

// Clear removes all keys matching a pattern
func (s *CacheService) Clear(ctx context.Context, pattern string) (int64, error) {
	if RedisClient == nil {
		return 0, fmt.Errorf("redis not connected")
	}

	// Find all keys matching pattern
	keys, err := RedisClient.Keys(ctx, pattern).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to find keys: %w", err)
	}

	if len(keys) == 0 {
		return 0, nil
	}

	// Delete all matching keys
	deleted, err := RedisClient.Del(ctx, keys...).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to delete keys: %w", err)
	}

	utils.Info("Cache CLEAR: pattern=%s, deleted=%d", pattern, deleted)
	return deleted, nil
}
