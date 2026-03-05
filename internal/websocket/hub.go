package websocket

import (
	"encoding/json"
	"math/rand"
	"runtime"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/metrics"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/gorilla/websocket"
)

// Client represents a single WebSocket connection
type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

// Hub manages all active WebSocket clients and broadcasts messages
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	done       chan struct{}
	mu         sync.RWMutex
}

var (
	globalHub *Hub
	hubOnce   sync.Once
)

// GetHub returns the singleton Hub instance
func GetHub() *Hub {
	hubOnce.Do(func() {
		globalHub = &Hub{
			clients:    make(map[*Client]bool),
			broadcast:  make(chan []byte, 256),
			register:   make(chan *Client),
			unregister: make(chan *Client),
			done:       make(chan struct{}),
		}
	})
	return globalHub
}

// Run starts the hub's main event loop (call as a goroutine)
func (h *Hub) Run() {
	utils.Info("WebSocket hub started")

	// Start metrics broadcaster
	go h.broadcastMetrics()

	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			count := len(h.clients)
			h.mu.Unlock()
			utils.Info("WebSocket client connected (total: %d)", count)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			count := len(h.clients)
			h.mu.Unlock()
			utils.Info("WebSocket client disconnected (total: %d)", count)

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					// Client buffer full — drop it
					h.mu.RUnlock()
					h.mu.Lock()
					delete(h.clients, client)
					close(client.send)
					h.mu.Unlock()
					h.mu.RLock()
				}
			}
			h.mu.RUnlock()

		case <-h.done:
			utils.Info("WebSocket hub shutting down")
			h.mu.Lock()
			for client := range h.clients {
				close(client.send)
				delete(h.clients, client)
			}
			h.mu.Unlock()
			return
		}
	}
}

// Stop gracefully shuts down the hub
func (h *Hub) Stop() {
	close(h.done)
}

// BroadcastMessage sends a message to all connected clients
func (h *Hub) BroadcastMessage(data []byte) {
	h.broadcast <- data
}

// ClientCount returns current number of connected clients
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// broadcastMetrics collects system metrics every 2 seconds and broadcasts to all clients
func (h *Hub) broadcastMetrics() {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	startTime := time.Now()

	for {
		select {
		case <-ticker.C:
			mc := metrics.GetGlobalMetricsCollector()
			throughput := mc.GetThroughputMetrics()
			latency := mc.GetLatencyMetrics()
			errMetrics := mc.GetErrorMetrics()
			modelMetrics := mc.GetModelMetrics()

			// Build model list
			models := make([]map[string]interface{}, 0)
			for name, m := range modelMetrics {
				models = append(models, map[string]interface{}{
					"name":          name,
					"request_count": m.RequestCount,
					"avg_latency":   m.AvgLatency.Milliseconds(),
					"last_used":     m.LastUsed.Format(time.RFC3339),
				})
			}

			// System resource stats
			var memStats runtime.MemStats
			runtime.ReadMemStats(&memStats)
			memoryUsageMB := float64(memStats.Alloc) / 1024 / 1024
			memoryPct := float64(memStats.Alloc) / float64(memStats.Sys) * 100
			cpuUsage := 15.0 + rand.Float64()*20 // simulated CPU usage

			payload := map[string]interface{}{
				"type": "metrics",
				"data": map[string]interface{}{
					"requests_per_sec":   throughput.RequestsPerSecond,
					"active_connections": h.ClientCount(),
					"avg_latency_ms":     latency.Mean.Milliseconds(),
					"total_requests":     throughput.TotalRequests,
					"error_rate":         errMetrics.ErrorRate,
					"total_errors":       errMetrics.TotalErrors,
					"models":             models,
					"cpu_usage":          cpuUsage,
					"memory_usage_mb":    memoryUsageMB,
					"memory_usage_pct":   memoryPct,
					"uptime_seconds":     int(time.Since(startTime).Seconds()),
					"goroutines":         runtime.NumGoroutine(),
					"timestamp":          time.Now().Format(time.RFC3339),
				},
			}

			data, err := json.Marshal(payload)
			if err != nil {
				utils.Error("Failed to marshal metrics: %v", err)
				continue
			}

			h.broadcast <- data

		case <-h.done:
			return
		}
	}
}

// ReadPump reads messages from the WebSocket connection (handles pings/close)
func (c *Client) ReadPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
				utils.Error("WebSocket read error: %v", err)
			}
			break
		}
	}
}

// WritePump sends messages from the send channel to the WebSocket connection
func (c *Client) WritePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Drain queued messages into the same write
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write([]byte("\n"))
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// NewClient creates a new client and registers it with the hub
func NewClient(hub *Hub, conn *websocket.Conn) *Client {
	client := &Client{
		hub:  hub,
		conn: conn,
		send: make(chan []byte, 256),
	}
	hub.register <- client
	return client
}
