package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/redis/go-redis/v9"
)

// slidingWindowScript implements an atomic sliding-window rate limiter using a
// Redis sorted set. Each request is recorded as a member with its timestamp as
// the score. Requests older than the window are pruned on every call.
//
// KEYS[1] = rate-limit key  (e.g. "rl:user:abc123")
// ARGV[1] = current time in milliseconds
// ARGV[2] = window size in milliseconds
// ARGV[3] = max requests in the window
// ARGV[4] = unique member ID for this request (timestamp + random suffix)
//
// Returns {allowed (0|1), current_count, ttl_ms}
var slidingWindowScript = redis.NewScript(`
local key      = KEYS[1]
local now      = tonumber(ARGV[1])
local window   = tonumber(ARGV[2])
local limit    = tonumber(ARGV[3])
local member   = ARGV[4]

-- Remove entries outside the current window
redis.call("ZREMRANGEBYSCORE", key, 0, now - window)

-- Count how many requests are in the window
local count = redis.call("ZCARD", key)

if count < limit then
    redis.call("ZADD", key, now, member)
    redis.call("PEXPIRE", key, window)
    return {1, count + 1, window}
else
    local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
    local wait_ms = 0
    if #oldest > 0 then
        wait_ms = (tonumber(oldest[2]) + window) - now
    end
    return {0, count, wait_ms}
end
`)

// DistributedRateLimiter enforces per-user rate limits using Redis so the
// limits are shared across every cluster node (unlike the in-process
// token-bucket limiter which only enforces limits per instance).
type DistributedRateLimiter struct {
	redis  *redis.Client
	tiers  map[UserTier]RateLimitTier
	config RateLimiterConfig
}

// NewDistributedRateLimiter constructs a Redis-backed rate limiter.
func NewDistributedRateLimiter(rdb *redis.Client, config RateLimiterConfig) *DistributedRateLimiter {
	drl := &DistributedRateLimiter{
		redis:  rdb,
		tiers:  DefaultRateLimitTiers(),
		config: config,
	}
	utils.Info("Distributed rate limiter initialised (Redis sliding-window, default: %d req/min)", config.RequestsPerMinute)
	return drl
}

// Allow checks whether the given identifier may make a request.
// It delegates to Redis so the decision is consistent across all nodes.
func (d *DistributedRateLimiter) Allow(ctx context.Context, identifier string, tier UserTier) RateLimitResult {
	tierCfg, ok := d.tiers[tier]
	if !ok {
		tierCfg = d.tiers[TierFree]
	}

	key := fmt.Sprintf("rl:%s:%s", tier, identifier)
	nowMs := time.Now().UnixMilli()
	windowMs := int64(60_000) // 1-minute sliding window
	limit := int64(tierCfg.RequestsPerMinute)
	member := fmt.Sprintf("%d-%s", nowMs, identifier[:min8(len(identifier))])

	result, err := slidingWindowScript.Run(
		ctx, d.redis,
		[]string{key},
		nowMs, windowMs, limit, member,
	).Int64Slice()

	if err != nil {
		// Redis unavailable — fail open (allow) to avoid a Redis outage
		// taking down the entire API. Log the degradation.
		utils.Error("Distributed rate limiter Redis error (failing open): %v", err)
		return RateLimitResult{
			Allowed:   true,
			Remaining: int(tierCfg.RequestsPerMinute),
			ResetAt:   time.Now().Add(time.Minute),
			Tier:      tier,
		}
	}

	allowed := result[0] == 1
	count := result[1]
	waitMs := result[2]

	remaining := int(limit - count)
	if remaining < 0 {
		remaining = 0
	}
	resetAt := time.Now().Add(time.Minute)
	var retryAfter time.Duration
	if !allowed {
		retryAfter = time.Duration(waitMs) * time.Millisecond
	}

	return RateLimitResult{
		Allowed:    allowed,
		Remaining:  remaining,
		ResetAt:    resetAt,
		RetryAfter: retryAfter,
		Tier:       tier,
	}
}

// Middleware returns an http.Handler middleware that enforces distributed
// rate limits. It replaces RateLimitMiddleware for multi-node deployments.
func (d *DistributedRateLimiter) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		identifier := r.Header.Get("X-User-ID")
		if identifier == "" {
			identifier = r.RemoteAddr
		}
		tier := UserTier(r.Header.Get("X-User-Tier"))
		if tier == "" {
			tier = TierFree
		}

		result := d.Allow(r.Context(), identifier, tier)

		tierCfg := d.tiers[tier]
		w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", tierCfg.RequestsPerMinute))
		w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", result.Remaining))
		w.Header().Set("X-RateLimit-Reset", result.ResetAt.Format(time.RFC3339))

		if !result.Allowed {
			w.Header().Set("Retry-After", fmt.Sprintf("%d", int(result.RetryAfter.Seconds())+1))
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			json.NewEncoder(w).Encode(types.NewErrorResponse(
				"Rate Limit Exceeded",
				fmt.Sprintf("Cluster-wide rate limit exceeded. Retry in %.1fs", result.RetryAfter.Seconds()),
			))
			utils.Debug("Distributed rate limit exceeded: identifier=%s tier=%s", identifier, tier)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// GetStats returns basic stats about the distributed rate limiter.
func (d *DistributedRateLimiter) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"type":   "distributed_redis_sliding_window",
		"window": "60s",
		"tiers":  d.tiers,
	}
}

// ---- global singleton -------------------------------------------------------

var (
	globalDistributedRL     *DistributedRateLimiter
	distributedRLOnce       sync.Once
)

// InitGlobalDistributedRateLimiter initialises the Redis-backed rate limiter.
func InitGlobalDistributedRateLimiter(rdb *redis.Client, config RateLimiterConfig) {
	distributedRLOnce.Do(func() {
		globalDistributedRL = NewDistributedRateLimiter(rdb, config)
	})
}

// GetGlobalDistributedRateLimiter returns the singleton.
func GetGlobalDistributedRateLimiter() *DistributedRateLimiter {
	return globalDistributedRL
}

func min8(n int) int {
	if n < 8 {
		return n
	}
	return 8
}
