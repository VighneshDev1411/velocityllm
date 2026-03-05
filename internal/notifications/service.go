package notifications

import (
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/VighneshDev1411/velocityllm/internal/websocket"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"encoding/json"
)

// Severity levels
const (
	SeverityInfo    = "info"
	SeveritySuccess = "success"
	SeverityWarning = "warning"
	SeverityError   = "error"
)

// Categories
const (
	CategorySystem  = "system"
	CategoryAPI     = "api"
	CategoryBilling = "billing"
	CategoryQuota   = "quota"
	CategoryModel   = "model"
	CategoryJob     = "job"
	CategoryAlert   = "alert"
)

// Notification represents a single notification
type Notification struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	Severity  string    `json:"severity"`
	Category  string    `json:"category"`
	Read      bool      `json:"read"`
	ActionURL string    `json:"action_url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// NotificationPreferences stores user notification settings
type NotificationPreferences struct {
	UserID           string `json:"user_id"`
	EmailEnabled     bool   `json:"email_enabled"`
	InAppEnabled     bool   `json:"in_app_enabled"`
	QuotaAlerts      bool   `json:"quota_alerts"`
	BillingAlerts    bool   `json:"billing_alerts"`
	SystemAlerts     bool   `json:"system_alerts"`
	JobAlerts        bool   `json:"job_alerts"`
	APIAlerts        bool   `json:"api_alerts"`
	EmailAddress     string `json:"email_address,omitempty"`
	SlackWebhookURL  string `json:"slack_webhook_url,omitempty"`
}

// Service manages notifications
type Service struct {
	notifications map[string][]*Notification // userID -> notifications
	preferences   map[string]*NotificationPreferences
	allNotifications []*Notification // global feed (for demo/admin)
	mu            sync.RWMutex
}

var (
	instance *Service
	once     sync.Once
)

// GetService returns the singleton notification service
func GetService() *Service {
	once.Do(func() {
		instance = &Service{
			notifications:    make(map[string][]*Notification),
			preferences:      make(map[string]*NotificationPreferences),
			allNotifications: make([]*Notification, 0),
		}
		// Seed some demo notifications
		instance.seedDemoNotifications()
		utils.Info("Notification service initialized")
	})
	return instance
}

// Send creates and delivers a notification
func (s *Service) Send(userID, title, message, severity, category, actionURL string) *Notification {
	s.mu.Lock()

	n := &Notification{
		ID:        uuid.New().String(),
		UserID:    userID,
		Title:     title,
		Message:   message,
		Severity:  severity,
		Category:  category,
		Read:      false,
		ActionURL: actionURL,
		CreatedAt: time.Now(),
	}

	s.notifications[userID] = append(s.notifications[userID], n)
	s.allNotifications = append(s.allNotifications, n)

	// Keep max 200 per user
	if len(s.notifications[userID]) > 200 {
		s.notifications[userID] = s.notifications[userID][len(s.notifications[userID])-200:]
	}
	// Keep max 500 global
	if len(s.allNotifications) > 500 {
		s.allNotifications = s.allNotifications[len(s.allNotifications)-500:]
	}

	s.mu.Unlock()

	// Broadcast via WebSocket
	s.broadcastNotification(n)

	return n
}

// GetNotifications returns notifications for a user
func (s *Service) GetNotifications(userID string, unreadOnly bool, limit int) []*Notification {
	s.mu.RLock()
	defer s.mu.RUnlock()

	all := s.allNotifications // For demo, show all notifications
	if userID != "" {
		all = s.notifications[userID]
	}

	if all == nil {
		return []*Notification{}
	}

	// Filter and reverse (newest first)
	var result []*Notification
	for i := len(all) - 1; i >= 0; i-- {
		if unreadOnly && all[i].Read {
			continue
		}
		result = append(result, all[i])
		if limit > 0 && len(result) >= limit {
			break
		}
	}

	if result == nil {
		return []*Notification{}
	}
	return result
}

// MarkRead marks a notification as read
func (s *Service) MarkRead(notificationID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, notifs := range s.notifications {
		for _, n := range notifs {
			if n.ID == notificationID {
				n.Read = true
				return true
			}
		}
	}
	// Also check global
	for _, n := range s.allNotifications {
		if n.ID == notificationID {
			n.Read = true
			return true
		}
	}
	return false
}

// MarkAllRead marks all notifications for a user as read
func (s *Service) MarkAllRead(userID string) int {
	s.mu.Lock()
	defer s.mu.Unlock()

	count := 0
	// Mark in user-specific list
	for _, n := range s.notifications[userID] {
		if !n.Read {
			n.Read = true
			count++
		}
	}
	// Also mark in global list
	for _, n := range s.allNotifications {
		if (userID == "" || n.UserID == userID) && !n.Read {
			n.Read = true
			count++
		}
	}
	return count
}

// DeleteNotification removes a notification
func (s *Service) DeleteNotification(notificationID string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	for userID, notifs := range s.notifications {
		for i, n := range notifs {
			if n.ID == notificationID {
				s.notifications[userID] = append(notifs[:i], notifs[i+1:]...)
				return true
			}
		}
	}
	return false
}

// GetUnreadCount returns count of unread notifications
func (s *Service) GetUnreadCount(userID string) int {
	s.mu.RLock()
	defer s.mu.RUnlock()

	count := 0
	list := s.allNotifications
	if userID != "" {
		list = s.notifications[userID]
	}
	for _, n := range list {
		if !n.Read {
			count++
		}
	}
	return count
}

// GetPreferences returns notification preferences for a user
func (s *Service) GetPreferences(userID string) *NotificationPreferences {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if prefs, ok := s.preferences[userID]; ok {
		return prefs
	}
	// Return defaults
	return &NotificationPreferences{
		UserID:        userID,
		EmailEnabled:  true,
		InAppEnabled:  true,
		QuotaAlerts:   true,
		BillingAlerts: true,
		SystemAlerts:  true,
		JobAlerts:     true,
		APIAlerts:     true,
	}
}

// UpdatePreferences updates notification preferences
func (s *Service) UpdatePreferences(prefs *NotificationPreferences) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.preferences[prefs.UserID] = prefs
}

// GetStats returns notification statistics
func (s *Service) GetStats() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	total := len(s.allNotifications)
	unread := 0
	bySeverity := map[string]int{
		SeverityInfo: 0, SeveritySuccess: 0,
		SeverityWarning: 0, SeverityError: 0,
	}
	byCategory := map[string]int{}

	for _, n := range s.allNotifications {
		if !n.Read {
			unread++
		}
		bySeverity[n.Severity]++
		byCategory[n.Category]++
	}

	return map[string]interface{}{
		"total":       total,
		"unread":      unread,
		"by_severity": bySeverity,
		"by_category": byCategory,
	}
}

// broadcastNotification sends a notification through WebSocket
func (s *Service) broadcastNotification(n *Notification) {
	hub := websocket.GetHub()
	if hub.ClientCount() == 0 {
		return
	}

	payload := map[string]interface{}{
		"type": "notification",
		"data": n,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return
	}

	hub.BroadcastMessage(data)
}

// seedDemoNotifications creates sample notifications for demo
func (s *Service) seedDemoNotifications() {
	demoUser := "system"
	now := time.Now()

	demos := []struct {
		title, message, severity, category, actionURL string
		ago                                           time.Duration
	}{
		{"Server Started", "VelocityLLM server initialized successfully with all components.", SeveritySuccess, CategorySystem, "/monitoring", 2 * time.Minute},
		{"High API Latency Detected", "Average response time exceeded 500ms threshold for claude-sonnet-4-20250514.", SeverityWarning, CategoryAPI, "/analytics", 15 * time.Minute},
		{"Quota Usage at 80%", "Your monthly API quota has reached 80%. Consider upgrading your plan.", SeverityWarning, CategoryQuota, "/quota", 1 * time.Hour},
		{"Fine-Tuning Job Complete", "Training job ft-abc123 completed successfully. Model ready for deployment.", SeveritySuccess, CategoryJob, "/finetuning", 2 * time.Hour},
		{"New Model Version Published", "Model gpt-4-custom v2.1 has been promoted to production.", SeverityInfo, CategoryModel, "/versioning", 3 * time.Hour},
		{"Rate Limit Threshold Reached", "API key ak-***7f2d hit rate limit 5 times in the last hour.", SeverityError, CategoryAlert, "/keys", 4 * time.Hour},
		{"Billing Invoice Generated", "Your monthly invoice for $127.50 has been generated.", SeverityInfo, CategoryBilling, "/billing", 6 * time.Hour},
		{"Workflow Execution Failed", "Workflow 'Content Pipeline' failed at node 'LLM Call'. Check logs for details.", SeverityError, CategoryJob, "/workflows", 8 * time.Hour},
		{"System Update Available", "VelocityLLM v2.1.0 is available with performance improvements.", SeverityInfo, CategorySystem, "/settings", 12 * time.Hour},
		{"RAG Index Rebuilt", "Knowledge base 'Product Docs' index rebuilt with 1,247 documents.", SeveritySuccess, CategorySystem, "/knowledge", 1 * 24 * time.Hour},
	}

	for _, d := range demos {
		n := &Notification{
			ID:        uuid.New().String(),
			UserID:    demoUser,
			Title:     d.title,
			Message:   d.message,
			Severity:  d.severity,
			Category:  d.category,
			Read:      d.ago > 6*time.Hour, // older ones are read
			ActionURL: d.actionURL,
			CreatedAt: now.Add(-d.ago),
		}
		s.notifications[demoUser] = append(s.notifications[demoUser], n)
		s.allNotifications = append(s.allNotifications, n)
	}
}
