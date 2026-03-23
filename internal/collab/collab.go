package collab

import (
	"fmt"
	"log"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

// Role defines a collaborator's permission level.
type Role string

const (
	RoleOwner  Role = "owner"
	RoleAdmin  Role = "admin"
	RoleEditor Role = "editor"
	RoleViewer Role = "viewer"
)

// Workspace represents a shared collaboration workspace.
type Workspace struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	OwnerID     string            `json:"owner_id"`
	Members     []Member          `json:"members"`
	Channels    []Channel         `json:"channels"`
	Settings    WorkspaceSettings `json:"settings"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// Member represents a workspace member.
type Member struct {
	UserID   string    `json:"user_id"`
	Name     string    `json:"name"`
	Email    string    `json:"email"`
	Role     Role      `json:"role"`
	Status   string    `json:"status"` // online, away, offline
	Avatar   string    `json:"avatar"`
	JoinedAt time.Time `json:"joined_at"`
	LastSeen time.Time `json:"last_seen"`
}

// Channel represents a communication channel within a workspace.
type Channel struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"` // general, project, direct
	Members   []string  `json:"members"`
	CreatedAt time.Time `json:"created_at"`
}

// WorkspaceSettings configures workspace behavior.
type WorkspaceSettings struct {
	AllowGuestAccess    bool `json:"allow_guest_access"`
	RequireApproval     bool `json:"require_approval"`
	SharedPromptLibrary bool `json:"shared_prompt_library"`
	SharedWorkflows     bool `json:"shared_workflows"`
	AuditLogging        bool `json:"audit_logging"`
	MaxMembers          int  `json:"max_members"`
}

