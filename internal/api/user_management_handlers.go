package api

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/VighneshDev1411/velocityllm/internal/auth"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// ============================================
// USER CRUD HANDLERS (Day 19)
// ============================================

// AdminGetUserHandler returns a specific user by ID (admin only)
func AdminGetUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		types.WriteError(w, http.StatusBadRequest, "user_id is required")
		return
	}

	service := auth.GetGlobalService()
	user, err := service.GetUserByID(userID)
	if err != nil {
		types.WriteError(w, http.StatusNotFound, "User not found")
		return
	}

	types.WriteSuccess(w, "User retrieved", user.SafeUser())
}

// AdminUpdateUserHandler updates a user's profile (admin only)
func AdminUpdateUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		UserID    string `json:"user_id"`
		FirstName string `json:"first_name,omitempty"`
		LastName  string `json:"last_name,omitempty"`
		Username  string `json:"username,omitempty"`
		Active    *bool  `json:"active,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.UserID == "" {
		types.WriteError(w, http.StatusBadRequest, "user_id is required")
		return
	}

	service := auth.GetGlobalService()
	updates := make(map[string]interface{})
	if req.FirstName != "" {
		updates["first_name"] = req.FirstName
	}
	if req.LastName != "" {
		updates["last_name"] = req.LastName
	}
	if req.Username != "" {
		updates["username"] = req.Username
	}
	if req.Active != nil {
		updates["active"] = *req.Active
	}

	if len(updates) == 0 {
		types.WriteError(w, http.StatusBadRequest, "No updates provided")
		return
	}

	if err := service.UpdateUser(req.UserID, updates); err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Log activity
	adminUser := auth.GetUserFromContext(r.Context())
	if adminUser != nil {
		service.LogActivity(adminUser.ID, adminUser.Username, "admin_update_user",
			"Updated user "+req.UserID, r.RemoteAddr, r.UserAgent())
	}

	updatedUser, _ := service.GetUserByID(req.UserID)
	types.WriteSuccess(w, "User updated", updatedUser.SafeUser())
}

// AdminDeleteUserHandler deletes a user (admin only)
func AdminDeleteUserHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		types.WriteError(w, http.StatusBadRequest, "user_id is required")
		return
	}

	// Prevent self-deletion
	adminUser := auth.GetUserFromContext(r.Context())
	if adminUser != nil && adminUser.ID == userID {
		types.WriteError(w, http.StatusBadRequest, "Cannot delete your own account")
		return
	}

	service := auth.GetGlobalService()
	if err := service.DeleteUser(userID); err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if adminUser != nil {
		service.LogActivity(adminUser.ID, adminUser.Username, "admin_delete_user",
			"Deleted user "+userID, r.RemoteAddr, r.UserAgent())
	}

	utils.Info("User deleted by admin", "deleted_user_id", userID, "admin_id", adminUser.ID)
	types.WriteSuccess(w, "User deleted", nil)
}

// SearchUsersHandler searches users by email/username (admin only)
func SearchUsersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	query := r.URL.Query().Get("q")
	if query == "" {
		types.WriteError(w, http.StatusBadRequest, "Search query 'q' is required")
		return
	}

	service := auth.GetGlobalService()
	users, err := service.SearchUsers(query, 20)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	safeUsers := make([]map[string]interface{}, len(users))
	for i, u := range users {
		safeUsers[i] = u.SafeUser()
	}

	types.WriteSuccess(w, "Search results", map[string]interface{}{
		"users": safeUsers,
		"count": len(safeUsers),
		"query": query,
	})
}

// ============================================
// ROLE MANAGEMENT HANDLERS
// ============================================

// UpdateUserRoleHandler changes a user's role (admin only)
func UpdateUserRoleHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		UserID string `json:"user_id"`
		Role   string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.UserID == "" || req.Role == "" {
		types.WriteError(w, http.StatusBadRequest, "user_id and role are required")
		return
	}

	validRoles := map[string]bool{"user": true, "admin": true, "developer": true, "viewer": true}
	if !validRoles[req.Role] {
		types.WriteError(w, http.StatusBadRequest, "Invalid role. Must be one of: user, admin, developer, viewer")
		return
	}

	// Prevent changing own role
	adminUser := auth.GetUserFromContext(r.Context())
	if adminUser != nil && adminUser.ID == req.UserID {
		types.WriteError(w, http.StatusBadRequest, "Cannot change your own role")
		return
	}

	service := auth.GetGlobalService()
	if err := service.UpdateUserRole(req.UserID, req.Role); err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if adminUser != nil {
		service.LogActivity(adminUser.ID, adminUser.Username, "role_change",
			"Changed role of "+req.UserID+" to "+req.Role, r.RemoteAddr, r.UserAgent())
	}

	utils.Info("User role updated", "target_user_id", req.UserID, "new_role", req.Role)
	types.WriteSuccess(w, "Role updated", map[string]interface{}{
		"user_id": req.UserID,
		"role":    req.Role,
	})
}

// GetUserStatsHandler returns user statistics (admin only)
func GetUserStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	service := auth.GetGlobalService()
	stats, err := service.GetUserStats()
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	types.WriteSuccess(w, "User statistics", stats)
}

// ============================================
// ACTIVITY LOG HANDLERS
// ============================================

// GetActivityLogsHandler returns activity logs (admin only)
func GetActivityLogsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID := r.URL.Query().Get("user_id")
	limit := 50
	offset := 0

	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	service := auth.GetGlobalService()
	logs, total, err := service.GetActivityLogs(userID, limit, offset)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	types.WriteSuccess(w, "Activity logs retrieved", map[string]interface{}{
		"logs":   logs,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}

// ============================================
// TEAM MANAGEMENT HANDLERS
// ============================================

// CreateTeamHandler creates a new team (admin/developer only)
func CreateTeamHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		types.WriteError(w, http.StatusBadRequest, "Team name is required")
		return
	}

	user := auth.GetUserFromContext(r.Context())
	service := auth.GetGlobalService()

	team, err := service.CreateTeam(req.Name, req.Description, user.ID)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	service.LogActivity(user.ID, user.Username, "create_team",
		"Created team: "+req.Name, r.RemoteAddr, r.UserAgent())

	types.WriteSuccess(w, "Team created", team)
}

// ListTeamsHandler lists all teams
func ListTeamsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	service := auth.GetGlobalService()
	teams, err := service.ListTeams()
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	types.WriteSuccess(w, "Teams retrieved", map[string]interface{}{
		"teams": teams,
		"count": len(teams),
	})
}

// GetTeamMembersHandler returns members of a team
func GetTeamMembersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	teamID := r.URL.Query().Get("team_id")
	if teamID == "" {
		types.WriteError(w, http.StatusBadRequest, "team_id is required")
		return
	}

	service := auth.GetGlobalService()
	members, err := service.GetTeamMembers(teamID)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	types.WriteSuccess(w, "Team members retrieved", map[string]interface{}{
		"members": members,
		"count":   len(members),
	})
}

// ManageTeamMemberHandler adds or removes team members
func ManageTeamMemberHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TeamID string `json:"team_id"`
		UserID string `json:"user_id"`
		Role   string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	service := auth.GetGlobalService()
	adminUser := auth.GetUserFromContext(r.Context())

	switch r.Method {
	case http.MethodPost:
		if req.Role == "" {
			req.Role = "member"
		}
		if err := service.AddTeamMember(req.TeamID, req.UserID, req.Role); err != nil {
			types.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		service.LogActivity(adminUser.ID, adminUser.Username, "add_team_member",
			"Added user "+req.UserID+" to team "+req.TeamID, r.RemoteAddr, r.UserAgent())
		types.WriteSuccess(w, "Member added to team", nil)

	case http.MethodDelete:
		if err := service.RemoveTeamMember(req.TeamID, req.UserID); err != nil {
			types.WriteError(w, http.StatusInternalServerError, err.Error())
			return
		}
		service.LogActivity(adminUser.ID, adminUser.Username, "remove_team_member",
			"Removed user "+req.UserID+" from team "+req.TeamID, r.RemoteAddr, r.UserAgent())
		types.WriteSuccess(w, "Member removed from team", nil)

	default:
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

// DeleteTeamHandler deletes a team (admin only)
func DeleteTeamHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	teamID := r.URL.Query().Get("team_id")
	if teamID == "" {
		types.WriteError(w, http.StatusBadRequest, "team_id is required")
		return
	}

	service := auth.GetGlobalService()
	adminUser := auth.GetUserFromContext(r.Context())

	if err := service.DeleteTeam(teamID); err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	service.LogActivity(adminUser.ID, adminUser.Username, "delete_team",
		"Deleted team "+teamID, r.RemoteAddr, r.UserAgent())

	types.WriteSuccess(w, "Team deleted", nil)
}
