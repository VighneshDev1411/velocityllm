package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/VighneshDev1411/velocityllm/internal/database"
	"github.com/VighneshDev1411/velocityllm/internal/llm"
	"github.com/VighneshDev1411/velocityllm/internal/streaming"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
	"github.com/google/uuid"
)

// ── Request / Response types ────────────────────────────────────────────────

type CreateConversationRequest struct {
	Title string `json:"title"`
	Model string `json:"model"`
}

type ChatSendRequest struct {
	Message     string  `json:"message"`
	Model       string  `json:"model"`
	MaxTokens   int     `json:"max_tokens"`
	Temperature float64 `json:"temperature"`
	TopP        float64 `json:"top_p"`
}

type RenameConversationRequest struct {
	Title string `json:"title"`
}

// ── Handlers ────────────────────────────────────────────────────────────────

// ListConversationsHandler  GET /api/v1/chat/conversations
func ListConversationsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if limit <= 0 {
		limit = 50
	}

	repo := database.NewChatRepository()
	convs, total, err := repo.ListConversations("", limit, offset)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to list conversations")
		return
	}

	types.WriteJSON(w, http.StatusOK, types.SuccessResponse{
		Success: true,
		Message: "Conversations listed",
		Data: map[string]interface{}{
			"conversations": convs,
			"total":         total,
		},
	})
}

// CreateConversationHandler  POST /api/v1/chat/conversations
func CreateConversationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req CreateConversationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Allow empty body — just create a default conversation
		req = CreateConversationRequest{}
	}

	if req.Title == "" {
		req.Title = "New Chat"
	}
	if req.Model == "" {
		req.Model = "gpt-3.5-turbo"
	}

	conv := &types.Conversation{
		Title: req.Title,
		Model: req.Model,
	}

	repo := database.NewChatRepository()
	if err := repo.CreateConversation(conv); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to create conversation")
		return
	}

	types.WriteSuccess(w, "Conversation created", conv)
}

// GetConversationHandler  GET /api/v1/chat/conversations/{id}
func GetConversationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	id := extractConversationID(r.URL.Path)
	if id == uuid.Nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid conversation ID")
		return
	}

	repo := database.NewChatRepository()
	conv, err := repo.GetConversation(id)
	if err != nil {
		types.WriteError(w, http.StatusNotFound, "Conversation not found")
		return
	}

	types.WriteSuccess(w, "Conversation retrieved", conv)
}

// RenameConversationHandler  PUT /api/v1/chat/conversations/{id}/rename
func RenameConversationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Path: /api/v1/chat/conversations/{id}/rename
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 5 {
		types.WriteError(w, http.StatusBadRequest, "Invalid path")
		return
	}
	id, err := uuid.Parse(parts[4])
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid conversation ID")
		return
	}

	var req RenameConversationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Title == "" {
		types.WriteError(w, http.StatusBadRequest, "Title is required")
		return
	}

	repo := database.NewChatRepository()
	if err := repo.UpdateConversation(id, map[string]interface{}{"title": req.Title}); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to rename conversation")
		return
	}

	types.WriteSuccess(w, "Conversation renamed", map[string]string{"title": req.Title})
}

// DeleteConversationHandler  DELETE /api/v1/chat/conversations/{id}
func DeleteConversationHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	id := extractConversationID(r.URL.Path)
	if id == uuid.Nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid conversation ID")
		return
	}

	repo := database.NewChatRepository()
	if err := repo.DeleteConversation(id); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to delete conversation")
		return
	}

	types.WriteSuccess(w, "Conversation deleted", nil)
}

