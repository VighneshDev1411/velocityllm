package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/VighneshDev1411/velocityllm/internal/database"
	"github.com/VighneshDev1411/velocityllm/internal/quota"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// ============================================
// USER QUOTA ENDPOINTS (Day 22)
// ============================================

// GetMyQuotaUsageHandler returns current user's quota usage
func GetMyQuotaUsageHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Get user ID from context (set by auth middleware)
	userID := r.Context().Value("user_id").(string)
	uid, err := strconv.ParseUint(userID, 10, 32)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	service := quota.GetGlobalService()
	usage, err := service.GetQuotaUsage(uint(uid))
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to fetch quota usage")
		return
	}

	types.WriteSuccess(w, "Quota usage retrieved", map[string]interface{}{
		"usage": usage,
	})
}

// GetMyQuotasHandler returns current user's custom quotas
func GetMyQuotasHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID := r.Context().Value("user_id").(string)
	uid, err := strconv.ParseUint(userID, 10, 32)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	service := quota.GetGlobalService()
	quotas, err := service.GetUserQuotas(uint(uid))
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to fetch quotas")
		return
	}

	types.WriteSuccess(w, "Quotas retrieved", map[string]interface{}{
		"quotas": quotas,
	})
}

// GetMyAlertConfigHandler returns current user's alert configuration
func GetMyAlertConfigHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID := r.Context().Value("user_id").(string)
	uid, err := strconv.ParseUint(userID, 10, 32)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	service := quota.GetGlobalService()
	config, err := service.GetAlertConfiguration(uint(uid))
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to fetch alert configuration")
		return
	}

	types.WriteSuccess(w, "Alert configuration retrieved", config)
}

// UpdateMyAlertConfigHandler updates current user's alert configuration
func UpdateMyAlertConfigHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID := r.Context().Value("user_id").(string)
	uid, err := strconv.ParseUint(userID, 10, 32)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var config quota.AlertConfiguration
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	service := quota.GetGlobalService()
	if err := service.UpdateAlertConfiguration(uint(uid), &config); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to update alert configuration")
		return
	}

	types.WriteSuccess(w, "Alert configuration updated successfully", map[string]interface{}{
		"config": config,
	})
}

// GetMyRateLimitEventsHandler returns recent rate limit events for current user
func GetMyRateLimitEventsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID := r.Context().Value("user_id").(string)
	uid, err := strconv.ParseUint(userID, 10, 32)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	limitStr := r.URL.Query().Get("limit")
	limit := 20
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	service := quota.GetGlobalService()
	events, err := service.GetRateLimitEvents(uint(uid), limit)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to fetch rate limit events")
		return
	}

	types.WriteSuccess(w, "Rate limit events retrieved", map[string]interface{}{
		"events": events,
	})
}

// ============================================
// ADMIN QUOTA ENDPOINTS (Day 22)
// ============================================

// AdminSetUserQuotaHandler sets a custom quota for a user (admin only)
func AdminSetUserQuotaHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Get admin ID from context
	adminID := r.Context().Value("user_id").(string)
	aid, err := strconv.ParseUint(adminID, 10, 32)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid admin ID")
		return
	}

	var req struct {
		UserID uint              `json:"user_id"`
		Type   quota.QuotaType   `json:"type"`
		Period quota.QuotaPeriod `json:"period"`
		Limit  int64             `json:"limit"`
		Reason string            `json:"reason"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.UserID == 0 || req.Limit < 0 {
		types.WriteError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	service := quota.GetGlobalService()
	if err := service.SetCustomQuota(req.UserID, uint(aid), req.Type, req.Period, req.Limit, req.Reason); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to set custom quota")
		return
	}

	types.WriteSuccess(w, "Custom quota set successfully", nil)
}

// AdminGetUserQuotasHandler returns all quotas for a specific user (admin only)
func AdminGetUserQuotasHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userIDStr := r.URL.Query().Get("user_id")
	userID, err := strconv.ParseUint(userIDStr, 10, 32)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	service := quota.GetGlobalService()
	quotas, err := service.GetUserQuotas(uint(userID))
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to fetch quotas")
		return
	}

	usage, err := service.GetQuotaUsage(uint(userID))
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to fetch usage")
		return
	}

	types.WriteSuccess(w, "User quotas retrieved", map[string]interface{}{
		"quotas": quotas,
		"usage":  usage,
	})
}

// AdminGetAllQuotasHandler returns all custom quotas (admin only, paginated)
func AdminGetAllQuotasHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	pageStr := r.URL.Query().Get("page")
	limitStr := r.URL.Query().Get("limit")

	page := 1
	limit := 20

	if pageStr != "" {
		if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
			page = p
		}
	}

	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	offset := (page - 1) * limit

	var quotas []quota.UserQuota
	var total int64

	db := database.GetDB()
	if err := db.Model(&quota.UserQuota{}).Count(&total).Error; err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to count quotas")
		return
	}

	if err := db.Offset(offset).Limit(limit).Order("created_at DESC").Find(&quotas).Error; err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to fetch quotas")
		return
	}

	totalPages := (total + int64(limit) - 1) / int64(limit)

	types.WriteSuccess(w, "All quotas retrieved", map[string]interface{}{
		"quotas":      quotas,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
	})
}

// AdminDeleteUserQuotaHandler removes a custom quota (admin only)
func AdminDeleteUserQuotaHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	quotaIDStr := r.URL.Query().Get("quota_id")
	quotaID, err := strconv.ParseUint(quotaIDStr, 10, 32)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid quota ID")
		return
	}

	db := database.GetDB()
	if err := db.Delete(&quota.UserQuota{}, quotaID).Error; err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to delete quota")
		return
	}

	types.WriteSuccess(w, "Quota deleted successfully", nil)
}

// AdminGetRateLimitStatsHandler returns rate limit statistics (admin only)
func AdminGetRateLimitStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var stats struct {
		TotalEvents   int64 `json:"total_events"`
		BlockedEvents int64 `json:"blocked_events"`
		Last24h       int64 `json:"last_24h"`
	}

	db := database.GetDB()

	// Total events
	db.Model(&quota.RateLimitEvent{}).Count(&stats.TotalEvents)

	// Blocked events
	db.Model(&quota.RateLimitEvent{}).Where("blocked = ?", true).Count(&stats.BlockedEvents)

	// Last 24h
	db.Model(&quota.RateLimitEvent{}).
		Where("created_at > NOW() - INTERVAL '24 hours'").
		Count(&stats.Last24h)

	// Top blocked users
	type UserBlock struct {
		UserID uint  `json:"user_id"`
		Count  int64 `json:"count"`
	}
	var topBlocked []UserBlock

	db.Model(&quota.RateLimitEvent{}).
		Select("user_id, COUNT(*) as count").
		Where("blocked = ?", true).
		Group("user_id").
		Order("count DESC").
		Limit(10).
		Scan(&topBlocked)

	types.WriteSuccess(w, "Rate limit statistics retrieved", map[string]interface{}{
		"stats":       stats,
		"top_blocked": topBlocked,
	})
}
