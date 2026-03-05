package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/VighneshDev1411/velocityllm/internal/notifications"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// ListNotificationsHandler returns notifications for a user
func ListNotificationsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	svc := notifications.GetService()
	userID := r.URL.Query().Get("user_id")
	unreadOnly := r.URL.Query().Get("unread_only") == "true"
	limit := 50
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && l > 0 {
		limit = l
	}

	notifs := svc.GetNotifications(userID, unreadOnly, limit)
	types.WriteSuccess(w, "Notifications retrieved", map[string]interface{}{
		"notifications": notifs,
		"unread_count":  svc.GetUnreadCount(userID),
	})
}

// MarkNotificationReadHandler marks a notification as read
func MarkNotificationReadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		NotificationID string `json:"notification_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	svc := notifications.GetService()
	if svc.MarkRead(req.NotificationID) {
		types.WriteSuccess(w, "Notification marked as read", nil)
	} else {
		types.WriteError(w, http.StatusNotFound, "Notification not found")
	}
}

// MarkAllReadHandler marks all notifications as read
func MarkAllReadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		UserID string `json:"user_id"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	svc := notifications.GetService()
	count := svc.MarkAllRead(req.UserID)
	types.WriteSuccess(w, "All notifications marked as read", map[string]interface{}{
		"marked_count": count,
	})
}

// DeleteNotificationHandler deletes a notification
func DeleteNotificationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	id := r.URL.Query().Get("id")
	if id == "" {
		types.WriteError(w, http.StatusBadRequest, "Missing notification id")
		return
	}

	svc := notifications.GetService()
	if svc.DeleteNotification(id) {
		types.WriteSuccess(w, "Notification deleted", nil)
	} else {
		types.WriteError(w, http.StatusNotFound, "Notification not found")
	}
}

// SendNotificationHandler creates a new notification (admin/system use)
func SendNotificationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		UserID    string `json:"user_id"`
		Title     string `json:"title"`
		Message   string `json:"message"`
		Severity  string `json:"severity"`
		Category  string `json:"category"`
		ActionURL string `json:"action_url"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Title == "" || req.Message == "" {
		types.WriteError(w, http.StatusBadRequest, "Title and message are required")
		return
	}
	if req.Severity == "" {
		req.Severity = notifications.SeverityInfo
	}
	if req.Category == "" {
		req.Category = notifications.CategorySystem
	}

	svc := notifications.GetService()
	n := svc.Send(req.UserID, req.Title, req.Message, req.Severity, req.Category, req.ActionURL)
	types.WriteSuccess(w, "Notification sent", n)
}

// GetNotificationPreferencesHandler returns notification preferences
func GetNotificationPreferencesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID := r.URL.Query().Get("user_id")
	svc := notifications.GetService()
	prefs := svc.GetPreferences(userID)
	types.WriteSuccess(w, "Preferences retrieved", prefs)
}

// UpdateNotificationPreferencesHandler updates notification preferences
func UpdateNotificationPreferencesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var prefs notifications.NotificationPreferences
	if err := json.NewDecoder(r.Body).Decode(&prefs); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	svc := notifications.GetService()
	svc.UpdatePreferences(&prefs)
	types.WriteSuccess(w, "Preferences updated", prefs)
}

// GetNotificationStatsHandler returns notification statistics
func GetNotificationStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	svc := notifications.GetService()
	stats := svc.GetStats()
	types.WriteSuccess(w, "Notification stats", stats)
}
