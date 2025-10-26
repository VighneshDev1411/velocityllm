package database

import (
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

// RequestRepository handles all database operations for requests
type RequestRepository struct {
	db *gorm.DB
}

// NewRequestRepository creates a new request repository
func NewRequestRepository() *RequestRepository {
	return &RequestRepository{
		db: DB,
	}
}

// Create creates a new request in the database
func (r *RequestRepository) Create(request *types.Request) error {
	return r.db.Create(request).Error
}

// GetByID retrieves a request by its ID
func (r *RequestRepository) GetByID(id uuid.UUID) (*types.Request, error) {
	var request types.Request
	err := r.db.First(&request, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &request, nil
}

// GetAll retrieves all requests with optional filters
func (r *RequestRepository) GetAll(limit, offset int) ([]types.Request, error) {
	var requests []types.Request
	err := r.db.Limit(limit).Offset(offset).Order("created_at DESC").Find(&requests).Error
	return requests, err
}

// GetByModel retrieves all requests for a specific model
func (r *RequestRepository) GetByModel(model string, limit, offset int) ([]types.Request, error) {
	var requests []types.Request
	err := r.db.Where("model = ?", model).
		Limit(limit).
		Offset(offset).
		Order("created_at DESC").
		Find(&requests).Error
	return requests, err
}

// GetByStatus retrieves all requests with a specific status
func (r *RequestRepository) GetByStatus(status string, limit, offset int) ([]types.Request, error) {
	var requests []types.Request
	err := r.db.Where("status = ?", status).
		Limit(limit).
		Offset(offset).
		Order("created_at DESC").
		Find(&requests).Error
	return requests, err
}

// Update updates an existing request
func (r *RequestRepository) Update(request *types.Request) error {
	return r.db.Save(request).Error
}

// Delete soft deletes a request
func (r *RequestRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&types.Request{}, "id = ?", id).Error
}

// Count returns the total number of requests
func (r *RequestRepository) Count() (int64, error) {
	var count int64
	err := r.db.Model(&types.Request{}).Count(&count).Error
	return count, err
}

// GetStats returns statistics about requests
func (r *RequestRepository) GetStats() (map[string]interface{}, error) {
	var totalRequests int64
	var totalTokens int64
	var totalCost float64
	var avgLatency float64
	var cacheHitCount int64

	// Count total requests
	if err := r.db.Model(&types.Request{}).Count(&totalRequests).Error; err != nil {
		return nil, err
	}

	// Sum total tokens
	if err := r.db.Model(&types.Request{}).Select("COALESCE(SUM(tokens_total), 0)").Scan(&totalTokens).Error; err != nil {
		return nil, err
	}

	// Sum total cost
	if err := r.db.Model(&types.Request{}).Select("COALESCE(SUM(cost), 0)").Scan(&totalCost).Error; err != nil {
		return nil, err
	}

	// Calculate average latency
	if err := r.db.Model(&types.Request{}).Select("COALESCE(AVG(latency), 0)").Scan(&avgLatency).Error; err != nil {
		return nil, err
	}

	// Count cache hits
	if err := r.db.Model(&types.Request{}).Where("cache_hit = ?", true).Count(&cacheHitCount).Error; err != nil {
		return nil, err
	}

	// Calculate cache hit rate
	cacheHitRate := 0.0
	if totalRequests > 0 {
		cacheHitRate = float64(cacheHitCount) / float64(totalRequests) * 100
	}

	stats := map[string]interface{}{
		"total_requests": totalRequests,
		"total_tokens":   totalTokens,
		"total_cost":     totalCost,
		"avg_latency_ms": avgLatency,
		"cache_hits":     cacheHitCount,
		"cache_hit_rate": cacheHitRate,
	}

	return stats, nil
}

// GetRequestsByDateRange retrieves requests within a date range
func (r *RequestRepository) GetRequestsByDateRange(startDate, endDate time.Time, limit, offset int) ([]types.Request, error) {
	var requests []types.Request
	err := r.db.Where("created_at BETWEEN ? AND ?", startDate, endDate).
		Limit(limit).
		Offset(offset).
		Order("created_at DESC").
		Find(&requests).Error
	return requests, err
}
