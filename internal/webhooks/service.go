package webhooks

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"gorm.io/gorm"
)

type Service struct {
	db         *gorm.DB
	httpClient *http.Client
	eventChan  chan *Event
}

// Event represents an event to be dispatched
type Event struct {
	Type    EventType              `json:"type"`
	UserID  uint                   `json:"user_id"`
	Source  string                 `json:"source"`
	Data    map[string]interface{} `json:"data"`
	Time    time.Time              `json:"timestamp"`
}

func NewService(db *gorm.DB) *Service {
	s := &Service{
		db: db,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		eventChan: make(chan *Event, 1000),
	}

	// Start event dispatcher workers
	for i := 0; i < 5; i++ {
		go s.eventWorker()
	}

	return s
}

// Dispatch sends an event to be processed asynchronously
func (s *Service) Dispatch(eventType EventType, userID uint, source string, data map[string]interface{}) {
	event := &Event{
		Type:   eventType,
		UserID: userID,
		Source: source,
		Data:   data,
		Time:   time.Now(),
	}

	select {
	case s.eventChan <- event:
	default:
		fmt.Printf("⚠️ Event channel full, dropping event: %s\n", eventType)
	}
}

// eventWorker processes events from the channel
func (s *Service) eventWorker() {
	for event := range s.eventChan {
		s.processEvent(event)
	}
}

// processEvent handles a single event
func (s *Service) processEvent(event *Event) {
	// Log the event
	payload, _ := json.Marshal(event.Data)
	eventLog := &EventLog{
		UserID:    event.UserID,
		EventType: event.Type,
		Source:    event.Source,
		Payload:   string(payload),
		CreatedAt: event.Time,
	}
	s.db.Create(eventLog)

	// Find matching webhook endpoints
	var endpoints []WebhookEndpoint
	s.db.Where("user_id = ? AND active = ?", event.UserID, true).Find(&endpoints)

	for _, endpoint := range endpoints {
		// Check if endpoint subscribes to this event
		if !s.endpointSubscribesToEvent(&endpoint, event.Type) {
			continue
		}

		// Deliver webhook
		go s.deliverWebhook(&endpoint, event)
	}
}

// endpointSubscribesToEvent checks if an endpoint subscribes to a specific event type
func (s *Service) endpointSubscribesToEvent(endpoint *WebhookEndpoint, eventType EventType) bool {
	events := strings.Split(endpoint.Events, ",")
	for _, e := range events {
		trimmed := strings.TrimSpace(e)
		if trimmed == string(eventType) || trimmed == "*" {
			return true
		}
	}
	return false
}

// deliverWebhook sends the webhook with retries
func (s *Service) deliverWebhook(endpoint *WebhookEndpoint, event *Event) {
	maxRetries := 3
	for attempt := 1; attempt <= maxRetries; attempt++ {
		delivery := s.sendWebhook(endpoint, event, attempt, maxRetries)
		s.db.Create(delivery)

		if delivery.Success {
			return
		}

		// Wait before retry (exponential backoff)
		if attempt < maxRetries {
			time.Sleep(time.Duration(attempt*attempt) * time.Second)
		}
	}
}

// sendWebhook sends a single webhook delivery
func (s *Service) sendWebhook(endpoint *WebhookEndpoint, event *Event, attempt, maxRetries int) *WebhookDelivery {
	// Build payload
	webhookPayload := map[string]interface{}{
		"id":        fmt.Sprintf("evt_%d_%d", event.UserID, time.Now().UnixNano()),
		"type":      event.Type,
		"timestamp": event.Time.Format(time.RFC3339),
		"data":      event.Data,
	}

	body, _ := json.Marshal(webhookPayload)

	delivery := &WebhookDelivery{
		EndpointID: endpoint.ID,
		EventType:  event.Type,
		Payload:    string(body),
		Attempt:    attempt,
		MaxRetries: maxRetries,
	}

	start := time.Now()

	req, err := http.NewRequest("POST", endpoint.URL, bytes.NewReader(body))
	if err != nil {
		delivery.Error = err.Error()
		delivery.DeliveredAt = time.Now()
		return delivery
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "VelocityLLM-Webhook/1.0")
	req.Header.Set("X-Webhook-Event", string(event.Type))

	// HMAC signature if secret is set
	if endpoint.Secret != "" {
		signature := computeHMAC(body, endpoint.Secret)
		req.Header.Set("X-Webhook-Signature", "sha256="+signature)
	}

	resp, err := s.httpClient.Do(req)
	delivery.LatencyMs = time.Since(start).Milliseconds()
	delivery.DeliveredAt = time.Now()

	if err != nil {
		delivery.Error = err.Error()
		return delivery
	}
	defer resp.Body.Close()

	delivery.StatusCode = resp.StatusCode

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
	delivery.ResponseBody = string(respBody)

	delivery.Success = resp.StatusCode >= 200 && resp.StatusCode < 300

	return delivery
}

