package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/VighneshDev1411/velocityllm/internal/webhooks"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// ============================================
// WEBHOOK MANAGEMENT ENDPOINTS (Day 24)
// ============================================

func CreateWebhookHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID := r.Context().Value("user_id").(string)
	uid, _ := strconv.ParseUint(userID, 10, 32)

	var req struct {
		Name        string   `json:"name"`
		URL         string   `json:"url"`
		Secret      string   `json:"secret"`
		Events      []string `json:"events"`
		Description string   `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" || req.URL == "" || len(req.Events) == 0 {
		types.WriteError(w, http.StatusBadRequest, "Name, URL, and at least one event are required")
		return
	}

	endpoint := &webhooks.WebhookEndpoint{
		UserID:      uint(uid),
		Name:        req.Name,
		URL:         req.URL,
		Secret:      req.Secret,
		Events:      strings.Join(req.Events, ","),
		Active:      true,
		Description: req.Description,
	}

	service := webhooks.GetGlobalService()
	if err := service.CreateEndpoint(endpoint); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to create webhook")
		return
	}

	types.WriteSuccess(w, "Webhook created successfully", map[string]interface{}{
		"endpoint": endpoint,
	})
}

func ListWebhooksHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID := r.Context().Value("user_id").(string)
	uid, _ := strconv.ParseUint(userID, 10, 32)

	service := webhooks.GetGlobalService()
	endpoints, err := service.ListEndpoints(uint(uid))
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to fetch webhooks")
		return
	}

	types.WriteSuccess(w, "Webhooks retrieved", map[string]interface{}{
		"endpoints": endpoints,
	})
}

func UpdateWebhookHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID := r.Context().Value("user_id").(string)
	uid, _ := strconv.ParseUint(userID, 10, 32)

	var req struct {
		ID          uint     `json:"id"`
		Name        string   `json:"name"`
		URL         string   `json:"url"`
		Secret      string   `json:"secret"`
		Events      []string `json:"events"`
		Description string   `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	service := webhooks.GetGlobalService()
	endpoint, err := service.GetEndpoint(req.ID, uint(uid))
	if err != nil {
		types.WriteError(w, http.StatusNotFound, "Webhook not found")
		return
	}

	endpoint.Name = req.Name
	endpoint.URL = req.URL
	endpoint.Secret = req.Secret
	endpoint.Events = strings.Join(req.Events, ",")
	endpoint.Description = req.Description

	if err := service.UpdateEndpoint(endpoint); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to update webhook")
		return
	}

	types.WriteSuccess(w, "Webhook updated successfully", map[string]interface{}{
		"endpoint": endpoint,
	})
}

func DeleteWebhookHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID := r.Context().Value("user_id").(string)
	uid, _ := strconv.ParseUint(userID, 10, 32)

	idStr := r.URL.Query().Get("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid webhook ID")
		return
	}

	service := webhooks.GetGlobalService()
	if err := service.DeleteEndpoint(uint(id), uint(uid)); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to delete webhook")
		return
	}

	types.WriteSuccess(w, "Webhook deleted successfully", nil)
}

func ToggleWebhookHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID := r.Context().Value("user_id").(string)
	uid, _ := strconv.ParseUint(userID, 10, 32)

	var req struct {
		ID     uint `json:"id"`
		Active bool `json:"active"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	service := webhooks.GetGlobalService()
	if err := service.ToggleEndpoint(req.ID, uint(uid), req.Active); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to toggle webhook")
		return
	}

	types.WriteSuccess(w, "Webhook toggled successfully", nil)
}

func GetWebhookDeliveriesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	endpointIDStr := r.URL.Query().Get("endpoint_id")
	endpointID, err := strconv.ParseUint(endpointIDStr, 10, 32)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid endpoint ID")
		return
	}

	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	service := webhooks.GetGlobalService()
	deliveries, err := service.GetDeliveries(uint(endpointID), limit)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to fetch deliveries")
		return
	}

	types.WriteSuccess(w, "Deliveries retrieved", map[string]interface{}{
		"deliveries": deliveries,
	})
}

func GetEventLogsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID := r.Context().Value("user_id").(string)
	uid, _ := strconv.ParseUint(userID, 10, 32)

	limitStr := r.URL.Query().Get("limit")
	limit := 50
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	service := webhooks.GetGlobalService()
	logs, err := service.GetEventLogs(uint(uid), limit)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to fetch event logs")
		return
	}

	types.WriteSuccess(w, "Event logs retrieved", map[string]interface{}{
		"events": logs,
	})
}

func GetWebhookStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID := r.Context().Value("user_id").(string)
	uid, _ := strconv.ParseUint(userID, 10, 32)

	service := webhooks.GetGlobalService()
	stats, err := service.GetDeliveryStats(uint(uid))
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to fetch stats")
		return
	}

	types.WriteSuccess(w, "Webhook stats retrieved", stats)
}

func GetAvailableEventsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	events := []map[string]string{
		{"type": "request.completed", "description": "When an LLM request completes successfully"},
		{"type": "request.failed", "description": "When an LLM request fails"},
		{"type": "quota.warning", "description": "When quota usage reaches warning threshold"},
		{"type": "quota.exceeded", "description": "When quota limit is exceeded"},
		{"type": "apikey.created", "description": "When a new API key is created"},
		{"type": "apikey.revoked", "description": "When an API key is revoked"},
		{"type": "user.created", "description": "When a new user is created"},
		{"type": "user.deleted", "description": "When a user is deleted"},
		{"type": "subscription.changed", "description": "When subscription tier changes"},
		{"type": "system.alert", "description": "System-level alerts"},
		{"type": "loadtest.completed", "description": "When a load test completes"},
		{"type": "model.down", "description": "When an LLM provider goes down"},
		{"type": "model.recovered", "description": "When an LLM provider recovers"},
	}

	types.WriteSuccess(w, "Available events", map[string]interface{}{
		"events": events,
	})
}
