package cache

import (
	"context"
	"encoding/json"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// MultiLevelCache implements L1 (memory) + L2 (Redis) caching
type MultiLevelCache struct {
	l1Cache    *MemoryCache
	l2Cache    *CacheService
	l1TTL      time.Duration
	l2TTL      time.Duration
	writeThru  bool // Write to both levels simultaneously
	stats      *CacheAnalytics
}

// MultiLevelCacheConfig configures the multi-level cache
type MultiLevelCacheConfig struct {
	L1MaxSize      int           // Max entries in L1
	L1MaxMemoryMB  int           // Max memory for L1 in MB
	L1TTL          time.Duration // L1 expiration time
	L2TTL          time.Duration // L2 expiration time
	WriteThrough   bool          // Write to both levels
	EnableAnalytics bool          // Track detailed analytics
}

// NewMultiLevelCache creates a new multi-level cache
func NewMultiLevelCache(config MultiLevelCacheConfig) *MultiLevelCache {
	mlc := &MultiLevelCache{
		l1Cache:   NewMemoryCache(config.L1MaxSize, config.L1MaxMemoryMB),
		l2Cache:   NewCacheService(config.L2TTL),
		l1TTL:     config.L1TTL,
		l2TTL:     config.L2TTL,
		writeThru: config.WriteThrough,
	}

	if config.EnableAnalytics {
		mlc.stats = NewCacheAnalytics()
	}

	// Start background cleanup
	go mlc.backgroundCleanup()

	return mlc
}

// Get retrieves a value, checking L1 first, then L2
func (mlc *MultiLevelCache) Get(ctx context.Context, key string, dest interface{}) (bool, CacheLevel, error) {
	start := time.Now()

	// Try L1 (memory) first
	if value, found := mlc.l1Cache.Get(ctx, key); found {
		// Type assert and copy to destination
		if jsonStr, ok := value.(string); ok {
			if err := json.Unmarshal([]byte(jsonStr), dest); err == nil {
				if mlc.stats != nil {
					mlc.stats.RecordHit(L1, time.Since(start))
				}
				utils.Debug("Cache HIT [L1]: key=%s, latency=%v", key, time.Since(start))
				return true, L1, nil
			}
		}
	}

	// L1 miss, try L2 (Redis)
	found, err := mlc.l2Cache.Get(ctx, key, dest)
	if err != nil {
		if mlc.stats != nil {
			mlc.stats.RecordMiss(L2, time.Since(start))
		}
		return false, L2, err
	}

	if found {
		// Populate L1 with L2 data (promotion)
		jsonData, _ := json.Marshal(dest)
		mlc.l1Cache.Set(ctx, key, string(jsonData), mlc.l1TTL)

		if mlc.stats != nil {
			mlc.stats.RecordHit(L2, time.Since(start))
		}
		utils.Debug("Cache HIT [L2]: key=%s, latency=%v, promoted to L1", key, time.Since(start))
		return true, L2, nil
	}

	// Cache miss on both levels
	if mlc.stats != nil {
		mlc.stats.RecordMiss(L2, time.Since(start))
	}
	utils.Debug("Cache MISS [L1+L2]: key=%s, latency=%v", key, time.Since(start))
	return false, L2, nil
}

// Set stores a value in the cache
func (mlc *MultiLevelCache) Set(ctx context.Context, key string, value interface{}) error {
	start := time.Now()

	// Serialize value
	jsonData, err := json.Marshal(value)
	if err != nil {
		return err
	}
	jsonStr := string(jsonData)

	// Write-through: Write to both levels
	if mlc.writeThru {
		// Set in L1
		if err := mlc.l1Cache.Set(ctx, key, jsonStr, mlc.l1TTL); err != nil {
			utils.Error("Failed to set L1 cache", "key", key, "error", err)
		}

		// Set in L2
		if err := mlc.l2Cache.Set(ctx, key, value, mlc.l2TTL); err != nil {
			utils.Error("Failed to set L2 cache", "key", key, "error", err)
			return err
		}

		if mlc.stats != nil {
			mlc.stats.RecordWrite(time.Since(start))
		}
		utils.Debug("Cache SET [L1+L2]: key=%s, latency=%v", key, time.Since(start))
	} else {
		// Write-behind: Write to L1 only, L2 populated on eviction
		if err := mlc.l1Cache.Set(ctx, key, jsonStr, mlc.l1TTL); err != nil {
			return err
		}
		utils.Debug("Cache SET [L1]: key=%s, latency=%v", key, time.Since(start))
	}

	return nil
}

// Delete removes a key from all cache levels
func (mlc *MultiLevelCache) Delete(ctx context.Context, key string) error {
	mlc.l1Cache.Delete(ctx, key)
	return mlc.l2Cache.Delete(ctx, key)
}

// Clear removes all entries from both levels
func (mlc *MultiLevelCache) Clear(ctx context.Context, pattern string) error {
	mlc.l1Cache.Clear(ctx)
	_, err := mlc.l2Cache.Clear(ctx, pattern)
	return err
}

// Warm preloads cache with common queries
func (mlc *MultiLevelCache) Warm(ctx context.Context, entries map[string]interface{}) error {
	utils.Info("Starting cache warming", "entries", len(entries))

	for key, value := range entries {
		if err := mlc.Set(ctx, key, value); err != nil {
			utils.Error("Failed to warm cache entry", "key", key, "error", err)
			continue
		}
	}

	utils.Info("Cache warming completed", "entries", len(entries))
	return nil
}

// GetStats returns statistics from all cache levels
func (mlc *MultiLevelCache) GetStats() MultiLevelCacheStats {
	l1Stats := mlc.l1Cache.Stats()

	var analyticsStats *AnalyticsStats
	if mlc.stats != nil {
		analyticsStats = mlc.stats.GetStats()
	}

	return MultiLevelCacheStats{
		L1:        l1Stats,
		Analytics: analyticsStats,
	}
}

// backgroundCleanup periodically removes expired entries
func (mlc *MultiLevelCache) backgroundCleanup() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		removed := mlc.l1Cache.CleanExpired()
		if removed > 0 {
			utils.Debug("Cleaned expired L1 entries", "count", removed)
		}
	}
}

// CacheLevel represents which cache level was hit
type CacheLevel string

const (
	L1 CacheLevel = "L1"
	L2 CacheLevel = "L2"
)

// MultiLevelCacheStats combines statistics from all levels
type MultiLevelCacheStats struct {
	L1        MemoryCacheStats `json:"l1_memory"`
	Analytics *AnalyticsStats  `json:"analytics,omitempty"`
}
