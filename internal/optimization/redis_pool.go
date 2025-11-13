package optimization

import (
	"context"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/redis/go-redis/v9"
)

// RedisConnection wraps a Redis client
type RedisConnection struct {
	client    *redis.Client
	createdAt time.Time
	lastUsed  time.Time
	mu        sync.RWMutex
}

// NewRedisConnection creates a new Redis connection wrapper
func NewRedisConnection(client *redis.Client) *RedisConnection {
	now := time.Now()
	return &RedisConnection{
		client:    client,
		createdAt: now,
		lastUsed:  now,
	}
}

// IsHealthy checks if the connection is healthy
func (c *RedisConnection) IsHealthy() bool {
	if c.client == nil {
		return false
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	err := c.client.Ping(ctx).Err()
	return err == nil
}

// Close closes the connection
func (c *RedisConnection) Close() error {
	if c.client == nil {
		return nil
	}
	return c.client.Close()
}

// GetCreatedAt returns when connection was created
func (c *RedisConnection) GetCreatedAt() time.Time {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.createdAt
}

// GetLastUsed returns when connection was last used
func (c *RedisConnection) GetLastUsed() time.Time {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.lastUsed
}

// MarkUsed updates last used time
func (c *RedisConnection) MarkUsed() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.lastUsed = time.Now()
}

// GetClient returns the underlying Redis client
func (c *RedisConnection) GetClient() *redis.Client {
	return c.client
}

// RedisConnectionFactory creates Redis connections
type RedisConnectionFactory struct {
	addr     string
	password string
	db       int
}

// NewRedisConnectionFactory creates a new Redis connection factory
func NewRedisConnectionFactory(addr, password string, db int) *RedisConnectionFactory {
	return &RedisConnectionFactory{
		addr:     addr,
		password: password,
		db:       db,
	}
}

// Create creates a new Redis connection
func (f *RedisConnectionFactory) Create() (Connection, error) {
	client := redis.NewClient(&redis.Options{
		Addr:         f.addr,
		Password:     f.password,
		DB:           f.db,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     1, // This pool manages connections
		MinIdleConns: 0,
		ConnMaxIdleTime:  5 * time.Minute,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		client.Close()
		return nil, err
	}

	return NewRedisConnection(client), nil
}

// RedisPool is a specialized connection pool for Redis
type RedisPool struct {
	*ConnectionPool
	factory *RedisConnectionFactory
}

// NewRedisPool creates a new Redis connection pool
func NewRedisPool(config PoolConfig, addr, password string, db int) (*RedisPool, error) {
	factory := NewRedisConnectionFactory(addr, password, db)

	pool, err := NewConnectionPool(config, factory)
	if err != nil {
		return nil, err
	}

	redisPool := &RedisPool{
		ConnectionPool: pool,
		factory:        factory,
	}

	utils.Info("Redis connection pool initialized")
	return redisPool, nil
}

// AcquireRedis acquires a Redis client
func (p *RedisPool) AcquireRedis() (*redis.Client, func(), error) {
	conn, err := p.Acquire()
	if err != nil {
		return nil, nil, err
	}

	redisConn, ok := conn.(*RedisConnection)
	if !ok {
		p.Release(conn)
		return nil, nil, ErrInvalidConn
	}

	// Return client and release function
	release := func() {
		p.Release(conn)
	}

	return redisConn.GetClient(), release, nil
}

// Global Redis pool
var globalRedisPool *RedisPool
var redisPoolOnce sync.Once

// InitGlobalRedisPool initializes the global Redis pool
func InitGlobalRedisPool(config PoolConfig, addr, password string, db int) error {
	var err error
	redisPoolOnce.Do(func() {
		globalRedisPool, err = NewRedisPool(config, addr, password, db)
	})
	return err
}

// GetGlobalRedisPool returns the global Redis pool
func GetGlobalRedisPool() *RedisPool {
	return globalRedisPool
}
