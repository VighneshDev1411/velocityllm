package types

import (
	"encoding/json"
	"net/http"
	"time"
)

// SuccessResponse represents a successful API response
type SuccessResponse struct {
	Success   bool        `json:"success"`
	Message   string      `json:"message,omitempty"`
	Data      interface{} `json:"data,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
}

// ErrorResponse represents an error API response
type ErrorResponse struct {
	Success   bool                   `json:"success"`
	Error     string                 `json:"error"`
	Message   string                 `json:"message,omitempty"`
	Code      string                 `json:"code,omitempty"`
	Details   map[string]interface{} `json:"details,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

// PaginatedResponse represents a paginated response
type PaginatedResponse struct {
	Success    bool        `json:"success"`
	Data       interface{} `json:"data"`
	Pagination Pagination  `json:"pagination"`
	Timestamp  time.Time   `json:"timestamp"`
}

// Pagination holds pagination metadata
type Pagination struct {
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	TotalPages int   `json:"total_pages"`
	TotalItems int64 `json:"total_items"`
	HasNext    bool  `json:"has_next"`
	HasPrev    bool  `json:"has_prev"`
}

// HealthResponse represents a health check response
type HealthResponse struct {
	Status    string                 `json:"status"`
	Service   string                 `json:"service"`
	Version   string                 `json:"version"`
	Uptime    int64                  `json:"uptime_seconds"`
	Timestamp time.Time              `json:"timestamp"`
	Checks    map[string]HealthCheck `json:"checks,omitempty"`
}

// HealthCheck represents an individual health check
type HealthCheck struct {
	Status  string                 `json:"status"`
	Message string                 `json:"message,omitempty"`
	Details map[string]interface{} `json:"details,omitempty"`
}

// MetricsResponse represents a metrics response
type MetricsResponse struct {
	Success   bool                   `json:"success"`
	Metrics   map[string]interface{} `json:"metrics"`
	Timestamp time.Time              `json:"timestamp"`
}

// NewSuccessResponse creates a new success response
func NewSuccessResponse(data interface{}, message string) SuccessResponse {
	return SuccessResponse{
		Success:   true,
		Message:   message,
		Data:      data,
		Timestamp: time.Now(),
	}
}

// NewErrorResponse creates a new error response
func NewErrorResponse(error, message string) ErrorResponse {
	return ErrorResponse{
		Success:   false,
		Error:     error,
		Message:   message,
		Timestamp: time.Now(),
	}
}

// NewErrorResponseWithCode creates a new error response with error code
func NewErrorResponseWithCode(error, message, code string) ErrorResponse {
	return ErrorResponse{
		Success:   false,
		Error:     error,
		Message:   message,
		Code:      code,
		Timestamp: time.Now(),
	}
}

// NewErrorResponseWithDetails creates a new error response with details
func NewErrorResponseWithDetails(error, message string, details map[string]interface{}) ErrorResponse {
	return ErrorResponse{
		Success:   false,
		Error:     error,
		Message:   message,
		Details:   details,
		Timestamp: time.Now(),
	}
}

// NewPaginatedResponse creates a new paginated response
func NewPaginatedResponse(data interface{}, page, pageSize int, totalItems int64) PaginatedResponse {
	totalPages := int((totalItems + int64(pageSize) - 1) / int64(pageSize))

	return PaginatedResponse{
		Success: true,
		Data:    data,
		Pagination: Pagination{
			Page:       page,
			PageSize:   pageSize,
			TotalPages: totalPages,
			TotalItems: totalItems,
			HasNext:    page < totalPages,
			HasPrev:    page > 1,
		},
		Timestamp: time.Now(),
	}
}

// NewHealthResponse creates a new health response
func NewHealthResponse(service, version string, uptime int64) HealthResponse {
	return HealthResponse{
		Status:    "healthy",
		Service:   service,
		Version:   version,
		Uptime:    uptime,
		Timestamp: time.Now(),
		Checks:    make(map[string]HealthCheck),
	}
}

// AddCheck adds a health check to the response
func (h *HealthResponse) AddCheck(name, status, message string) {
	if h.Checks == nil {
		h.Checks = make(map[string]HealthCheck)
	}

	h.Checks[name] = HealthCheck{
		Status:  status,
		Message: message,
	}

	// Update overall status based on checks
	if status == "unhealthy" || status == "critical" {
		h.Status = "unhealthy"
	} else if status == "degraded" && h.Status == "healthy" {
		h.Status = "degraded"
	}
}

// AddCheckWithDetails adds a health check with details
func (h *HealthResponse) AddCheckWithDetails(name, status, message string, details map[string]interface{}) {
	if h.Checks == nil {
		h.Checks = make(map[string]HealthCheck)
	}

	h.Checks[name] = HealthCheck{
		Status:  status,
		Message: message,
		Details: details,
	}

	// Update overall status
	if status == "unhealthy" || status == "critical" {
		h.Status = "unhealthy"
	} else if status == "degraded" && h.Status == "healthy" {
		h.Status = "degraded"
	}
}

// Common error codes
const (
	ErrCodeBadRequest            = "BAD_REQUEST"
	ErrCodeUnauthorized          = "UNAUTHORIZED"
	ErrCodeForbidden             = "FORBIDDEN"
	ErrCodeNotFound              = "NOT_FOUND"
	ErrCodeConflict              = "CONFLICT"
	ErrCodeValidation            = "VALIDATION_ERROR"
	ErrCodeRateLimit             = "RATE_LIMIT_EXCEEDED"
	ErrCodeInternalServer        = "INTERNAL_SERVER_ERROR"
	ErrCodeServiceUnavailable    = "SERVICE_UNAVAILABLE"
	ErrCodeStreamNotFound        = "STREAM_NOT_FOUND"
	ErrCodeStreamCancelled       = "STREAM_CANCELLED"
	ErrCodeStreamError           = "STREAM_ERROR"
	ErrCodeMaxConnectionsReached = "MAX_CONNECTIONS_REACHED"
)

// ValidationError represents a validation error
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Value   string `json:"value,omitempty"`
}

