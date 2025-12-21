package middleware

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// NewTokenBucket creates a new token bucket
func NewTokenBucket(capacity float64, refillRate float64) *TokenBucket {
	return &TokenBucket{
		capacity:       capacity,
		tokens:         capacity, // Start with full bucket
		refillRate:     refillRate,
		lastRefillTime: time.Now(),
	}
}

// TryConsume attempts to consume tokens from the bucket
func (tb *TokenBucket) TryConsume(tokens float64) bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()

	// Refill tokens based on time elapsed
	tb.refill()

	// Check if enough tokens available
	if tb.tokens >= tokens {
		tb.tokens -= tokens
		return true
	}

	return false
}

// refill adds tokens based on time elapsed
func (tb *TokenBucket) refill() {
	now := time.Now()
	elapsed := now.Sub(tb.lastRefillTime).Seconds()

	// Calculate tokens to add
	tokensToAdd := elapsed * tb.refillRate

	// Add tokens, but don't exceed capacity
	tb.tokens = min(tb.tokens+tokensToAdd, tb.capacity)
	tb.lastRefillTime = now
}

// GetTokens returns current token count
func (tb *TokenBucket) GetTokens() float64 {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	tb.refill()
	return tb.tokens
}

// GetCapacity returns bucket capacity
func (tb *TokenBucket) GetCapacity() float64 {
	return tb.capacity
}

// RateLimiter manages rate limiting for multiple users/IPs
type RateLimiter struct {
	entries map[string]*RateLimiterEntry
	tiers   map[UserTier]RateLimitTier
	config  RateLimiterConfig
	mu      sync.RWMutex
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(config RateLimiterConfig) *RateLimiter {
	rl := &RateLimiter{
		entries: make(map[string]*RateLimiterEntry),
		tiers:   DefaultRateLimitTiers(),
		config:  config,
	}

	// Start cleanup goroutine
	go rl.cleanupLoop()

	utils.Info("Rate limiter initialized with %d req/min default", config.RequestsPerMinute)
	return rl
}

// Allow checks if a request is allowed
func (rl *RateLimiter) Allow(identifier string, tier UserTier) RateLimitResult {
	entry := rl.getOrCreateEntry(identifier, tier)

	// Try to consume 1 token
	allowed := entry.TokenBucket.TryConsume(1)

	// Update last access time
	rl.mu.Lock()
	entry.LastAccess = time.Now()
	rl.mu.Unlock()

	// Calculate remaining tokens
	remaining := int(entry.TokenBucket.GetTokens())

	// Calculate reset time (when bucket will be full again)
	tokensNeeded := entry.TokenBucket.GetCapacity() - entry.TokenBucket.GetTokens()
	secondsToFull := tokensNeeded / entry.TokenBucket.refillRate
	resetAt := time.Now().Add(time.Duration(secondsToFull) * time.Second)

	// Calculate retry after (if denied)
	var retryAfter time.Duration
	if !allowed {
		// Need 1 token, calculate how long to wait
		retryAfter = time.Duration(1.0/entry.TokenBucket.refillRate) * time.Second
	}

	return RateLimitResult{
		Allowed:    allowed,
		Remaining:  remaining,
		ResetAt:    resetAt,
		RetryAfter: retryAfter,
		Tier:       tier,
	}
}

// getOrCreateEntry gets or creates a rate limiter entry
func (rl *RateLimiter) getOrCreateEntry(identifier string, tier UserTier) *RateLimiterEntry {
	rl.mu.RLock()
	entry, exists := rl.entries[identifier]
	rl.mu.RUnlock()

	if exists {
		return entry
	}

	// Create new entry
	rl.mu.Lock()
	defer rl.mu.Unlock()

	// Double-check (another goroutine might have created it)
	if entry, exists := rl.entries[identifier]; exists {
		return entry
	}

	// Get tier config
	tierConfig, exists := rl.tiers[tier]
	if !exists {
		// Default to free tier if tier not found
		tierConfig = rl.tiers[TierFree]
	}

	// Calculate refill rate (tokens per second)
	refillRate := float64(tierConfig.RequestsPerMinute) / 60.0

	// Create token bucket
	bucket := NewTokenBucket(
		float64(tierConfig.RequestsPerMinute),
		refillRate,
	)

	entry = &RateLimiterEntry{
		Identifier:  identifier,
		TokenBucket: bucket,
		Tier:        tier,
		CreatedAt:   time.Now(),
		LastAccess:  time.Now(),
	}

	rl.entries[identifier] = entry
	utils.Debug("Created rate limiter entry for %s (tier: %s, %d req/min)",
		identifier, tier, tierConfig.RequestsPerMinute)

	return entry
}

// cleanupLoop periodically removes inactive entries
func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(rl.config.CleanupInterval)
	defer ticker.Stop()

	for range ticker.C {
		rl.cleanup()
	}
}