// SharedResource represents a resource shared within a workspace.
type SharedResource struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"` // prompt, workflow, dataset, model_config
	Name        string    `json:"name"`
	SharedBy    string    `json:"shared_by"`
	WorkspaceID string    `json:"workspace_id"`
	Permission  string    `json:"permission"` // view, edit, admin
	Version     int       `json:"version"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// AuditEntry records an action in the workspace.
type AuditEntry struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	UserID      string    `json:"user_id"`
	UserName    string    `json:"user_name"`
	Action      string    `json:"action"`
	Resource    string    `json:"resource"`
	Details     string    `json:"details"`
	Timestamp   time.Time `json:"timestamp"`
}

// Comment represents a comment on a shared resource.
type Comment struct {
	ID         string    `json:"id"`
	ResourceID string    `json:"resource_id"`
	UserID     string    `json:"user_id"`
	UserName   string    `json:"user_name"`
	Content    string    `json:"content"`
	CreatedAt  time.Time `json:"created_at"`
}

// CollabStats tracks collaboration metrics.
type CollabStats struct {
	TotalWorkspaces   int64 `json:"total_workspaces"`
	TotalMembers      int64 `json:"total_members"`
	ActiveMembers     int64 `json:"active_members"`
	SharedResources   int64 `json:"shared_resources"`
	AuditEntries      int64 `json:"audit_entries"`
	Comments          int64 `json:"comments"`
	MessagesExchanged int64 `json:"messages_exchanged"`
}

// CollabManager manages collaboration features.
type CollabManager struct {
	mu         sync.RWMutex
	workspaces map[string]*Workspace
	resources  map[string]*SharedResource
	audit      []*AuditEntry
	comments   []*Comment
	stats      *CollabStats
	stopCh     chan struct{}
}

// Global instance
var (
	globalCollab     *CollabManager
	globalCollabLock sync.RWMutex
)

// InitGlobalCollab initializes the collaboration manager.
func InitGlobalCollab() *CollabManager {
	mgr := &CollabManager{
		workspaces: make(map[string]*Workspace),
		resources:  make(map[string]*SharedResource),
		audit:      make([]*AuditEntry, 0),
		comments:   make([]*Comment, 0),
		stats:      &CollabStats{},
		stopCh:     make(chan struct{}),
	}

	// Seed demo data
	mgr.seedDemoData()

	globalCollabLock.Lock()
	globalCollab = mgr
	globalCollabLock.Unlock()

	log.Printf("[Collab] Initialized: workspaces=%d", len(mgr.workspaces))
	return mgr
}

// GetGlobalCollab returns the global collab manager.
func GetGlobalCollab() *CollabManager {
	globalCollabLock.RLock()
	defer globalCollabLock.RUnlock()
	return globalCollab
}

func (m *CollabManager) seedDemoData() {
	now := time.Now()

	members := []Member{
		{UserID: "u-1", Name: "Vignesh D.", Email: "vignesh@velocityllm.com", Role: RoleOwner, Status: "online", Avatar: "VD", JoinedAt: now.Add(-30 * 24 * time.Hour), LastSeen: now},
		{UserID: "u-2", Name: "Sarah Chen", Email: "sarah@velocityllm.com", Role: RoleAdmin, Status: "online", Avatar: "SC", JoinedAt: now.Add(-25 * 24 * time.Hour), LastSeen: now.Add(-5 * time.Minute)},
		{UserID: "u-3", Name: "Alex Kumar", Email: "alex@velocityllm.com", Role: RoleEditor, Status: "away", Avatar: "AK", JoinedAt: now.Add(-20 * 24 * time.Hour), LastSeen: now.Add(-2 * time.Hour)},
		{UserID: "u-4", Name: "Maria Lopez", Email: "maria@velocityllm.com", Role: RoleEditor, Status: "online", Avatar: "ML", JoinedAt: now.Add(-15 * 24 * time.Hour), LastSeen: now.Add(-10 * time.Minute)},
		{UserID: "u-5", Name: "James Wilson", Email: "james@velocityllm.com", Role: RoleViewer, Status: "offline", Avatar: "JW", JoinedAt: now.Add(-10 * 24 * time.Hour), LastSeen: now.Add(-24 * time.Hour)},
	}

	ws := &Workspace{
		ID:          "ws-1",
		Name:        "VelocityLLM Core Team",
		Description: "Main workspace for the LLM platform development team",
		OwnerID:     "u-1",
		Members:     members,
		Channels: []Channel{
			{ID: "ch-1", Name: "general", Type: "general", Members: []string{"u-1", "u-2", "u-3", "u-4", "u-5"}, CreatedAt: now.Add(-30 * 24 * time.Hour)},
			{ID: "ch-2", Name: "model-tuning", Type: "project", Members: []string{"u-1", "u-2", "u-3"}, CreatedAt: now.Add(-20 * 24 * time.Hour)},
			{ID: "ch-3", Name: "prompt-eng", Type: "project", Members: []string{"u-1", "u-4"}, CreatedAt: now.Add(-15 * 24 * time.Hour)},
		},
		Settings: WorkspaceSettings{
			AllowGuestAccess:    false,
			RequireApproval:     true,
			SharedPromptLibrary: true,
			SharedWorkflows:     true,
			AuditLogging:        true,
			MaxMembers:          50,
		},
		CreatedAt: now.Add(-30 * 24 * time.Hour),
		UpdatedAt: now,
	}

	m.workspaces[ws.ID] = ws

	// Shared resources
	resourceTypes := []struct{ typ, name, sharedBy string }{
		{"prompt", "Customer Support Template", "u-2"},
		{"prompt", "Code Review Prompt v3", "u-1"},
		{"workflow", "Content Pipeline", "u-4"},
		{"workflow", "Data Extraction Flow", "u-3"},
		{"dataset", "Fine-tuning Dataset Q4", "u-1"},
		{"model_config", "GPT-4 Optimized Config", "u-2"},
	}
	for i, r := range resourceTypes {
		res := &SharedResource{
			ID:          fmt.Sprintf("res-%d", i+1),
			Type:        r.typ,
			Name:        r.name,
			SharedBy:    r.sharedBy,
			WorkspaceID: "ws-1",
			Permission:  "edit",
			Version:     rand.Intn(5) + 1,
			CreatedAt:   now.Add(-time.Duration(rand.Intn(20)+1) * 24 * time.Hour),
			UpdatedAt:   now.Add(-time.Duration(rand.Intn(48)) * time.Hour),
		}
		m.resources[res.ID] = res
	}

	// Audit log
	actions := []struct{ user, name, action, resource, details string }{
		{"u-1", "Vignesh D.", "created", "workflow:Content Pipeline", "Created new workflow with 5 steps"},
		{"u-2", "Sarah Chen", "shared", "prompt:Customer Support Template", "Shared with workspace"},
		{"u-3", "Alex Kumar", "edited", "dataset:Fine-tuning Dataset Q4", "Added 500 training examples"},
		{"u-4", "Maria Lopez", "commented", "prompt:Code Review Prompt v3", "Suggested improvements to system prompt"},
		{"u-1", "Vignesh D.", "deployed", "model_config:GPT-4 Optimized Config", "Deployed to production"},
		{"u-2", "Sarah Chen", "invited", "member:James Wilson", "Invited as viewer"},
		{"u-3", "Alex Kumar", "updated", "workflow:Data Extraction Flow", "Updated extraction rules"},
		{"u-4", "Maria Lopez", "created", "prompt:Summarization v2", "New summarization template"},
	}
	for i, a := range actions {
		m.audit = append(m.audit, &AuditEntry{
			ID:          fmt.Sprintf("audit-%d", i+1),
			WorkspaceID: "ws-1",
			UserID:      a.user,
			UserName:    a.name,
			Action:      a.action,
			Resource:    a.resource,
			Details:     a.details,
			Timestamp:   now.Add(-time.Duration(i*3+1) * time.Hour),
		})
	}

	// Comments
	commentData := []struct{ resID, user, name, content string }{
		{"res-2", "u-4", "Maria Lopez", "The system prompt could use more specific instructions for edge cases."},
		{"res-2", "u-1", "Vignesh D.", "Good point. I'll add error handling instructions."},
		{"res-3", "u-2", "Sarah Chen", "Can we add a validation step before the LLM call?"},
	}
	for i, c := range commentData {
		m.comments = append(m.comments, &Comment{
			ID:         fmt.Sprintf("cmt-%d", i+1),
			ResourceID: c.resID,
			UserID:     c.user,
			UserName:   c.name,
			Content:    c.content,
			CreatedAt:  now.Add(-time.Duration(i*6+2) * time.Hour),
		})
	}

	m.stats.TotalWorkspaces = 1
	m.stats.TotalMembers = int64(len(members))
	m.stats.ActiveMembers = 3
	m.stats.SharedResources = int64(len(m.resources))
	m.stats.AuditEntries = int64(len(m.audit))
	m.stats.Comments = int64(len(m.comments))
	m.stats.MessagesExchanged = int64(rand.Intn(500) + 100)
}

// ── Workspace Operations ────────────────────────────────

// GetWorkspaces returns all workspaces.
func (m *CollabManager) GetWorkspaces() []*Workspace {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make([]*Workspace, 0, len(m.workspaces))
	for _, ws := range m.workspaces {
		result = append(result, ws)
	}
	return result
}

// GetWorkspace returns a workspace by ID.
func (m *CollabManager) GetWorkspace(id string) *Workspace {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.workspaces[id]
}

// AddMember adds a member to a workspace.
func (m *CollabManager) AddMember(wsID string, member Member) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	ws, ok := m.workspaces[wsID]
	if !ok {
		return fmt.Errorf("workspace not found: %s", wsID)
	}
	member.JoinedAt = time.Now()
	member.LastSeen = time.Now()
	member.Status = "online"
	ws.Members = append(ws.Members, member)
	ws.UpdatedAt = time.Now()
	atomic.AddInt64(&m.stats.TotalMembers, 1)
	atomic.AddInt64(&m.stats.ActiveMembers, 1)
	return nil
}

// UpdateMemberRole updates a member's role.
func (m *CollabManager) UpdateMemberRole(wsID, userID string, role Role) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	ws, ok := m.workspaces[wsID]
	if !ok {
		return fmt.Errorf("workspace not found: %s", wsID)
	}
	for i := range ws.Members {
		if ws.Members[i].UserID == userID {
			ws.Members[i].Role = role
			ws.UpdatedAt = time.Now()
			return nil
		}
	}
	return fmt.Errorf("member not found: %s", userID)
}

// ── Shared Resources ────────────────────────────────────

// GetSharedResources returns all shared resources for a workspace.
func (m *CollabManager) GetSharedResources(wsID string) []*SharedResource {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []*SharedResource
	for _, r := range m.resources {
		if r.WorkspaceID == wsID {
			result = append(result, r)
		}
	}
	return result
}

// ShareResource shares a resource in a workspace.
func (m *CollabManager) ShareResource(res SharedResource) *SharedResource {
	m.mu.Lock()
	defer m.mu.Unlock()
	res.ID = fmt.Sprintf("res-%d", time.Now().UnixMilli())
	res.CreatedAt = time.Now()
	res.UpdatedAt = time.Now()
	res.Version = 1
	m.resources[res.ID] = &res
	atomic.AddInt64(&m.stats.SharedResources, 1)
	return &res
}

// ── Audit Log ───────────────────────────────────────────

// GetAuditLog returns audit entries for a workspace.
func (m *CollabManager) GetAuditLog(wsID string) []*AuditEntry {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []*AuditEntry
	for _, e := range m.audit {
		if e.WorkspaceID == wsID {
			result = append(result, e)
		}
	}
	return result
}

// AddAuditEntry records an action.
func (m *CollabManager) AddAuditEntry(entry AuditEntry) {
	m.mu.Lock()
	defer m.mu.Unlock()
	entry.ID = fmt.Sprintf("audit-%d", time.Now().UnixMilli())
	entry.Timestamp = time.Now()
	m.audit = append(m.audit, &entry)
	if len(m.audit) > 100 {
		m.audit = m.audit[len(m.audit)-100:]
	}
	atomic.AddInt64(&m.stats.AuditEntries, 1)
}

// ── Comments ────────────────────────────────────────────

// GetComments returns comments for a resource.
func (m *CollabManager) GetComments(resourceID string) []*Comment {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []*Comment
	for _, c := range m.comments {
		if c.ResourceID == resourceID {
			result = append(result, c)
		}
	}
	return result
}

// AddComment adds a comment to a resource.
func (m *CollabManager) AddComment(comment Comment) *Comment {
	m.mu.Lock()
	defer m.mu.Unlock()
	comment.ID = fmt.Sprintf("cmt-%d", time.Now().UnixMilli())
	comment.CreatedAt = time.Now()
	m.comments = append(m.comments, &comment)
	atomic.AddInt64(&m.stats.Comments, 1)
	return &comment
}

// ── Stats ───────────────────────────────────────────────

// GetStats returns collaboration statistics.
func (m *CollabManager) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"total_workspaces":   atomic.LoadInt64(&m.stats.TotalWorkspaces),
		"total_members":      atomic.LoadInt64(&m.stats.TotalMembers),
		"active_members":     atomic.LoadInt64(&m.stats.ActiveMembers),
		"shared_resources":   atomic.LoadInt64(&m.stats.SharedResources),
		"audit_entries":      atomic.LoadInt64(&m.stats.AuditEntries),
		"comments":           atomic.LoadInt64(&m.stats.Comments),
		"messages_exchanged": atomic.LoadInt64(&m.stats.MessagesExchanged),
	}
}

// Stop gracefully shuts down.
func (m *CollabManager) Stop() {
	close(m.stopCh)
	log.Printf("[Collab] Stopped")
}
