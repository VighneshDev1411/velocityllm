package database

import (
	"fmt"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/config"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DB is the global database instance
var DB *gorm.DB

// Connect establishes a connection to the database
func Connect(cfg *config.Config) error {
	utils.Info("Connecting to database...")

	// Configure GORM
	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent), // Change to logger.Info for SQL logs
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	}

	// Connect to PostgreSQL
	dsn := cfg.GetDatabaseDSN()
	db, err := gorm.Open(postgres.Open(dsn), gormConfig)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Get underlying SQL database
	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get database instance: %w", err)
	}

	// Set connection pool settings
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Test the connection
	if err := sqlDB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	DB = db
	utils.Info("Database connected successfully")

	return nil
}

// Close closes the database connection
func Close() error {
	if DB != nil {
		sqlDB, err := DB.DB()
		if err != nil {
			return err
		}
		return sqlDB.Close()
	}
	return nil
}

// Migrate runs database migrations
func Migrate() error {
	utils.Info("Running database migrations...")

	// Auto-migrate all models
	err := DB.AutoMigrate(
		&types.Request{},
		&types.Model{},
		&types.CacheEntry{},
	)

	if err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	utils.Info("Database migrations completed successfully")
	return nil
}

// GetDB returns the database instance
func GetDB() *gorm.DB {
	return DB
}

// HealthCheck checks if the database is healthy
func HealthCheck() error {
	if DB == nil {
		return fmt.Errorf("database not connected")
	}

	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}

	return sqlDB.Ping()
}
