package cluster

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/redis/go-redis/v9"
)

var (
	// ErrLockNotAcquired is returned when TryLock finds the key already held.
	ErrLockNotAcquired = errors.New("lock not acquired: already held by another instance")
	// ErrNotLockOwner is returned when Unlock is called by a non-owner.
	ErrNotLockOwner = errors.New("not the lock owner")
)

// unlockScript deletes the lock key only if the caller owns it (atomic).
var unlockScript = redis.NewScript(`
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
else
    return 0
end`)

// extendScript refreshes the TTL only if the caller owns the lock (atomic).
var extendScript = redis.NewScript(`
if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("PEXPIRE", KEYS[1], ARGV[2])
else
    return 0
end`)

// DistributedLock implements a single-Redis distributed mutex.
// It uses a random token as the lock value so only the owner can release it.
type DistributedLock struct {
	redis     *redis.Client
	key       string
	token     string
	ttl       time.Duration
	stopRenew chan struct{}
}

// NewDistributedLock creates a lock for the given logical key.
// The actual Redis key is prefixed with "lock:" to avoid collisions.
func NewDistributedLock(rdb *redis.Client, key string, ttl time.Duration) *DistributedLock {
	return &DistributedLock{
		redis: rdb,
		key:   "lock:" + key,
		token: randomToken(),
		ttl:   ttl,
	}
}

// newDistributedLockWithValue creates a lock whose value is a known string
// (e.g., a node ID) so other instances can inspect who holds it.
func newDistributedLockWithValue(rdb *redis.Client, key, value string, ttl time.Duration) *DistributedLock {
	return &DistributedLock{
		redis: rdb,
		key:   "lock:" + key,
		token: value,
		ttl:   ttl,
	}
}

// TryLock attempts to acquire the lock once (non-blocking).
// Returns ErrLockNotAcquired if another instance currently holds it.
func (dl *DistributedLock) TryLock(ctx context.Context) error {
	ok, err := dl.redis.SetNX(ctx, dl.key, dl.token, dl.ttl).Result()
	if err != nil {
		return fmt.Errorf("redis SetNX: %w", err)
	}
	if !ok {
		return ErrLockNotAcquired
	}
	return nil
}

// Lock blocks until the lock is acquired or ctx is cancelled.
// Retries every 50 ms.
func (dl *DistributedLock) Lock(ctx context.Context) error {
	for {
		if err := dl.TryLock(ctx); err == nil {
			return nil
		} else if !errors.Is(err, ErrLockNotAcquired) {
			return err
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(50 * time.Millisecond):
		}
	}
}

// Unlock releases the lock. Returns ErrNotLockOwner if this instance does not
// own it (e.g., the TTL expired and another node took it).
func (dl *DistributedLock) Unlock(ctx context.Context) error {
	dl.haltAutoRenew()
	result, err := unlockScript.Run(ctx, dl.redis, []string{dl.key}, dl.token).Int()
	if err != nil {
		return fmt.Errorf("unlock script: %w", err)
	}
	if result == 0 {
		return ErrNotLockOwner
	}
	return nil
}

// Extend refreshes the lock TTL without releasing it.
// Returns ErrNotLockOwner if this instance no longer owns the lock.
func (dl *DistributedLock) Extend(ctx context.Context) error {
	result, err := extendScript.Run(
		ctx, dl.redis, []string{dl.key}, dl.token, dl.ttl.Milliseconds(),
	).Int()
	if err != nil {
		return fmt.Errorf("extend script: %w", err)
	}
	if result == 0 {
		return ErrNotLockOwner
	}
	return nil
}

// AutoRenew starts a background goroutine that extends the lock at half the TTL
// interval, preventing expiry while the caller is still working.
// Call Unlock to stop renewal and release the lock.
func (dl *DistributedLock) AutoRenew(ctx context.Context) {
	dl.stopRenew = make(chan struct{})
	interval := dl.ttl / 2
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				rCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
				if err := dl.Extend(rCtx); err != nil {
					utils.Error("Auto-renew failed for lock %s: %v", dl.key, err)
					cancel()
					return
				}
				cancel()
			case <-dl.stopRenew:
				return
			case <-ctx.Done():
				return
			}
		}
	}()
}

// CurrentHolder returns the token/value of whoever currently holds the lock.
// Returns "" if the lock is not held.
func (dl *DistributedLock) CurrentHolder(ctx context.Context) string {
	val, err := dl.redis.Get(ctx, dl.key).Result()
	if err != nil {
		return ""
	}
	return val
}

func (dl *DistributedLock) haltAutoRenew() {
	if dl.stopRenew != nil {
		select {
		case <-dl.stopRenew:
		default:
			close(dl.stopRenew)
		}
	}
}

func randomToken() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}
