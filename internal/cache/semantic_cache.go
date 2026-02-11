package cache

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// SemanticCache implements embedding-based semantic similarity caching
type SemanticCache struct {
	mu                sync.RWMutex
	embeddings        map[string]*EmbeddingEntry
	backingCache      *MultiLevelCache
	similarityThreshold float64
	maxEntries        int
	embeddingDim      int
}

// EmbeddingEntry represents a cached prompt with its embedding
type EmbeddingEntry struct {
	Prompt     string    `json:"prompt"`
	Embedding  []float64 `json:"embedding"`
	CacheKey   string    `json:"cache_key"`
	CreatedAt  time.Time `json:"created_at"`
	AccessedAt time.Time `json:"accessed_at"`
	HitCount   int64     `json:"hit_count"`
}

// SemanticCacheConfig configures the semantic cache
type SemanticCacheConfig struct {
	BackingCache        *MultiLevelCache
	SimilarityThreshold float64 // 0.0 to 1.0, higher = more similar required
	MaxEntries          int
	EmbeddingDimension  int
}

// NewSemanticCache creates a new semantic cache
func NewSemanticCache(config SemanticCacheConfig) *SemanticCache {
	if config.SimilarityThreshold == 0 {
		config.SimilarityThreshold = 0.85 // Default 85% similarity
	}
	if config.MaxEntries == 0 {
		config.MaxEntries = 10000
	}
	if config.EmbeddingDimension == 0 {
		config.EmbeddingDimension = 384 // Default for all-MiniLM-L6-v2
	}

	return &SemanticCache{
		embeddings:          make(map[string]*EmbeddingEntry),
		backingCache:        config.BackingCache,
		similarityThreshold: config.SimilarityThreshold,
		maxEntries:          config.MaxEntries,
		embeddingDim:        config.EmbeddingDimension,
	}
}

// Get retrieves a cached value using semantic similarity
func (sc *SemanticCache) Get(ctx context.Context, prompt string, model string, dest interface{}) (bool, float64, error) {
	start := time.Now()

	// Generate embedding for input prompt
	embedding := sc.generateEmbedding(prompt)

	// Find most similar cached prompt
	similarEntry, similarity := sc.findMostSimilar(embedding)

	if similarEntry != nil && similarity >= sc.similarityThreshold {
		// Found similar prompt, retrieve from backing cache
		found, _, err := sc.backingCache.Get(ctx, similarEntry.CacheKey, dest)
		if err != nil {
			return false, similarity, err
		}

		if found {
			// Update access stats
			sc.mu.Lock()
			similarEntry.AccessedAt = time.Now()
			similarEntry.HitCount++
			sc.mu.Unlock()

			utils.Info(
				"Semantic cache HIT",
				"similarity", similarity,
				"original_prompt", similarEntry.Prompt,
				"query_prompt", prompt,
				"latency_ms", time.Since(start).Milliseconds(),
			)
			return true, similarity, nil
		}
	}

	utils.Debug(
		"Semantic cache MISS",
		"best_similarity", similarity,
		"threshold", sc.similarityThreshold,
		"latency_ms", time.Since(start).Milliseconds(),
	)
	return false, similarity, nil
}

// Set stores a value with its semantic embedding
func (sc *SemanticCache) Set(ctx context.Context, prompt string, model string, value interface{}) error {
	// Generate cache key
	cacheKey := sc.generateCacheKey(prompt, model)

	// Store in backing cache
	if err := sc.backingCache.Set(ctx, cacheKey, value); err != nil {
		return err
	}

	// Generate and store embedding
	embedding := sc.generateEmbedding(prompt)

	sc.mu.Lock()
	defer sc.mu.Unlock()

	// Check if we need to evict old entries
	if len(sc.embeddings) >= sc.maxEntries {
		sc.evictOldest()
	}

	entry := &EmbeddingEntry{
		Prompt:     prompt,
		Embedding:  embedding,
		CacheKey:   cacheKey,
		CreatedAt:  time.Now(),
		AccessedAt: time.Now(),
		HitCount:   0,
	}

	sc.embeddings[cacheKey] = entry

	utils.Debug("Semantic cache SET", "prompt_length", len(prompt), "cache_key", cacheKey[:16])
	return nil
}

