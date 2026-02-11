package cache

import (
	"context"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// GlobalCacheManager manages all cache layers
var (
	globalManager *CacheManager
	managerOnce   sync.Once
)

// CacheManager coordinates all caching layers
type CacheManager struct {
	multiLevel *MultiLevelCache
	semantic   *SemanticCache
	legacy     *CacheService // Old single-level cache
	config     CacheManagerConfig
}

// CacheManagerConfig configures the cache manager
type CacheManagerConfig struct {
	// Multi-level cache
	EnableMultiLevel bool
	L1MaxSize        int
	L1MaxMemoryMB    int
	L1TTL            time.Duration
	L2TTL            time.Duration
	WriteThrough     bool

	// Semantic cache
	EnableSemantic       bool
	SemanticThreshold    float64
	SemanticMaxEntries   int
	SemanticEmbeddingDim int

	// Analytics
	EnableAnalytics bool

	// Legacy compatibility
	LegacyTTL time.Duration
}

// InitGlobalCacheManager initializes the global cache manager
func InitGlobalCacheManager(config CacheManagerConfig) *CacheManager {
	managerOnce.Do(func() {
		globalManager = &CacheManager{
			config: config,
		}

		// Initialize legacy cache for backward compatibility
		globalManager.legacy = NewCacheService(config.LegacyTTL)

		// Initialize multi-level cache
		if config.EnableMultiLevel {
			mlConfig := MultiLevelCacheConfig{
				L1MaxSize:       config.L1MaxSize,
				L1MaxMemoryMB:   config.L1MaxMemoryMB,
				L1TTL:           config.L1TTL,
				L2TTL:           config.L2TTL,
				WriteThrough:    config.WriteThrough,
				EnableAnalytics: config.EnableAnalytics,
			}
			globalManager.multiLevel = NewMultiLevelCache(mlConfig)
			utils.Info("Multi-level cache initialized",
				"l1_max_size", config.L1MaxSize,
				"l1_max_memory_mb", config.L1MaxMemoryMB,
				"l1_ttl", config.L1TTL,
				"l2_ttl", config.L2TTL,
			)
		}

		// Initialize semantic cache
		if config.EnableSemantic && globalManager.multiLevel != nil {
			semConfig := SemanticCacheConfig{
				BackingCache:        globalManager.multiLevel,
				SimilarityThreshold: config.SemanticThreshold,
				MaxEntries:          config.SemanticMaxEntries,
				EmbeddingDimension:  config.SemanticEmbeddingDim,
			}
			globalManager.semantic = NewSemanticCache(semConfig)
			utils.Info("Semantic cache initialized",
				"threshold", config.SemanticThreshold,
				"max_entries", config.SemanticMaxEntries,
			)
		}

		utils.Info("Cache manager initialized successfully",
			"multi_level", config.EnableMultiLevel,
			"semantic", config.EnableSemantic,
			"analytics", config.EnableAnalytics,
		)
	})

	return globalManager
}

// GetGlobalCacheManager returns the global cache manager
func GetGlobalCacheManager() *CacheManager {
	return globalManager
}

// Get retrieves a value using the best available cache strategy
func (cm *CacheManager) Get(ctx context.Context, key string, dest interface{}) (bool, string, error) {
	// Try multi-level cache first
	if cm.multiLevel != nil {
		found, level, err := cm.multiLevel.Get(ctx, key, dest)
		if err != nil {
			return false, "", err
		}
		if found {
			return true, string(level), nil
		}
	}

	// Fallback to legacy cache
	if cm.legacy != nil {
		found, err := cm.legacy.Get(ctx, key, dest)
		return found, "legacy", err
	}

	return false, "", nil
}

// GetSemantic retrieves using semantic similarity
func (cm *CacheManager) GetSemantic(ctx context.Context, prompt, model string, dest interface{}) (bool, float64, error) {
	if cm.semantic == nil {
		return false, 0, nil
	}
	return cm.semantic.Get(ctx, prompt, model, dest)
}

// Set stores a value in all appropriate cache levels
func (cm *CacheManager) Set(ctx context.Context, key string, value interface{}) error {
	// Store in multi-level cache
	if cm.multiLevel != nil {
		return cm.multiLevel.Set(ctx, key, value)
	}

	// Fallback to legacy cache
	if cm.legacy != nil {
		return cm.legacy.Set(ctx, key, value, cm.config.LegacyTTL)
	}

	return nil
}

// SetSemantic stores with semantic embedding
func (cm *CacheManager) SetSemantic(ctx context.Context, prompt, model string, value interface{}) error {
	if cm.semantic == nil {
		// Fallback to regular set
		key := cm.legacy.GenerateKey(prompt, model)
		return cm.Set(ctx, key, value)
	}
	return cm.semantic.Set(ctx, prompt, model, value)
}

// Delete removes from all cache levels
func (cm *CacheManager) Delete(ctx context.Context, key string) error {
	if cm.multiLevel != nil {
		return cm.multiLevel.Delete(ctx, key)
	}
	if cm.legacy != nil {
		return cm.legacy.Delete(ctx, key)
	}
	return nil
}

// Clear clears all cache levels
func (cm *CacheManager) Clear(ctx context.Context, pattern string) error {
	if cm.multiLevel != nil {
		return cm.multiLevel.Clear(ctx, pattern)
	}
	if cm.legacy != nil {
		_, err := cm.legacy.Clear(ctx, pattern)
		return err
	}
	return nil
}

// Warm preloads cache with common data
func (cm *CacheManager) Warm(ctx context.Context, entries map[string]interface{}) error {
	if cm.multiLevel != nil {
		return cm.multiLevel.Warm(ctx, entries)
	}
	return nil
}

// GetStats returns comprehensive cache statistics
func (cm *CacheManager) GetStats() CacheManagerStats {
	stats := CacheManagerStats{
		Config: cm.config,
	}

	if cm.multiLevel != nil {
		mlStats := cm.multiLevel.GetStats()
		stats.MultiLevel = &mlStats
	}

	if cm.semantic != nil {
		semStats := cm.semantic.GetStats()
		stats.Semantic = &semStats
	}

	return stats
}

// CacheManagerStats represents comprehensive cache statistics
type CacheManagerStats struct {
	Config     CacheManagerConfig    `json:"config"`
	MultiLevel *MultiLevelCacheStats `json:"multi_level,omitempty"`
	Semantic   *SemanticCacheStats   `json:"semantic,omitempty"`
}
