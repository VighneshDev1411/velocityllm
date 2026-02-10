package main

import (
	"fmt"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	dsn := "host=localhost port=5432 user=vigneshmac dbname=velocityllm sslmode=disable"

	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	}

	db, err := gorm.Open(postgres.Open(dsn), gormConfig)
	if err != nil {
		fmt.Printf("Failed to connect: %v\n", err)
		return
	}

	fmt.Println("Connected successfully!")

	// Try to migrate
	err = db.AutoMigrate(
		&types.Request{},
		&types.Model{},
		&types.CacheEntry{},
	)

	if err != nil {
		fmt.Printf("Failed to migrate: %v\n", err)
		return
	}

	fmt.Println("Migration successful!")
}