// generateEmbedding creates a simple embedding vector for a prompt
// In production, this should use a real embedding model (e.g., sentence-transformers)
func (sc *SemanticCache) generateEmbedding(text string) []float64 {
	// Simple embedding: character frequency distribution + length features
	// This is a placeholder - use a real embedding model in production
	embedding := make([]float64, sc.embeddingDim)

	// Character frequency (first 256 dimensions)
	charFreq := make(map[rune]int)
	for _, char := range text {
		charFreq[char]++
	}

	idx := 0
	for char := rune(0); char < 256 && idx < 256; char++ {
		if count, exists := charFreq[char]; exists {
			embedding[idx] = float64(count) / float64(len(text))
		}
		idx++
	}

	// Length features (next dimensions)
	if idx < sc.embeddingDim {
		embedding[idx] = math.Log(float64(len(text) + 1))
		idx++
	}
	if idx < sc.embeddingDim {
		embedding[idx] = float64(len(text)) / 1000.0 // Normalized length
		idx++
	}

	// Word count feature
	if idx < sc.embeddingDim {
		wordCount := len([]rune(text)) // Simplified word count
		embedding[idx] = float64(wordCount) / 100.0
		idx++
	}

	// Normalize embedding
	return sc.normalizeVector(embedding)
}

// findMostSimilar finds the most similar cached embedding
func (sc *SemanticCache) findMostSimilar(queryEmbedding []float64) (*EmbeddingEntry, float64) {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	var bestEntry *EmbeddingEntry
	var bestSimilarity float64 = 0.0

	for _, entry := range sc.embeddings {
		similarity := sc.cosineSimilarity(queryEmbedding, entry.Embedding)
		if similarity > bestSimilarity {
			bestSimilarity = similarity
			bestEntry = entry
		}
	}

	return bestEntry, bestSimilarity
}

// cosineSimilarity calculates cosine similarity between two vectors
func (sc *SemanticCache) cosineSimilarity(a, b []float64) float64 {
	if len(a) != len(b) {
		return 0.0
	}

	var dotProduct, normA, normB float64
	for i := range a {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	if normA == 0 || normB == 0 {
		return 0.0
	}

	return dotProduct / (math.Sqrt(normA) * math.Sqrt(normB))
}

// normalizeVector normalizes a vector to unit length
func (sc *SemanticCache) normalizeVector(vec []float64) []float64 {
	var norm float64
	for _, val := range vec {
		norm += val * val
	}
	norm = math.Sqrt(norm)

	if norm == 0 {
		return vec
	}

	normalized := make([]float64, len(vec))
	for i, val := range vec {
		normalized[i] = val / norm
	}
	return normalized
}

// evictOldest removes the least recently accessed entry
func (sc *SemanticCache) evictOldest() {
	var oldestKey string
	var oldestTime time.Time

	for key, entry := range sc.embeddings {
		if oldestTime.IsZero() || entry.AccessedAt.Before(oldestTime) {
			oldestKey = key
			oldestTime = entry.AccessedAt
		}
	}

	if oldestKey != "" {
		delete(sc.embeddings, oldestKey)
	}
}

// generateCacheKey creates a cache key from prompt and model
func (sc *SemanticCache) generateCacheKey(prompt, model string) string {
	data := fmt.Sprintf("%s:%s", model, prompt)
	hash := sha256.Sum256([]byte(data))
	return "semantic:" + hex.EncodeToString(hash[:])
}

// GetStats returns semantic cache statistics
func (sc *SemanticCache) GetStats() SemanticCacheStats {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	var totalHits int64
	var avgSimilarity float64

	for _, entry := range sc.embeddings {
		totalHits += entry.HitCount
	}

	return SemanticCacheStats{
		TotalEntries:        len(sc.embeddings),
		MaxEntries:          sc.maxEntries,
		TotalHits:           totalHits,
		SimilarityThreshold: sc.similarityThreshold,
		AvgSimilarity:       avgSimilarity,
	}
}

// Clear removes all semantic cache entries
func (sc *SemanticCache) Clear() {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	sc.embeddings = make(map[string]*EmbeddingEntry)
}

// SemanticCacheStats represents semantic cache statistics
type SemanticCacheStats struct {
	TotalEntries        int     `json:"total_entries"`
	MaxEntries          int     `json:"max_entries"`
	TotalHits           int64   `json:"total_hits"`
	SimilarityThreshold float64 `json:"similarity_threshold"`
	AvgSimilarity       float64 `json:"avg_similarity"`
}

// ExportEmbeddings exports all embeddings for analysis
func (sc *SemanticCache) ExportEmbeddings() ([]byte, error) {
	sc.mu.RLock()
	defer sc.mu.RUnlock()

	entries := make([]*EmbeddingEntry, 0, len(sc.embeddings))
	for _, entry := range sc.embeddings {
		entries = append(entries, entry)
	}

	return json.Marshal(entries)
}
