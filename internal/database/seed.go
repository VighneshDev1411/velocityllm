package database

import (
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// Seed populates the database with initial data
func Seed() error {
	utils.Info("Seeding database with initial data...")

	// Seed models
	models := []types.Model{
		{
			Name:         "gpt-4",
			Provider:     "openai",
			CostPerToken: 0.00003, // $0.03 per 1K tokens
			MaxTokens:    8192,
			Available:    true,
			Description:  "OpenAI GPT-4 - Most capable model",
		},
		{
			Name:         "gpt-3.5-turbo",
			Provider:     "openai",
			CostPerToken: 0.000002, // $0.002 per 1K tokens
			MaxTokens:    4096,
			Available:    true,
			Description:  "OpenAI GPT-3.5 Turbo - Fast and efficient",
		},
		{
			Name:         "claude-3-opus",
			Provider:     "anthropic",
			CostPerToken: 0.000015, // $0.015 per 1K tokens
			MaxTokens:    200000,
			Available:    true,
			Description:  "Anthropic Claude 3 Opus - Most intelligent",
		},
		{
			Name:         "claude-3-sonnet",
			Provider:     "anthropic",
			CostPerToken: 0.000003, // $0.003 per 1K tokens
			MaxTokens:    200000,
			Available:    true,
			Description:  "Anthropic Claude 3 Sonnet - Balanced performance",
		},
		{
			Name:         "llama-3-8b",
			Provider:     "local",
			CostPerToken: 0.0, // Free - running locally
			MaxTokens:    8192,
			Available:    true,
			Endpoint:     "http://localhost:8000",
			Description:  "Meta Llama 3 8B - Open source, local inference",
		},
		{
			Name:         "llama-3-70b",
			Provider:     "local",
			CostPerToken: 0.0, // Free - running locally
			MaxTokens:    8192,
			Available:    false, // Not available by default (requires GPU)
			Endpoint:     "http://localhost:8000",
			Description:  "Meta Llama 3 70B - Larger open source model",
		},
	}

	// Insert models if they don't exist
	for _, model := range models {
		var existing types.Model
		result := DB.Where("name = ?", model.Name).First(&existing)

		if result.Error != nil {
			// Model doesn't exist, create it
			if err := DB.Create(&model).Error; err != nil {
				utils.Error("Failed to create model %s: %v", model.Name, err)
				return err
			}
			utils.Info("Created model: %s", model.Name)
		} else {
			utils.Info("Model already exists: %s", model.Name)
		}
	}

	utils.Info("Database seeding completed successfully")
	return nil
}
