package api

import (
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/websocket"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	ws "github.com/gorilla/websocket"
)

var upgrader = ws.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in dev mode
	},
}

// WebSocketHandler upgrades HTTP connections to WebSocket
func WebSocketHandler(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		utils.Error("WebSocket upgrade failed: %v", err)
		return
	}

	hub := websocket.GetHub()
	client := websocket.NewClient(hub, conn)

	go client.WritePump()
	go client.ReadPump()
}
