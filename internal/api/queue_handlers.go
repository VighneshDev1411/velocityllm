package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/queue"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// GetQueueStatsHandler returns message broker statistics (Day 49)
func GetQueueStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	broker := queue.GetGlobalBroker()
	if broker == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Message broker not initialized")
		return
	}

	types.WriteSuccess(w, "Queue stats retrieved", broker.GetStats())
}

// GetQueueInfoHandler returns detailed info for a specific queue (Day 49)
func GetQueueInfoHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	queueName := r.URL.Query().Get("queue")
	if queueName == "" {
		queueName = queue.QueueDefault
	}

	broker := queue.GetGlobalBroker()
	if broker == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Message broker not initialized")
		return
	}

	info, err := broker.GetQueueInfo(r.Context(), queueName)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	types.WriteSuccess(w, "Queue info retrieved", info)
}

// PublishMessageHandler publishes a message to a queue (Day 49)
func PublishMessageHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	broker := queue.GetGlobalBroker()
	if broker == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Message broker not initialized")
		return
	}

	var req struct {
		Queue    string                 `json:"queue"`
		Type     string                 `json:"type"`
		Payload  map[string]interface{} `json:"payload"`
		Priority int                    `json:"priority"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Type == "" {
		types.WriteError(w, http.StatusBadRequest, "type is required")
		return
	}
	if req.Queue == "" {
		req.Queue = queue.QueueDefault
	}

	msg, err := broker.PublishWithPriority(
		r.Context(),
		req.Queue,
		req.Type,
		req.Payload,
		queue.Priority(req.Priority),
	)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	types.WriteSuccess(w, "Message published", map[string]interface{}{
		"id":    msg.ID,
		"queue": msg.Queue,
		"type":  msg.Type,
	})
}

// GetDeadLetterHandler returns messages in the dead letter queue (Day 49)
func GetDeadLetterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	broker := queue.GetGlobalBroker()
	if broker == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Message broker not initialized")
		return
	}

	messages, err := broker.GetDeadLetterMessages(r.Context(), 50)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	types.WriteSuccess(w, "Dead letter messages retrieved", map[string]interface{}{
		"messages": messages,
		"count":    len(messages),
	})
}

// ReplayDeadLetterHandler replays a message from the DLQ back to its original queue (Day 49)
func ReplayDeadLetterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	broker := queue.GetGlobalBroker()
	if broker == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Message broker not initialized")
		return
	}

	var req struct {
		StreamID string `json:"stream_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.StreamID == "" {
		types.WriteError(w, http.StatusBadRequest, "stream_id required")
		return
	}

	if err := broker.ReplayDeadLetter(r.Context(), req.StreamID); err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	types.WriteSuccess(w, "Message replayed from dead letter queue", map[string]string{
		"stream_id": req.StreamID,
	})
}

// ListQueuesHandler returns all registered queue names and their depths (Day 49)
func ListQueuesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	broker := queue.GetGlobalBroker()
	if broker == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Message broker not initialized")
		return
	}

	stats := broker.GetStats()
	queues := []map[string]interface{}{
		{"name": queue.QueueCompletions, "label": "Completions", "depth": getDepth(stats, queue.QueueCompletions)},
		{"name": queue.QueueWebhooks, "label": "Webhooks", "depth": getDepth(stats, queue.QueueWebhooks)},
		{"name": queue.QueueNotifications, "label": "Notifications", "depth": getDepth(stats, queue.QueueNotifications)},
		{"name": queue.QueueAnalytics, "label": "Analytics", "depth": getDepth(stats, queue.QueueAnalytics)},
		{"name": queue.QueueDefault, "label": "Default", "depth": getDepth(stats, queue.QueueDefault)},
		{"name": queue.QueueDeadLetter, "label": "Dead Letter", "depth": getDepth(stats, queue.QueueDeadLetter)},
	}

	types.WriteSuccess(w, "Queues listed", queues)
}

func getDepth(stats map[string]interface{}, queueName string) int64 {
	if depths, ok := stats["queue_depths"].(map[string]int64); ok {
		return depths[queueName]
	}
	return 0
}