// ValidationErrorResponse represents a response with validation errors
type ValidationErrorResponse struct {
	Success   bool              `json:"success"`
	Error     string            `json:"error"`
	Message   string            `json:"message"`
	Errors    []ValidationError `json:"errors"`
	Timestamp time.Time         `json:"timestamp"`
}

// NewValidationErrorResponse creates a validation error response
func NewValidationErrorResponse(errors []ValidationError) ValidationErrorResponse {
	return ValidationErrorResponse{
		Success:   false,
		Error:     "Validation failed",
		Message:   "One or more fields failed validation",
		Errors:    errors,
		Timestamp: time.Now(),
	}
}

// StreamEventResponse represents a streaming event in API format
type StreamEventResponse struct {
	EventID   string                 `json:"event_id"`
	EventType string                 `json:"event_type"`
	StreamID  string                 `json:"stream_id"`
	Data      map[string]interface{} `json:"data"`
	Timestamp time.Time              `json:"timestamp"`
}

// StreamStatusResponse represents a stream status response
type StreamStatusResponse struct {
	Success   bool                   `json:"success"`
	StreamID  string                 `json:"stream_id"`
	Status    string                 `json:"status"`
	Details   map[string]interface{} `json:"details"`
	Timestamp time.Time              `json:"timestamp"`
}

// NewStreamStatusResponse creates a new stream status response
func NewStreamStatusResponse(streamID, status string, details map[string]interface{}) StreamStatusResponse {
	return StreamStatusResponse{
		Success:   true,
		StreamID:  streamID,
		Status:    status,
		Details:   details,
		Timestamp: time.Now(),
	}
}

// BatchResponse represents a batch operation response
type BatchResponse struct {
	Success      bool              `json:"success"`
	TotalItems   int               `json:"total_items"`
	SuccessCount int               `json:"success_count"`
	FailureCount int               `json:"failure_count"`
	Results      []BatchItemResult `json:"results"`
	Timestamp    time.Time         `json:"timestamp"`
}

// BatchItemResult represents the result of a single item in a batch
type BatchItemResult struct {
	Index   int         `json:"index"`
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// NewBatchResponse creates a new batch response
func NewBatchResponse(totalItems, successCount, failureCount int, results []BatchItemResult) BatchResponse {
	return BatchResponse{
		Success:      failureCount == 0,
		TotalItems:   totalItems,
		SuccessCount: successCount,
		FailureCount: failureCount,
		Results:      results,
		Timestamp:    time.Now(),
	}
}

// StatsResponse represents system statistics response
type StatsResponse struct {
	Success    bool                   `json:"success"`
	Stats      map[string]interface{} `json:"stats"`
	Categories map[string]interface{} `json:"categories,omitempty"`
	Timestamp  time.Time              `json:"timestamp"`
}

// NewStatsResponse creates a new stats response
func NewStatsResponse(stats map[string]interface{}) StatsResponse {
	return StatsResponse{
		Success:   true,
		Stats:     stats,
		Timestamp: time.Now(),
	}
}

// AddCategory adds a category to stats response
func (s *StatsResponse) AddCategory(name string, data interface{}) {
	if s.Categories == nil {
		s.Categories = make(map[string]interface{})
	}
	s.Categories[name] = data
}

// HTTP Response Utility Functions

// WriteJSON writes a JSON response with the given status code
func WriteJSON(w http.ResponseWriter, status int, data interface{}) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(data)
}

// WriteSuccess writes a successful JSON response
func WriteSuccess(w http.ResponseWriter, message string, data interface{}) error {
	response := SuccessResponse{
		Success:   true,
		Message:   message,
		Data:      data,
		Timestamp: time.Now(),
	}
	return WriteJSON(w, http.StatusOK, response)
}

// WriteError writes an error JSON response
func WriteError(w http.ResponseWriter, status int, message string) error {
	response := ErrorResponse{
		Success:   false,
		Error:     message,
		Timestamp: time.Now(),
	}
	return WriteJSON(w, status, response)
}
