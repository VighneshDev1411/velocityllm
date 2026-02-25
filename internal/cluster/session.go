package cluster

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/redis/go-redis/v9"
)

const (
	sessionKeyPrefix  = "session:"
	userSessionsKey   = "user:sessions:"
	defaultSessionTTL = 24 * time.Hour
)

// SessionData holds the payload stored inside a session.
type SessionData struct {
	UserID    string            `json:"user_id"`
	Email     string            `json:"email"`
	Role      string            `json:"role"`
	NodeID    string            `json:"node_id"`    // which node created it
	CreatedAt time.Time         `json:"created_at"`
	ExpiresAt time.Time         `json:"expires_at"`
	Meta      map[string]string `json:"meta,omitempty"`
}

// SessionStore provides Redis-backed distributed session management.
// Because sessions live in Redis (not in-process memory), any cluster node
// can validate or invalidate a session — enabling true stateless scaling.
type SessionStore struct {
	redis  *redis.Client
	ttl    time.Duration
	nodeID string
}

// NewSessionStore creates a SessionStore with the given TTL.
func NewSessionStore(rdb *redis.Client, nodeID string, ttl time.Duration) *SessionStore {
	if ttl == 0 {
		ttl = defaultSessionTTL
	}
	return &SessionStore{redis: rdb, ttl: ttl, nodeID: nodeID}
}

// Create generates a new session token and persists the session data.
// The token is a 32-byte hex string (128-bit entropy).
func (s *SessionStore) Create(ctx context.Context, data SessionData) (string, error) {
	token := generateSessionToken()
	data.NodeID = s.nodeID
	data.CreatedAt = time.Now()
	data.ExpiresAt = time.Now().Add(s.ttl)

	payload, err := json.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("marshal session: %w", err)
	}

	key := sessionKeyPrefix + token
	if err := s.redis.Set(ctx, key, payload, s.ttl).Err(); err != nil {
		return "", fmt.Errorf("store session: %w", err)
	}

	// Track all sessions for this user (for bulk invalidation)
	userKey := userSessionsKey + data.UserID
	s.redis.SAdd(ctx, userKey, token)
	s.redis.Expire(ctx, userKey, s.ttl+time.Hour)

	utils.Debug("Session created: user=%s node=%s", data.UserID, s.nodeID)
	return token, nil
}

// Get retrieves the session data for the given token.
// Returns an error if the token is invalid or expired.
func (s *SessionStore) Get(ctx context.Context, token string) (*SessionData, error) {
	payload, err := s.redis.Get(ctx, sessionKeyPrefix+token).Bytes()
	if err != nil {
		return nil, fmt.Errorf("session not found or expired")
	}
	var data SessionData
	if err := json.Unmarshal(payload, &data); err != nil {
		return nil, fmt.Errorf("corrupt session data")
	}
	return &data, nil
}

// Refresh extends the TTL of an existing session.
func (s *SessionStore) Refresh(ctx context.Context, token string) error {
	key := sessionKeyPrefix + token
	data, err := s.Get(ctx, token)
	if err != nil {
		return err
	}
	data.ExpiresAt = time.Now().Add(s.ttl)
	payload, _ := json.Marshal(data)
	return s.redis.Set(ctx, key, payload, s.ttl).Err()
}

// Invalidate deletes a single session (e.g., on logout).
func (s *SessionStore) Invalidate(ctx context.Context, token string) error {
	data, err := s.Get(ctx, token)
	if err == nil {
		s.redis.SRem(ctx, userSessionsKey+data.UserID, token)
	}
	return s.redis.Del(ctx, sessionKeyPrefix+token).Err()
}

// InvalidateUser deletes all active sessions for a given user ID.
// This enables forced logout from the admin panel across all cluster nodes.
func (s *SessionStore) InvalidateUser(ctx context.Context, userID string) (int64, error) {
	userKey := userSessionsKey + userID
	tokens, err := s.redis.SMembers(ctx, userKey).Result()
	if err != nil {
		return 0, err
	}
	if len(tokens) == 0 {
		return 0, nil
	}

	pipe := s.redis.Pipeline()
	for _, token := range tokens {
		pipe.Del(ctx, sessionKeyPrefix+token)
	}
	pipe.Del(ctx, userKey)
	_, err = pipe.Exec(ctx)
	if err != nil {
		return 0, fmt.Errorf("invalidate user sessions: %w", err)
	}

	utils.Info("Invalidated %d session(s) for user %s", len(tokens), userID)
	return int64(len(tokens)), nil
}

// GetActiveSessions returns all active session tokens for a user.
func (s *SessionStore) GetActiveSessions(ctx context.Context, userID string) ([]SessionData, error) {
	tokens, err := s.redis.SMembers(ctx, userSessionsKey+userID).Result()
	if err != nil {
		return nil, err
	}
	sessions := make([]SessionData, 0, len(tokens))
	stale := make([]string, 0)
	for _, token := range tokens {
		data, err := s.Get(ctx, token)
		if err != nil {
			stale = append(stale, token)
			continue
		}
		sessions = append(sessions, *data)
	}
	// Clean up expired tokens from the user set
	if len(stale) > 0 {
		args := make([]interface{}, len(stale))
		for i, t := range stale {
			args[i] = t
		}
		s.redis.SRem(ctx, userSessionsKey+userID, args...)
	}
	return sessions, nil
}

func generateSessionToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return hex.EncodeToString(b)
}
