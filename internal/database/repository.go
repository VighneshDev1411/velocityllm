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

// ModelStats holds aggregated stats per model from the requests table
type ModelStats struct {
	Model        string    `json:"model"`
	Provider     string    `json:"provider"`
	RequestCount int64     `json:"request_count"`
	SuccessCount int64     `json:"success_count"`
	ErrorCount   int64     `json:"error_count"`
	AvgLatencyMs float64   `json:"avg_latency_ms"`
	TotalCost    float64   `json:"total_cost"`
	AvgCost      float64   `json:"avg_cost"`
	LastUsed     time.Time `json:"last_used"`
}

// GetModelStats returns per-model aggregated stats from the DB
func (r *RequestRepository) GetModelStats() ([]ModelStats, error) {
	query := `
		SELECT
			model,
			provider,
			COUNT(*) AS request_count,
			SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_count,
			SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS error_count,
			COALESCE(AVG(latency), 0) AS avg_latency_ms,
			COALESCE(SUM(cost), 0) AS total_cost,
			COALESCE(AVG(cost), 0) AS avg_cost,
			MAX(created_at) AS last_used
		FROM requests
		WHERE deleted_at IS NULL
		GROUP BY model, provider
		ORDER BY request_count DESC`
	var stats []ModelStats
	result := r.db.Raw(query).Scan(&stats)
	return stats, result.Error
}

// OverallLatencyStats holds overall latency percentiles from the DB
type OverallLatencyStats struct {
	P50Ms  float64 `json:"p50_ms"`
	P90Ms  float64 `json:"p90_ms"`
	P95Ms  float64 `json:"p95_ms"`
	P99Ms  float64 `json:"p99_ms"`
	MeanMs float64 `json:"mean_ms"`
	MinMs  float64 `json:"min_ms"`
	MaxMs  float64 `json:"max_ms"`
	Count  int64   `json:"count"`
}

// GetOverallLatencyStats returns latency percentiles computed over all requests in the DB
func (r *RequestRepository) GetOverallLatencyStats() (OverallLatencyStats, error) {
	query := `
		SELECT
			COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency), 0) AS p50_ms,
			COALESCE(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY latency), 0) AS p90_ms,
			COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency), 0) AS p95_ms,
			COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency), 0) AS p99_ms,
			COALESCE(AVG(latency), 0) AS mean_ms,
			COALESCE(MIN(latency), 0) AS min_ms,
			COALESCE(MAX(latency), 0) AS max_ms,
			COUNT(*) AS count
		FROM requests
		WHERE deleted_at IS NULL`
	var stats OverallLatencyStats
	result := r.db.Raw(query).Scan(&stats)
	return stats, result.Error
}

// GetFiltered retrieves requests with optional model and status filters, returning total count
func (r *RequestRepository) GetFiltered(model, status string, limit, offset int) ([]types.Request, int64, error) {
	var requests []types.Request
	var total int64
	q := r.db.Model(&types.Request{})
	if model != "" {
		q = q.Where("model = ?", model)
	}
	if status != "" {
		q = q.Where("status = ?", status)
	}
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := q.Limit(limit).Offset(offset).Order("created_at DESC").Find(&requests).Error
	return requests, total, err
}

// TimeSeriesBucket holds aggregated metrics for a time bucket
type TimeSeriesBucket struct {
	BucketTime   time.Time `json:"time"`
	Requests     int64     `json:"requests"`
	Errors       int64     `json:"errors"`
	AvgLatencyMs float64   `json:"avg_latency_ms"`
	P50Ms        float64   `json:"p50_ms"`
	P90Ms        float64   `json:"p90_ms"`
	P95Ms        float64   `json:"p95_ms"`
	P99Ms        float64   `json:"p99_ms"`
	TotalCost    float64   `json:"total_cost"`
}

// GetTimeSeriesAggregation returns aggregated request metrics bucketed by time
func (r *RequestRepository) GetTimeSeriesAggregation(start, end time.Time, truncUnit string) ([]TimeSeriesBucket, error) {
	query := `
		SELECT
			date_trunc($1, created_at) AS bucket_time,
			COUNT(*) AS requests,
			SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errors,
			COALESCE(AVG(latency), 0) AS avg_latency_ms,
			COALESCE(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY latency), 0) AS p50_ms,
			COALESCE(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY latency), 0) AS p90_ms,
			COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency), 0) AS p95_ms,
			COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY latency), 0) AS p99_ms,
			COALESCE(SUM(cost), 0) AS total_cost
		FROM requests
		WHERE created_at BETWEEN $2 AND $3
		  AND deleted_at IS NULL
		GROUP BY date_trunc($1, created_at)
		ORDER BY bucket_time ASC`
	var buckets []TimeSeriesBucket
	result := r.db.Raw(query, truncUnit, start, end).Scan(&buckets)
	return buckets, result.Error
}
