package middleware

import (
	"sync"
	"time"
)

// RateLimiterConfig holds rate limiter configuration
type RateLimiterConfig struct {
	RequestsPerMinute int           // Max requests per minute
	BurstSize         int           // Max burst size
	CleanupInterval   time.Duration // How often to clean up old entries
}

// UserTier represents user subscription tier
type UserTier string

const (
	TierFree       UserTier = "free"
	TierBasic      UserTier = "basic"
	TierPremium    UserTier = "premium"
	TierEnterprise UserTier = "enterprise"
	TierVIP        UserTier = "vip"
)

// RateLimitTier defines rate limits per tier
type RateLimitTier struct {
	Tier              UserTier
	RequestsPerMinute int
	BurstSize         int
}

// DefaultRateLimitTiers returns default rate limits per tier
func DefaultRateLimitTiers() map[UserTier]RateLimitTier {
	return map[UserTier]RateLimitTier{
		TierFree: {
			Tier:              TierFree,
			RequestsPerMinute: 10,
			BurstSize:         5,
		},
		TierBasic: {
			Tier:              TierBasic,
			RequestsPerMinute: 100,
			BurstSize:         20,
		},
		TierPremium: {
			Tier:              TierPremium,
			RequestsPerMinute: 500,
			BurstSize:         100,
		},
		TierEnterprise: {
			Tier:              TierEnterprise,
			RequestsPerMinute: 2000,
			BurstSize:         500,
		},
		TierVIP: {
			Tier:              TierVIP,
			RequestsPerMinute: 10000,
			BurstSize:         2000,
		},
	}
}

// TokenBucket implements the token bucket algorithm
type TokenBucket struct {
	capacity       float64    // Maximum tokens
	tokens         float64    // Current tokens
	refillRate     float64    // Tokens per second
	lastRefillTime time.Time  // Last refill timestamp
	mu             sync.Mutex // Thread safety
}

// RateLimiterEntry represents a rate limit entry for a user/IP
type RateLimiterEntry struct {
	Identifier  string // User ID or IP address
	TokenBucket *TokenBucket
	Tier        UserTier
	CreatedAt   time.Time
	LastAccess  time.Time
}

// RateLimitResult represents the result of a rate limit check
type RateLimitResult struct {
	Allowed    bool
	Remaining  int
	ResetAt    time.Time
	RetryAfter time.Duration
	Tier       UserTier
}

// BackpressureConfig holds backpressure configuration
type BackpressureConfig struct {
	EnableLoadShedding bool
	QueueThreshold     float64 // Percentage (0-100)
	RejectLowPriority  bool
	AdaptiveThreshold  bool
}

// BackpressureStatus represents current backpressure state
type BackpressureStatus struct {
	Active            bool
	QueueUsage        float64
	WorkerUtilization float64
	RequestsRejected  int64
	Reason            string
}

// DefaultRateLimiterConfig returns default rate limiter configuration
func DefaultRateLimiterConfig() RateLimiterConfig {
	return RateLimiterConfig{
		RequestsPerMinute: 100,
		BurstSize:         20,
		CleanupInterval:   5 * time.Minute,
	}
}

// DefaultBackpressureConfig returns default backpressure configuration
func DefaultBackpressureConfig() BackpressureConfig {
	return BackpressureConfig{
		EnableLoadShedding: true,
		QueueThreshold:     80.0, // Start shedding at 80% queue full
		RejectLowPriority:  true,
		AdaptiveThreshold:  true,
	}
}