// ChatSendHandler  POST /api/v1/chat/conversations/{id}/send
// Sends user message, saves it, streams LLM response via SSE, saves assistant reply.
func ChatSendHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Extract conversation ID from path
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(parts) < 5 {
		types.WriteError(w, http.StatusBadRequest, "Invalid path")
		return
	}
	convID, err := uuid.Parse(parts[4])
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid conversation ID")
		return
	}

	var req ChatSendRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Message == "" {
		types.WriteError(w, http.StatusBadRequest, "Message is required")
		return
	}

	repo := database.NewChatRepository()

	// Load conversation + history
	conv, err := repo.GetConversation(convID)
	if err != nil {
		types.WriteError(w, http.StatusNotFound, "Conversation not found")
		return
	}

	// Override model if provided
	model := conv.Model
	if req.Model != "" {
		model = req.Model
		repo.UpdateConversation(convID, map[string]interface{}{"model": model})
	}

	// Save user message
	userMsg := &types.Message{
		ConversationID: convID,
		Role:           "user",
		Content:        req.Message,
		Model:          model,
	}
	if err := repo.AddMessage(userMsg); err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to save message")
		return
	}

	// Build chat messages for LLM (conversation history + new message)
	chatMsgs := make([]llm.ChatMessage, 0, len(conv.Messages)+1)
	for _, m := range conv.Messages {
		chatMsgs = append(chatMsgs, llm.ChatMessage{Role: m.Role, Content: m.Content})
	}
	chatMsgs = append(chatMsgs, llm.ChatMessage{Role: "user", Content: req.Message})

	// Set defaults
	temperature := req.Temperature
	if temperature == 0 {
		temperature = 0.7
	}
	maxTokens := req.MaxTokens
	if maxTokens == 0 {
		maxTokens = 1024
	}
	topP := req.TopP
	if topP == 0 {
		topP = 1.0
	}

	// Create SSE handler for streaming response
	sseHandler, err := streaming.NewSSEHandler(w)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "SSE not supported")
		return
	}

	// Send the user message ID so frontend can track it
	sseHandler.WriteSSE(streaming.StreamMessage{
		Type: "user_message",
		Data: map[string]interface{}{
			"id":              userMsg.ID,
			"conversation_id": convID,
		},
	})

	provider := llm.GetProvider()
	var fullResponse string

	if provider.IsAvailable() {
		index := 0
		result, err := provider.ChatStreamComplete(chatMsgs, model, temperature, maxTokens, topP, func(token string) error {
			if writeErr := sseHandler.WriteToken(token, index); writeErr != nil {
				return writeErr
			}
			index++
			return nil
		})

		if err != nil {
			utils.Error("Chat LLM error", "value", err)
			sseHandler.WriteError("LLM_ERROR", err.Error(), "provider_error")
			sseHandler.WriteDone()
			return
		}

		if result != nil {
			fullResponse = result.Response
		}
	} else {
		// Fallback: simulate
		tokenChan := streaming.SimulateTokenStream(req.Message, model)
		index := 0
		for token := range tokenChan {
			if err := sseHandler.WriteToken(token, index); err != nil {
				return
			}
			fullResponse += token
			index++
		}
	}

	// Save assistant message
	assistantMsg := &types.Message{
		ConversationID: convID,
		Role:           "assistant",
		Content:        fullResponse,
		Model:          model,
	}
	repo.AddMessage(assistantMsg)

	// Auto-title: if this is the first exchange, generate a title from the user message
	if conv.MessageCnt == 0 {
		title := req.Message
		if len(title) > 50 {
			title = title[:50] + "..."
		}
		repo.UpdateConversation(convID, map[string]interface{}{"title": title})
	}

	// Send assistant message metadata, then done
	sseHandler.WriteSSE(streaming.StreamMessage{
		Type: "assistant_message",
		Data: map[string]interface{}{
			"id":              assistantMsg.ID,
			"conversation_id": convID,
		},
	})

	sseHandler.WriteDone()
}

// ChatStatsHandler  GET /api/v1/chat/stats
func ChatStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	repo := database.NewChatRepository()
	stats, err := repo.GetConversationStats()
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to get stats")
		return
	}

	types.WriteSuccess(w, "Chat statistics", stats)
}

// ── Helpers ─────────────────────────────────────────────────────────────────

func extractConversationID(path string) uuid.UUID {
	// Path: /api/v1/chat/conversations/{id}
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) < 5 {
		return uuid.Nil
	}
	id, err := uuid.Parse(parts[4])
	if err != nil {
		return uuid.Nil
	}
	return id
}