// computeHMAC generates HMAC-SHA256 signature
func computeHMAC(payload []byte, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}

// ============================================
// CRUD OPERATIONS
// ============================================

func (s *Service) CreateEndpoint(endpoint *WebhookEndpoint) error {
	return s.db.Create(endpoint).Error
}

func (s *Service) GetEndpoint(id, userID uint) (*WebhookEndpoint, error) {
	var endpoint WebhookEndpoint
	err := s.db.Where("id = ? AND user_id = ?", id, userID).First(&endpoint).Error
	return &endpoint, err
}

func (s *Service) ListEndpoints(userID uint) ([]WebhookEndpoint, error) {
	var endpoints []WebhookEndpoint
	err := s.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&endpoints).Error
	return endpoints, err
}

func (s *Service) UpdateEndpoint(endpoint *WebhookEndpoint) error {
	return s.db.Save(endpoint).Error
}

func (s *Service) DeleteEndpoint(id, userID uint) error {
	return s.db.Where("id = ? AND user_id = ?", id, userID).Delete(&WebhookEndpoint{}).Error
}

func (s *Service) ToggleEndpoint(id, userID uint, active bool) error {
	return s.db.Model(&WebhookEndpoint{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("active", active).Error
}

// GetDeliveries returns recent webhook deliveries
func (s *Service) GetDeliveries(endpointID uint, limit int) ([]WebhookDelivery, error) {
	var deliveries []WebhookDelivery
	err := s.db.Where("endpoint_id = ?", endpointID).
		Order("created_at DESC").
		Limit(limit).
		Find(&deliveries).Error
	return deliveries, err
}

// GetEventLogs returns recent events
func (s *Service) GetEventLogs(userID uint, limit int) ([]EventLog, error) {
	var logs []EventLog
	err := s.db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Find(&logs).Error
	return logs, err
}

// GetDeliveryStats returns webhook delivery statistics
func (s *Service) GetDeliveryStats(userID uint) (map[string]interface{}, error) {
	var endpoints []WebhookEndpoint
	s.db.Where("user_id = ?", userID).Find(&endpoints)

	var endpointIDs []uint
	for _, ep := range endpoints {
		endpointIDs = append(endpointIDs, ep.ID)
	}

	var totalDeliveries int64
	var successDeliveries int64
	var failedDeliveries int64

	if len(endpointIDs) > 0 {
		s.db.Model(&WebhookDelivery{}).Where("endpoint_id IN ?", endpointIDs).Count(&totalDeliveries)
		s.db.Model(&WebhookDelivery{}).Where("endpoint_id IN ? AND success = ?", endpointIDs, true).Count(&successDeliveries)
		s.db.Model(&WebhookDelivery{}).Where("endpoint_id IN ? AND success = ?", endpointIDs, false).Count(&failedDeliveries)
	}

	return map[string]interface{}{
		"total_endpoints":     len(endpoints),
		"active_endpoints":    countActive(endpoints),
		"total_deliveries":    totalDeliveries,
		"success_deliveries":  successDeliveries,
		"failed_deliveries":   failedDeliveries,
	}, nil
}

func countActive(endpoints []WebhookEndpoint) int {
	count := 0
	for _, ep := range endpoints {
		if ep.Active {
			count++
		}
	}
	return count
}

// ============================================
// GLOBAL SERVICE SINGLETON
// ============================================

var globalService *Service

func InitGlobalService(db *gorm.DB) {
	globalService = NewService(db)
}

func GetGlobalService() *Service {
	return globalService
}