// cleanup removes entries that haven't been accessed recently
func (rl *RateLimiter) cleanup() {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	inactiveThreshold := 10 * time.Minute
	removed := 0

	for identifier, entry := range rl.entries {
		if now.Sub(entry.LastAccess) > inactiveThreshold {
			delete(rl.entries, identifier)
			removed++
		}
	}

	if removed > 0 {
		utils.Debug("Rate limiter cleanup: removed %d inactive entries", removed)
	}
}

// GetStats returns rate limiter statistics
func (rl *RateLimiter) GetStats() map[string]interface{} {
	rl.mu.RLock()
	defer rl.mu.RUnlock()

	// Count by tier
	tierCounts := make(map[UserTier]int)
	for _, entry := range rl.entries {
		tierCounts[entry.Tier]++
	}

	return map[string]interface{}{
		"total_users":      len(rl.entries),
		"users_by_tier":    tierCounts,
		"cleanup_interval": rl.config.CleanupInterval.String(),
	}
}

// GetUserStatus returns current status for a user
func (rl *RateLimiter) GetUserStatus(identifier string) map[string]interface{} {
	rl.mu.RLock()
	entry, exists := rl.entries[identifier]
	rl.mu.RUnlock()

	if !exists {
		return map[string]interface{}{
			"exists": false,
		}
	}

	tokens := entry.TokenBucket.GetTokens()
	capacity := entry.TokenBucket.GetCapacity()

	return map[string]interface{}{
		"exists":        true,
		"identifier":    entry.Identifier,
		"tier":          entry.Tier,
		"tokens":        int(tokens),
		"capacity":      int(capacity),
		"usage_percent": (capacity - tokens) / capacity * 100,
		"created_at":    entry.CreatedAt,
		"last_access":   entry.LastAccess,
	}
}

// RateLimitMiddleware returns an HTTP middleware for rate limiting
func RateLimitMiddleware(rl *RateLimiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract user identifier (from header, IP, etc.)
			identifier := r.Header.Get("X-User-ID")
			if identifier == "" {
				// Fall back to IP address
				identifier = r.RemoteAddr
			}

			// Extract tier
			tierStr := r.Header.Get("X-User-Tier")
			tier := UserTier(tierStr)
			if tier == "" {
				tier = TierFree // Default to free tier
			}

			// Check rate limit
			result := rl.Allow(identifier, tier)

			// Add rate limit headers
			w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", int(rl.tiers[tier].RequestsPerMinute)))
			w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", result.Remaining))
			w.Header().Set("X-RateLimit-Reset", result.ResetAt.Format(time.RFC3339))

			if !result.Allowed {
				// Rate limit exceeded
				w.Header().Set("Retry-After", fmt.Sprintf("%d", int(result.RetryAfter.Seconds())))
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				errorResp := types.NewErrorResponse("Rate Limit Exceeded",
					fmt.Sprintf("Rate limit exceeded. Try again in %s", result.RetryAfter))
				json.NewEncoder(w).Encode(errorResp)

				utils.Debug("Rate limit exceeded for %s (tier: %s)", identifier, tier)
				return
			}

			// Allow request
			next.ServeHTTP(w, r)
		})
	}
}

// Global rate limiter instance
var globalRateLimiter *RateLimiter
var rateLimiterOnce sync.Once

// InitGlobalRateLimiter initializes the global rate limiter
func InitGlobalRateLimiter(config RateLimiterConfig) {
	rateLimiterOnce.Do(func() {
		globalRateLimiter = NewRateLimiter(config)
	})
}

// GetGlobalRateLimiter returns the global rate limiter
func GetGlobalRateLimiter() *RateLimiter {
	if globalRateLimiter == nil {
		InitGlobalRateLimiter(DefaultRateLimiterConfig())
	}
	return globalRateLimiter
}

// Helper function
func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
