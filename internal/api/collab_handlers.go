package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/collab"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// GetCollabStatsHandler returns collaboration stats (Day 53)
func GetCollabStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	m := collab.GetGlobalCollab()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Collaboration not initialized")
		return
	}
	types.WriteSuccess(w, "Collaboration stats retrieved", m.GetStats())
}

// GetWorkspacesHandler returns all workspaces (Day 53)
func GetWorkspacesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	m := collab.GetGlobalCollab()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Collaboration not initialized")
		return
	}
	workspaces := m.GetWorkspaces()
	types.WriteSuccess(w, "Workspaces retrieved", map[string]interface{}{
		"workspaces": workspaces,
		"count":      len(workspaces),
	})
}

// GetWorkspaceHandler returns a single workspace (Day 53)
func GetWorkspaceHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	m := collab.GetGlobalCollab()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Collaboration not initialized")
		return
	}
	wsID := r.URL.Query().Get("id")
	if wsID == "" {
		wsID = "ws-1"
	}
	ws := m.GetWorkspace(wsID)
	if ws == nil {
		types.WriteError(w, http.StatusNotFound, "Workspace not found")
		return
	}
	types.WriteSuccess(w, "Workspace retrieved", ws)
}

// GetSharedResourcesHandler returns shared resources (Day 53)
func GetSharedResourcesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	m := collab.GetGlobalCollab()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Collaboration not initialized")
		return
	}
	wsID := r.URL.Query().Get("workspace_id")
	if wsID == "" {
		wsID = "ws-1"
	}
	resources := m.GetSharedResources(wsID)
	types.WriteSuccess(w, "Shared resources retrieved", map[string]interface{}{
		"resources": resources,
		"count":     len(resources),
	})
}

// ShareResourceHandler shares a resource (Day 53)
func ShareResourceHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	m := collab.GetGlobalCollab()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Collaboration not initialized")
		return
	}
	var req struct {
		Type        string `json:"type"`
		Name        string `json:"name"`
		SharedBy    string `json:"shared_by"`
		WorkspaceID string `json:"workspace_id"`
		Permission  string `json:"permission"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" {
		types.WriteError(w, http.StatusBadRequest, "name required")
		return
	}
	if req.WorkspaceID == "" {
		req.WorkspaceID = "ws-1"
	}
	if req.Permission == "" {
		req.Permission = "edit"
	}
	if req.SharedBy == "" {
		req.SharedBy = "u-1"
	}
	res := m.ShareResource(collab.SharedResource{
		Type: req.Type, Name: req.Name, SharedBy: req.SharedBy,
		WorkspaceID: req.WorkspaceID, Permission: req.Permission,
	})
	types.WriteSuccess(w, "Resource shared", res)
}

// GetAuditLogHandler returns audit entries (Day 53)
func GetAuditLogHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	m := collab.GetGlobalCollab()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Collaboration not initialized")
		return
	}
	wsID := r.URL.Query().Get("workspace_id")
	if wsID == "" {
		wsID = "ws-1"
	}
	entries := m.GetAuditLog(wsID)
	types.WriteSuccess(w, "Audit log retrieved", map[string]interface{}{
		"entries": entries,
		"count":   len(entries),
	})
}

// AddMemberHandler adds a member to a workspace (Day 53)
func AddCollabMemberHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	m := collab.GetGlobalCollab()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Collaboration not initialized")
		return
	}
	var req struct {
		WorkspaceID string `json:"workspace_id"`
		UserID      string `json:"user_id"`
		Name        string `json:"name"`
		Email       string `json:"email"`
		Role        string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" || req.Email == "" {
		types.WriteError(w, http.StatusBadRequest, "name and email required")
		return
	}
	if req.WorkspaceID == "" {
		req.WorkspaceID = "ws-1"
	}
	if req.Role == "" {
		req.Role = "viewer"
	}
	if req.UserID == "" {
		req.UserID = fmt.Sprintf("u-%d", time.Now().UnixMilli())
	}

	member := collab.Member{
		UserID: req.UserID,
		Name:   req.Name,
		Email:  req.Email,
		Role:   collab.Role(req.Role),
		Avatar: string([]rune(req.Name)[0:1]),
	}
	if err := m.AddMember(req.WorkspaceID, member); err != nil {
		types.WriteError(w, http.StatusNotFound, err.Error())
		return
	}
	types.WriteSuccess(w, "Member added", member)
}

// UpdateMemberRoleHandler updates a member's role (Day 53)
func UpdateMemberRoleHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	m := collab.GetGlobalCollab()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Collaboration not initialized")
		return
	}
	var req struct {
		WorkspaceID string `json:"workspace_id"`
		UserID      string `json:"user_id"`
		Role        string `json:"role"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.UserID == "" || req.Role == "" {
		types.WriteError(w, http.StatusBadRequest, "user_id and role required")
		return
	}
	if req.WorkspaceID == "" {
		req.WorkspaceID = "ws-1"
	}
	if err := m.UpdateMemberRole(req.WorkspaceID, req.UserID, collab.Role(req.Role)); err != nil {
		types.WriteError(w, http.StatusNotFound, err.Error())
		return
	}
	types.WriteSuccess(w, "Member role updated", map[string]string{
		"user_id": req.UserID,
		"role":    req.Role,
	})
}

// GetCommentsHandler returns comments for a resource (Day 53)
func GetCollabCommentsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	m := collab.GetGlobalCollab()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Collaboration not initialized")
		return
	}
	resourceID := r.URL.Query().Get("resource_id")
	if resourceID == "" {
		types.WriteError(w, http.StatusBadRequest, "resource_id required")
		return
	}
	comments := m.GetComments(resourceID)
	types.WriteSuccess(w, "Comments retrieved", map[string]interface{}{
		"comments": comments,
		"count":    len(comments),
	})
}
