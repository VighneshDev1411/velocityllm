package auth

import (
	"time"

	"gorm.io/gorm"
)

// ActivityLog records user actions for audit trail
type ActivityLog struct {
	ID        string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	UserID    string    `gorm:"index;not null" json:"user_id"`
	Username  string    `json:"username"`
	Action    string    `gorm:"not null" json:"action"` // login, logout, role_change, profile_update, etc.
	Details   string    `json:"details,omitempty"`
	IPAddress string    `json:"ip_address,omitempty"`
	UserAgent string    `json:"user_agent,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

// TableName specifies the table name for ActivityLog model
func (ActivityLog) TableName() string {
	return "activity_logs"
}

// Team represents a user group
type Team struct {
	ID          string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Name        string    `gorm:"unique;not null" json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// TableName specifies the table name for Team model
func (Team) TableName() string {
	return "teams"
}

// TeamMember represents a user's membership in a team
type TeamMember struct {
	ID        string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	TeamID    string    `gorm:"index;not null" json:"team_id"`
	UserID    string    `gorm:"index;not null" json:"user_id"`
	Role      string    `gorm:"default:'member'" json:"role"` // owner, admin, member
	JoinedAt  time.Time `json:"joined_at"`
}

// TableName specifies the table name for TeamMember model
func (TeamMember) TableName() string {
	return "team_members"
}

// LogActivity records an activity in the database
func (s *Service) LogActivity(userID, username, action, details, ipAddress, userAgent string) {
	log := &ActivityLog{
		UserID:    userID,
		Username:  username,
		Action:    action,
		Details:   details,
		IPAddress: ipAddress,
		UserAgent: userAgent,
	}
	s.db.Create(log)
}

// GetActivityLogs retrieves activity logs with optional filters
func (s *Service) GetActivityLogs(userID string, limit, offset int) ([]ActivityLog, int64, error) {
	var logs []ActivityLog
	var total int64

	query := s.db.Model(&ActivityLog{})
	if userID != "" {
		query = query.Where("user_id = ?", userID)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

// UpdateUserRole updates a user's role (admin only)
func (s *Service) UpdateUserRole(userID, newRole string) error {
	validRoles := map[string]bool{
		RoleUser:      true,
		RoleAdmin:     true,
		RoleDeveloper: true,
		"viewer":      true,
	}
	if !validRoles[newRole] {
		return gorm.ErrInvalidValue
	}
	return s.db.Model(&User{}).Where("id = ?", userID).Update("role", newRole).Error
}

// DeleteUser permanently deletes a user
func (s *Service) DeleteUser(userID string) error {
	return s.db.Where("id = ?", userID).Delete(&User{}).Error
}

// SearchUsers searches users by email or username
func (s *Service) SearchUsers(query string, limit int) ([]User, error) {
	var users []User
	searchQuery := "%" + query + "%"
	if err := s.db.Where("email LIKE ? OR username LIKE ? OR first_name LIKE ? OR last_name LIKE ?",
		searchQuery, searchQuery, searchQuery, searchQuery).
		Limit(limit).Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

// CreateTeam creates a new team
func (s *Service) CreateTeam(name, description, createdBy string) (*Team, error) {
	team := &Team{
		Name:        name,
		Description: description,
		CreatedBy:   createdBy,
	}
	if err := s.db.Create(team).Error; err != nil {
		return nil, err
	}

	// Add creator as owner
	member := &TeamMember{
		TeamID: team.ID,
		UserID: createdBy,
		Role:   "owner",
	}
	s.db.Create(member)

	return team, nil
}

// ListTeams lists all teams
func (s *Service) ListTeams() ([]Team, error) {
	var teams []Team
	if err := s.db.Order("name ASC").Find(&teams).Error; err != nil {
		return nil, err
	}
	return teams, nil
}

// GetTeamMembers lists members of a team
func (s *Service) GetTeamMembers(teamID string) ([]map[string]interface{}, error) {
	var members []TeamMember
	if err := s.db.Where("team_id = ?", teamID).Find(&members).Error; err != nil {
		return nil, err
	}

	var result []map[string]interface{}
	for _, m := range members {
		user, err := s.GetUserByID(m.UserID)
		if err != nil {
			continue
		}
		result = append(result, map[string]interface{}{
			"member_id":  m.ID,
			"user":       user.SafeUser(),
			"team_role":  m.Role,
			"joined_at":  m.JoinedAt,
		})
	}
	return result, nil
}

// AddTeamMember adds a user to a team
func (s *Service) AddTeamMember(teamID, userID, role string) error {
	member := &TeamMember{
		TeamID: teamID,
		UserID: userID,
		Role:   role,
	}
	return s.db.Create(member).Error
}

// RemoveTeamMember removes a user from a team
func (s *Service) RemoveTeamMember(teamID, userID string) error {
	return s.db.Where("team_id = ? AND user_id = ?", teamID, userID).Delete(&TeamMember{}).Error
}

// DeleteTeam deletes a team and its memberships
func (s *Service) DeleteTeam(teamID string) error {
	s.db.Where("team_id = ?", teamID).Delete(&TeamMember{})
	return s.db.Where("id = ?", teamID).Delete(&Team{}).Error
}

// GetUserStats returns statistics about users
func (s *Service) GetUserStats() (map[string]interface{}, error) {
	var totalUsers, activeUsers, adminCount, devCount, viewerCount int64

	s.db.Model(&User{}).Count(&totalUsers)
	s.db.Model(&User{}).Where("active = ?", true).Count(&activeUsers)
	s.db.Model(&User{}).Where("role = ?", RoleAdmin).Count(&adminCount)
	s.db.Model(&User{}).Where("role = ?", RoleDeveloper).Count(&devCount)
	s.db.Model(&User{}).Where("role = ?", "viewer").Count(&viewerCount)

	var recentLogins int64
	s.db.Model(&ActivityLog{}).Where("action = ? AND created_at > NOW() - INTERVAL '24 hours'", "login").Count(&recentLogins)

	return map[string]interface{}{
		"total_users":           totalUsers,
		"active_users":          activeUsers,
		"inactive_users":        totalUsers - activeUsers,
		"admins":                adminCount,
		"developers":            devCount,
		"viewers":               viewerCount,
		"regular_users":         totalUsers - adminCount - devCount - viewerCount,
		"logins_last_24h":       recentLogins,
	}, nil
}

// AutoMigrate runs migrations for user management models
func (s *Service) AutoMigrateUserManagement() error {
	return s.db.AutoMigrate(&ActivityLog{}, &Team{}, &TeamMember{})
}
