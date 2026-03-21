package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// TaggedCache provides tag-based cache invalidation on top of CacheService
type TaggedCache struct {
	cache *CacheService
}

// NewTaggedCache creates a new tag-aware cache wrapper
func NewTaggedCache(cache *CacheService) *TaggedCache {
	return &TaggedCache{cache: cache}
}

// SetWithTags stores a value and associates it with tags for group invalidation
func (tc *TaggedCache) SetWithTags(ctx context.Context, key string, value interface{}, ttl time.Duration, tags []string) error {
	if RedisClient == nil {
		return fmt.Errorf("redis not connected")
	}

	// Store the actual value
	if err := tc.cache.Set(ctx, key, value, ttl); err != nil {
		return err
	}

	// Add key to each tag set
	for _, tag := range tags {
		tagKey := "tag:" + tag
		if err := RedisClient.SAdd(ctx, tagKey, key).Err(); err != nil {
			utils.Error("Failed to add key to tag set", "tag", tag, "key", key, "error", err)
			continue
		}
		// Set TTL on the tag set too (slightly longer than value TTL)
		RedisClient.Expire(ctx, tagKey, ttl+5*time.Minute)
	}

	// Also store the tags for this key (for introspection)
	tagsKey := "tags:" + key
	RedisClient.SAdd(ctx, tagsKey, tagsToInterfaces(tags)...)
	RedisClient.Expire(ctx, tagsKey, ttl+5*time.Minute)

	utils.Debug("Cache SET with tags: key=%s, tags=%v, ttl=%v", key, tags, ttl)
	return nil
}

// InvalidateByTag deletes all cache entries associated with a tag
func (tc *TaggedCache) InvalidateByTag(ctx context.Context, tag string) (int64, error) {
	if RedisClient == nil {
		return 0, fmt.Errorf("redis not connected")
	}

	tagKey := "tag:" + tag

	// Get all keys in this tag set
	keys, err := RedisClient.SMembers(ctx, tagKey).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to get tag members: %w", err)
	}

	if len(keys) == 0 {
		return 0, nil
	}

	// Delete all cached values
	deleted, err := RedisClient.Del(ctx, keys...).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to delete tagged keys: %w", err)
	}

	// Clean up tags-for-key entries
	for _, key := range keys {
		RedisClient.Del(ctx, "tags:"+key)
	}

	// Delete the tag set itself
	RedisClient.Del(ctx, tagKey)

	utils.Info("Cache INVALIDATE by tag: tag=%s, deleted=%d", tag, deleted)
	return deleted, nil
}

// InvalidateByTags invalidates multiple tags at once
func (tc *TaggedCache) InvalidateByTags(ctx context.Context, tags []string) (int64, error) {
	var totalDeleted int64
	for _, tag := range tags {
		deleted, err := tc.InvalidateByTag(ctx, tag)
		if err != nil {
			utils.Error("Failed to invalidate tag", "tag", tag, "error", err)
			continue
		}
		totalDeleted += deleted
	}
	return totalDeleted, nil
}

// GetTags returns all tags associated with a cache key
func (tc *TaggedCache) GetTags(ctx context.Context, key string) ([]string, error) {
	if RedisClient == nil {
		return nil, fmt.Errorf("redis not connected")
	}

	tagsKey := "tags:" + key
	tags, err := RedisClient.SMembers(ctx, tagsKey).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get tags: %w", err)
	}

	return tags, nil
}

// GetTagMembers returns all cache keys in a tag group
func (tc *TaggedCache) GetTagMembers(ctx context.Context, tag string) ([]string, error) {
	if RedisClient == nil {
		return nil, fmt.Errorf("redis not connected")
	}

	tagKey := "tag:" + tag
	return RedisClient.SMembers(ctx, tagKey).Result()
}

func tagsToInterfaces(tags []string) []interface{} {
	result := make([]interface{}, len(tags))
	for i, t := range tags {
		result[i] = t
	}
	return result
}

// Global tagged cache instance
var globalTaggedCache *TaggedCache

// InitGlobalTaggedCache initializes the global tagged cache
func InitGlobalTaggedCache() *TaggedCache {
	globalTaggedCache = NewTaggedCache(NewCacheService(30 * time.Minute))
	return globalTaggedCache
}

// GetGlobalTaggedCache returns the global tagged cache
func GetGlobalTaggedCache() *TaggedCache {
	return globalTaggedCache
}
