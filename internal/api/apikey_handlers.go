package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/auth"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// ============================================
// API KEY MANAGEMENT HANDLERS (Day 20)
// ============================================

// CreateAPIKeyHandler generates a new API key
func CreateAPIKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	user := auth.GetUserFromContext(r.Context())
	if user == nil {
		types.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		Name          string `json:"name"`
		Scopes        string `json:"scopes"`
		RateLimit     int    `json:"rate_limit"`
		ExpiresInDays int    `json:"expires_in_days"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Name == "" {
		types.WriteError(w, http.StatusBadRequest, "Key name is required")
		return
	}

	service := auth.GetGlobalService()
	apiKey, fullKey, err := service.CreateAPIKey(user.ID, req.Name, req.Scopes, req.RateLimit, req.ExpiresInDays)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	service.LogActivity(user.ID, user.Username, "create_api_key",
		"Created API key: "+req.Name, r.RemoteAddr, r.UserAgent())

	utils.Info("API key created", "user_id", user.ID, "key_name", req.Name)

	types.WriteSuccess(w, "API key created. Save this key — it won't be shown again.", map[string]interface{}{
		"key":     apiKey,
		"api_key": fullKey,
	})
}

// ListAPIKeysHandler returns all API keys for the authenticated user
func ListAPIKeysHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	user := auth.GetUserFromContext(r.Context())
	if user == nil {
		types.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	service := auth.GetGlobalService()
	keys, err := service.ListAPIKeys(user.ID)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	types.WriteSuccess(w, "API keys retrieved", map[string]interface{}{
		"keys":  keys,
		"count": len(keys),
	})
}

// RevokeAPIKeyHandler deactivates an API key
func RevokeAPIKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	user := auth.GetUserFromContext(r.Context())
	if user == nil {
		types.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		KeyID string `json:"key_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	service := auth.GetGlobalService()
	if err := service.RevokeAPIKey(req.KeyID, user.ID); err != nil {
		types.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	service.LogActivity(user.ID, user.Username, "revoke_api_key",
		"Revoked API key: "+req.KeyID, r.RemoteAddr, r.UserAgent())

	utils.Info("API key revoked", "user_id", user.ID, "key_id", req.KeyID)
	types.WriteSuccess(w, "API key revoked", nil)
}

// RotateAPIKeyHandler rotates an API key (revokes old, creates new with same settings)
func RotateAPIKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	user := auth.GetUserFromContext(r.Context())
	if user == nil {
		types.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		KeyID string `json:"key_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	service := auth.GetGlobalService()
	newKey, fullKey, err := service.RotateAPIKey(req.KeyID, user.ID)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	service.LogActivity(user.ID, user.Username, "rotate_api_key",
		"Rotated API key: "+req.KeyID, r.RemoteAddr, r.UserAgent())

	utils.Info("API key rotated", "user_id", user.ID, "old_key_id", req.KeyID, "new_key_id", newKey.ID)

	types.WriteSuccess(w, "API key rotated. Save the new key — it won't be shown again.", map[string]interface{}{
		"key":     newKey,
		"api_key": fullKey,
	})
}

// DeleteAPIKeyHandler permanently deletes an API key
func DeleteAPIKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	user := auth.GetUserFromContext(r.Context())
	if user == nil {
		types.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	keyID := r.URL.Query().Get("key_id")
	if keyID == "" {
		types.WriteError(w, http.StatusBadRequest, "key_id is required")
		return
	}

	service := auth.GetGlobalService()
	if err := service.DeleteAPIKey(keyID, user.ID); err != nil {
		types.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	service.LogActivity(user.ID, user.Username, "delete_api_key",
		"Deleted API key: "+keyID, r.RemoteAddr, r.UserAgent())

	types.WriteSuccess(w, "API key deleted", nil)
}

// GetAPIKeyUsageHandler returns usage logs for a specific key
func GetAPIKeyUsageHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	user := auth.GetUserFromContext(r.Context())
	if user == nil {
		types.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	keyID := r.URL.Query().Get("key_id")
	if keyID == "" {
		types.WriteError(w, http.StatusBadRequest, "key_id is required")
		return
	}

	service := auth.GetGlobalService()

	// Get key stats
	stats, err := service.GetAPIKeyStats(keyID)
	if err != nil {
		types.WriteError(w, http.StatusNotFound, "API key not found")
		return
	}

	// Get recent usage logs
	logs, err := service.GetAPIKeyUsage(keyID, 50)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	types.WriteSuccess(w, "API key usage retrieved", map[string]interface{}{
		"stats": stats,
		"logs":  logs,
	})
}
