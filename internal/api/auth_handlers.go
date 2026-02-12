package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/auth"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// RegisterHandler handles user registration (Day 12)
func RegisterHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req auth.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	service := auth.GetGlobalService()
	if service == nil {
		types.WriteError(w, http.StatusInternalServerError, "Auth service not initialized")
		return
	}

	user, err := service.Register(&req)
	if err != nil {
		utils.Error("Registration failed", "error", err, "email", req.Email)
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Generate tokens
	tokens, err := auth.GenerateTokenPair(user)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to generate tokens")
		return
	}

	utils.Info("User registered successfully", "user_id", user.ID, "email", user.Email)

	types.WriteSuccess(w, "User registered successfully", map[string]interface{}{
		"user":   user.SafeUser(),
		"tokens": tokens,
	})
}

// LoginHandler handles user login
func LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req auth.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	service := auth.GetGlobalService()
	if service == nil {
		types.WriteError(w, http.StatusInternalServerError, "Auth service not initialized")
		return
	}

	user, tokens, err := service.Login(&req)
	if err != nil {
		utils.Warn("Login failed", "error", err, "email", req.Email)
		types.WriteError(w, http.StatusUnauthorized, err.Error())
		return
	}

	utils.Info("User logged in successfully", "user_id", user.ID, "email", user.Email)

	types.WriteSuccess(w, "Login successful", map[string]interface{}{
		"user":   user.SafeUser(),
		"tokens": tokens,
	})
}

// RefreshTokenHandler refreshes access token using refresh token
func RefreshTokenHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate refresh token
	claims, err := auth.ValidateToken(req.RefreshToken)
	if err != nil {
		types.WriteError(w, http.StatusUnauthorized, "Invalid refresh token")
		return
	}

	service := auth.GetGlobalService()
	if service == nil {
		types.WriteError(w, http.StatusInternalServerError, "Auth service not initialized")
		return
	}

	// Get user
	user, err := service.GetUserByID(claims.UserID)
	if err != nil {
		types.WriteError(w, http.StatusUnauthorized, "User not found")
		return
	}

	// Generate new access token
	accessToken, err := auth.RefreshAccessToken(req.RefreshToken, user)
	if err != nil {
		types.WriteError(w, http.StatusUnauthorized, err.Error())
		return
	}

	types.WriteSuccess(w, "Token refreshed", map[string]interface{}{
		"access_token": accessToken,
		"token_type":   "Bearer",
		"expires_in":   int64(auth.TokenExpiration.Seconds()),
	})
}

// GetProfileHandler returns current user profile
func GetProfileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	user := auth.GetUserFromContext(r.Context())
	if user == nil {
		types.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	types.WriteSuccess(w, "Profile retrieved", user.SafeUser())
}

// UpdateProfileHandler updates user profile
func UpdateProfileHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	user := auth.GetUserFromContext(r.Context())
	if user == nil {
		types.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	service := auth.GetGlobalService()
	if service == nil {
		types.WriteError(w, http.StatusInternalServerError, "Auth service not initialized")
		return
	}

	if err := service.UpdateUser(user.ID, updates); err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Get updated user
	updatedUser, err := service.GetUserByID(user.ID)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, "Failed to retrieve updated profile")
		return
	}

	types.WriteSuccess(w, "Profile updated", updatedUser.SafeUser())
}

// ChangePasswordHandler changes user password
func ChangePasswordHandler(w http.ResponseWriter, r *http.Request) {
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
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	service := auth.GetGlobalService()
	if service == nil {
		types.WriteError(w, http.StatusInternalServerError, "Auth service not initialized")
		return
	}

	if err := service.ChangePassword(user.ID, req.OldPassword, req.NewPassword); err != nil {
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	utils.Info("Password changed", "user_id", user.ID)
	types.WriteSuccess(w, "Password changed successfully", nil)
}

// LogoutHandler handles user logout (optional - mainly for logging)
func LogoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	user := auth.GetUserFromContext(r.Context())
	if user != nil {
		utils.Info("User logged out", "user_id", user.ID)
	}

	types.WriteSuccess(w, "Logged out successfully", nil)
}

// ListUsersHandler lists all users (admin only)
func ListUsersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	user := auth.GetUserFromContext(r.Context())
	if user == nil || !user.IsAdmin() {
		types.WriteError(w, http.StatusForbidden, "Admin access required")
		return
	}

	service := auth.GetGlobalService()
	if service == nil {
		types.WriteError(w, http.StatusInternalServerError, "Auth service not initialized")
		return
	}

	// Parse pagination
	limit := 50
	offset := 0

	users, total, err := service.ListUsers(limit, offset)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Convert to safe user format
	safeUsers := make([]map[string]interface{}, len(users))
	for i, u := range users {
		safeUsers[i] = u.SafeUser()
	}

	types.WriteSuccess(w, "Users retrieved", map[string]interface{}{
		"users": safeUsers,
		"total": total,
		"limit": limit,
		"offset": offset,
	})
}
