package cache

import (
	"context"
	"fmt"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/config"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/redis/go-redis/v9"
)

// RedisClient is the global Redis client instance
var RedisClient *redis.Client

// Connect establishes a connection to Redis
func Connect(cfg *config.Config) error {
	utils.Info("Connecting to Redis...")

	// Create Redis client
	RedisClient = redis.NewClient(&redis.Options{
		Addr:         cfg.GetRedisAddr(),
		Password:     cfg.Redis.Password,
		DB:           cfg.Redis.DB,
		PoolSize:     10,
		MinIdleConns: 5,
		MaxRetries:   3,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	// Test the connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := RedisClient.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("failed to connect to Redis: %w", err)
	}

	utils.Info("Redis connected successfully")
	return nil
}

// Close closes the Redis connection
func Close() error {
	if RedisClient != nil {
		return RedisClient.Close()
	}
	return nil
}

// GetClient returns the Redis client instance
func GetClient() *redis.Client {
	return RedisClient
}

// HealthCheck checks if Redis is healthy
func HealthCheck() error {
	if RedisClient == nil {
		return fmt.Errorf("redis not connected")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	return RedisClient.Ping(ctx).Err()
}

// FlushAll clears all data from Redis (use with caution!)
func FlushAll() error {
	if RedisClient == nil {
		return fmt.Errorf("redis not connected")
	}

	ctx := context.Background()
	return RedisClient.FlushAll(ctx).Err()
}

// GetStats returns Redis statistics
func GetStats() (map[string]interface{}, error) {
	if RedisClient == nil {
		return nil, fmt.Errorf("redis not connected")
	}

	ctx := context.Background()

	// Get Redis info
	info, err := RedisClient.Info(ctx, "stats").Result()
	if err != nil {
		return nil, err
	}

	// Get database size
	dbSize, err := RedisClient.DBSize(ctx).Result()
	if err != nil {
		return nil, err
	}

	// Get memory stats
	memoryInfo, err := RedisClient.Info(ctx, "memory").Result()
	if err != nil {
		return nil, err
	}

	stats := map[string]interface{}{
		"db_size":     dbSize,
		"info":        info,
		"memory_info": memoryInfo,
		"connected":   true,
	}

	return stats, nil
}
