package types

import (
	"encoding/json"
	"net/http"
	"time"
)

// StandardResponse is the base structure for all API responses
type StandardResponse struct {
	Success   bool        `json:"success"`
	Message   string      `json:"message,omitempty"`
	Data      interface{} `json:"data,omitempty"`
	Error     string      `json:"error,omitempty"`
	Timestamp time.Time   `json:"timestamp"`
}

// HealthResponse represents the health check response
type HealthResponse struct {
	Status    string            `json:"status"`
	Version   string            `json:"version"`
	Uptime    string            `json:"uptime"`
	Timestamp time.Time         `json:"timestamp"`
	Services  map[string]string `json:"services"`
}

// ErrorResponse represents an error response
type ErrorResponse struct {
	Success   bool      `json:"success"`
	Error     string    `json:"error"`
	Code      string    `json:"code,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// WriteJSON writes a JSON response with the given status code
func WriteJSON(w http.ResponseWriter, status int, data interface{}) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	return json.NewEncoder(w).Encode(data)
}

// WriteSuccess writes a successful JSON response
func WriteSuccess(w http.ResponseWriter, message string, data interface{}) error {
	response := StandardResponse{
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