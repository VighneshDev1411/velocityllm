package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/VighneshDev1411/velocityllm/internal/database"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/google/uuid"
)

// CreateRequestHandler creates a new request
func CreateRequestHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var request types.Request
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate required fields
	if request.Model == "" || request.Prompt == "" {
		types.WriteError(w, http.StatusBadRequest, "Model and prompt are required")
		return
	}

	// Set default status
	if request.Status == "" {
		request.Status = "pending"
	}

	// Create repository and save
	repo := database.NewRequestRepository()
	if err := repo.Create(&request); err != nil {
		utils.Error("Failed to create request: %v", err)
		types.WriteError(w, http.StatusInternalServerError, "Failed to create request")
		return
	}

	types.WriteSuccess(w, "Request created successfully", request)
}

// GetRequestHandler retrieves a single request by ID
func GetRequestHandler(w http.ResponseWriter, r *http.Request) {
	// Extract ID from query parameter
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		types.WriteError(w, http.StatusBadRequest, "Request ID is required")
		return
	}

	// Parse UUID
	id, err := uuid.Parse(idStr)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request ID format")
		return
	}

	// Get request from database
	repo := database.NewRequestRepository()
	request, err := repo.GetByID(id)
	if err != nil {
		types.WriteError(w, http.StatusNotFound, "Request not found")
		return
	}

	types.WriteSuccess(w, "Request retrieved successfully", request)
}

// ListRequestsHandler retrieves all requests with pagination
func ListRequestsHandler(w http.ResponseWriter, r *http.Request) {
	// Get pagination parameters
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	limit := 10 // default
	offset := 0 // default

	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	if offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	// Limit max results per page
	if limit > 100 {
		limit = 100
	}

	// Get requests from database
	repo := database.NewRequestRepository()
	requests, err := repo.GetAll(limit, offset)
	if err != nil {
		utils.Error("Failed to retrieve requests: %v", err)
		types.WriteError(w, http.StatusInternalServerError, "Failed to retrieve requests")
		return
	}

	// Get total count
	totalCount, err := repo.Count()
	if err != nil {
		utils.Error("Failed to count requests: %v", err)
		totalCount = 0
	}

	// Build response with pagination metadata
	response := map[string]interface{}{
		"requests": requests,
		"pagination": map[string]interface{}{
			"limit":  limit,
			"offset": offset,
			"total":  totalCount,
		},
	}

	types.WriteSuccess(w, "Requests retrieved successfully", response)
}

// GetRequestStatsHandler returns statistics about requests
func GetRequestStatsHandler(w http.ResponseWriter, r *http.Request) {
	repo := database.NewRequestRepository()
	stats, err := repo.GetStats()
	if err != nil {
		utils.Error("Failed to get stats: %v", err)
		types.WriteError(w, http.StatusInternalServerError, "Failed to retrieve statistics")
		return
	}

	types.WriteSuccess(w, "Statistics retrieved successfully", stats)
}

// UpdateRequestHandler updates an existing request
func UpdateRequestHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut && r.Method != http.MethodPatch {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Extract ID from query parameter
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		types.WriteError(w, http.StatusBadRequest, "Request ID is required")
		return
	}

	// Parse UUID
	id, err := uuid.Parse(idStr)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request ID format")
		return
	}

	// Get existing request
	repo := database.NewRequestRepository()
	existingRequest, err := repo.GetByID(id)
	if err != nil {
		types.WriteError(w, http.StatusNotFound, "Request not found")
		return
	}

	// Decode update data
	var updateData types.Request
	if err := json.NewDecoder(r.Body).Decode(&updateData); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Update fields (keep existing ID and timestamps)
	updateData.ID = existingRequest.ID
	updateData.CreatedAt = existingRequest.CreatedAt

	// Save updated request
	if err := repo.Update(&updateData); err != nil {
		utils.Error("Failed to update request: %v", err)
		types.WriteError(w, http.StatusInternalServerError, "Failed to update request")
		return
	}

	types.WriteSuccess(w, "Request updated successfully", updateData)
}

// DeleteRequestHandler deletes a request
func DeleteRequestHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Extract ID from query parameter
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		types.WriteError(w, http.StatusBadRequest, "Request ID is required")
		return
	}

	// Parse UUID
	id, err := uuid.Parse(idStr)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request ID format")
		return
	}

	// Delete request
	repo := database.NewRequestRepository()
	if err := repo.Delete(id); err != nil {
		utils.Error("Failed to delete request: %v", err)
		types.WriteError(w, http.StatusInternalServerError, "Failed to delete request")
		return
	}

	types.WriteSuccess(w, "Request deleted successfully", nil)
}
