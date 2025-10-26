package database

import (
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ModelRepository handles all database operations for models
type ModelRepository struct {
	db *gorm.DB
}

// NewModelRepository creates a new model repository
func NewModelRepository() *ModelRepository {
	return &ModelRepository{
		db: DB,
	}
}

// Create creates a new model in the database
func (r *ModelRepository) Create(model *types.Model) error {
	return r.db.Create(model).Error
}

// GetByID retrieves a model by its ID
func (r *ModelRepository) GetByID(id uuid.UUID) (*types.Model, error) {
	var model types.Model
	err := r.db.First(&model, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &model, nil
}

// GetByName retrieves a model by its name
func (r *ModelRepository) GetByName(name string) (*types.Model, error) {
	var model types.Model
	err := r.db.Where("name = ?", name).First(&model).Error
	if err != nil {
		return nil, err
	}
	return &model, nil
}

// GetAll retrieves all models
func (r *ModelRepository) GetAll() ([]types.Model, error) {
	var models []types.Model
	err := r.db.Order("name ASC").Find(&models).Error
	return models, err
}

// GetAvailable retrieves all available models
func (r *ModelRepository) GetAvailable() ([]types.Model, error) {
	var models []types.Model
	err := r.db.Where("available = ?", true).Order("name ASC").Find(&models).Error
	return models, err
}

// GetByProvider retrieves all models from a specific provider
func (r *ModelRepository) GetByProvider(provider string) ([]types.Model, error) {
	var models []types.Model
	err := r.db.Where("provider = ?", provider).Order("name ASC").Find(&models).Error
	return models, err
}

// Update updates an existing model
func (r *ModelRepository) Update(model *types.Model) error {
	return r.db.Save(model).Error
}

// UpdateAvailability updates the availability status of a model
func (r *ModelRepository) UpdateAvailability(name string, available bool) error {
	return r.db.Model(&types.Model{}).
		Where("name = ?", name).
		Update("available", available).Error
}

// Delete soft deletes a model
func (r *ModelRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&types.Model{}, "id = ?", id).Error
}

// Count returns the total number of models
func (r *ModelRepository) Count() (int64, error) {
	var count int64
	err := r.db.Model(&types.Model{}).Count(&count).Error
	return count, err
}

// Exists checks if a model with the given name exists
func (r *ModelRepository) Exists(name string) (bool, error) {
	var count int64
	err := r.db.Model(&types.Model{}).Where("name = ?", name).Count(&count).Error
	return count > 0, err
}
