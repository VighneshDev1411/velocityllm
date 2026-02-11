package cache

import (
	"context"
	"sync"
	"time"
)

// MemoryCacheEntry represents a cached item with expiration
type MemoryCacheEntry struct {
	Value      interface{}
	ExpiresAt  time.Time
	AccessedAt time.Time
	HitCount   int64
}

// MemoryCache is an in-memory L1 cache with LRU eviction
type MemoryCache struct {
	mu         sync.RWMutex
	data       map[string]*MemoryCacheEntry
	maxSize    int
	maxMemory  int64 // bytes
	currentMem int64
	hits       int64
	misses     int64
	evictions  int64
}

// NewMemoryCache creates a new in-memory cache
func NewMemoryCache(maxSize int, maxMemoryMB int) *MemoryCache {
	return &MemoryCache{
		data:      make(map[string]*MemoryCacheEntry),
		maxSize:   maxSize,
		maxMemory: int64(maxMemoryMB) * 1024 * 1024, // Convert MB to bytes
	}
}

// Set stores a value in memory cache
func (mc *MemoryCache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	// Evict if at capacity
	if len(mc.data) >= mc.maxSize {
		mc.evictLRU()
	}

	entry := &MemoryCacheEntry{
		Value:      value,
		ExpiresAt:  time.Now().Add(ttl),
		AccessedAt: time.Now(),
		HitCount:   0,
	}

	mc.data[key] = entry
	return nil
}

// Get retrieves a value from memory cache
func (mc *MemoryCache) Get(ctx context.Context, key string) (interface{}, bool) {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	entry, exists := mc.data[key]
	if !exists {
		mc.misses++
		return nil, false
	}

	// Check expiration
	if time.Now().After(entry.ExpiresAt) {
		delete(mc.data, key)
		mc.misses++
		mc.evictions++
		return nil, false
	}

	// Update access time and hit count
	entry.AccessedAt = time.Now()
	entry.HitCount++
	mc.hits++

	return entry.Value, true
}

// Delete removes a key from memory cache
func (mc *MemoryCache) Delete(ctx context.Context, key string) error {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	delete(mc.data, key)
	return nil
}

// Clear removes all entries
func (mc *MemoryCache) Clear(ctx context.Context) error {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	mc.data = make(map[string]*MemoryCacheEntry)
	mc.currentMem = 0
	return nil
}

// evictLRU removes the least recently used entry
func (mc *MemoryCache) evictLRU() {
	var oldestKey string
	var oldestTime time.Time

	for key, entry := range mc.data {
		if oldestTime.IsZero() || entry.AccessedAt.Before(oldestTime) {
			oldestKey = key
			oldestTime = entry.AccessedAt
		}
	}

	if oldestKey != "" {
		delete(mc.data, oldestKey)
		mc.evictions++
	}
}

// CleanExpired removes all expired entries
func (mc *MemoryCache) CleanExpired() int {
	mc.mu.Lock()
	defer mc.mu.Unlock()

	now := time.Now()
	removed := 0

	for key, entry := range mc.data {
		if now.After(entry.ExpiresAt) {
			delete(mc.data, key)
			removed++
			mc.evictions++
		}
	}

	return removed
}

// Stats returns cache statistics
func (mc *MemoryCache) Stats() MemoryCacheStats {
	mc.mu.RLock()
	defer mc.mu.RUnlock()

	totalRequests := mc.hits + mc.misses
	hitRate := float64(0)
	if totalRequests > 0 {
		hitRate = float64(mc.hits) / float64(totalRequests)
	}

	return MemoryCacheStats{
		Size:       len(mc.data),
		MaxSize:    mc.maxSize,
		Hits:       mc.hits,
		Misses:     mc.misses,
		Evictions:  mc.evictions,
		HitRate:    hitRate,
		MemoryUsed: mc.currentMem,
		MaxMemory:  mc.maxMemory,
	}
}

// MemoryCacheStats represents memory cache statistics
type MemoryCacheStats struct {
	Size       int     `json:"size"`
	MaxSize    int     `json:"max_size"`
	Hits       int64   `json:"hits"`
	Misses     int64   `json:"misses"`
	Evictions  int64   `json:"evictions"`
	HitRate    float64 `json:"hit_rate"`
	MemoryUsed int64   `json:"memory_used_bytes"`
	MaxMemory  int64   `json:"max_memory_bytes"`
}
