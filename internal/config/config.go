package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"time"
)

// Config holds all application configuration
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	App      AppConfig
	Cluster  ClusterConfig
}

// ServerConfig holds server-related configuration
type ServerConfig struct {
	Host         string
	Port         int
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
	IdleTimeout  time.Duration
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Database string
	SSLMode  string
}

// RedisConfig holds Redis configuration
type RedisConfig struct {
	Host     string
	Port     int
	Password string
	DB       int
}

// AppConfig holds application-level configuration
type AppConfig struct {
	Name        string
	Version     string
	Environment string
	LogLevel    string
}

// ClusterConfig holds horizontal-scaling configuration.
type ClusterConfig struct {
	// NodeID uniquely identifies this instance in the cluster.
	// Defaults to HOSTNAME:PORT; can be overridden via NODE_ID env var.
	NodeID string
	// HeartbeatInterval is how often this node refreshes its Redis TTL.
	HeartbeatInterval time.Duration
	// SessionTTL is the default lifetime of a distributed session.
	SessionTTL time.Duration
	// LockTTL is the default TTL for distributed locks.
	LockTTL time.Duration
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	config := &Config{
		Server: ServerConfig{
			Host:         getEnv("SERVER_HOST", "0.0.0.0"),
			Port:         getEnvAsInt("SERVER_PORT", getEnvAsInt("PORT", 8080)),
			ReadTimeout:  time.Duration(getEnvAsInt("SERVER_READ_TIMEOUT", 15)) * time.Second,
			WriteTimeout: time.Duration(getEnvAsInt("SERVER_WRITE_TIMEOUT", 15)) * time.Second,
			IdleTimeout:  time.Duration(getEnvAsInt("SERVER_IDLE_TIMEOUT", 60)) * time.Second,
		},
		Database: DatabaseConfig{
			Host:     getEnv("DB_HOST", "localhost"),
			Port:     getEnvAsInt("DB_PORT", 5432),
			User:     getEnv("DB_USER", "postgres"),
			Password: getEnv("DB_PASSWORD", "postgres"),
			Database: getEnv("DB_NAME", "velocityllm"),
			SSLMode:  getEnv("DB_SSLMODE", "disable"),
		},
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnvAsInt("REDIS_PORT", 6379),
			Password: getEnv("REDIS_PASSWORD", ""),
			DB:       getEnvAsInt("REDIS_DB", 0),
		},
		App: AppConfig{
			Name:        "VelocityLLM",
			Version:     getEnv("APP_VERSION", "0.1.0"),
			Environment: getEnv("APP_ENV", "development"),
			LogLevel:    getEnv("LOG_LEVEL", "info"),
		},
		Cluster: ClusterConfig{
			NodeID:            getEnv("NODE_ID", ""),
			HeartbeatInterval: 10 * time.Second,
			SessionTTL:        24 * time.Hour,
			LockTTL:           30 * time.Second,
		},
	}

	// Railway provides REDIS_URL - parse it to override individual Redis fields
	if redisURL := os.Getenv("REDIS_URL"); redisURL != "" {
		if parsed, err := url.Parse(redisURL); err == nil {
			config.Redis.Host = parsed.Hostname()
			if p, err := strconv.Atoi(parsed.Port()); err == nil {
				config.Redis.Port = p
			}
			if parsed.User != nil {
				config.Redis.Password, _ = parsed.User.Password()
			}
		}
	}

	return config, nil
}

// GetDatabaseDSN returns the PostgreSQL connection string
func (c *Config) GetDatabaseDSN() string {
	// Railway provides DATABASE_URL - use it directly if available
	if dbURL := os.Getenv("DATABASE_URL"); dbURL != "" {
		return dbURL
	}
	if c.Database.Password == "" {
		// Don't include password parameter if it's empty
		return fmt.Sprintf(
			"host=%s port=%d user=%s dbname=%s sslmode=%s",
			c.Database.Host,
			c.Database.Port,
			c.Database.User,
			c.Database.Database,
			c.Database.SSLMode,
		)
	}
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Database.Host,
		c.Database.Port,
		c.Database.User,
		c.Database.Password,
		c.Database.Database,
		c.Database.SSLMode,
	)
}

// GetRedisAddr returns the Redis connection address
func (c *Config) GetRedisAddr() string {
	return fmt.Sprintf("%s:%d", c.Redis.Host, c.Redis.Port)
}

// GetServerAddr returns the server address
func (c *Config) GetServerAddr() string {
	return fmt.Sprintf("%s:%d", c.Server.Host, c.Server.Port)
}

// Helper functions

// getEnv gets an environment variable or returns a default value
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvAsInt gets an environment variable as an integer or returns a default value
func getEnvAsInt(key string, defaultValue int) int {
	valueStr := getEnv(key, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}
