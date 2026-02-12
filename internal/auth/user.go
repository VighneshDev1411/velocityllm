package auth

import (
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// User represents a user in the system
type User struct {
	ID        string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Email     string    `gorm:"unique;not null" json:"email"`
	Username  string    `gorm:"unique;not null" json:"username"`
	Password  string    `gorm:"not null" json:"-"` // Never expose password in JSON
	FirstName string    `json:"first_name,omitempty"`
	LastName  string    `json:"last_name,omitempty"`
	Role      string    `gorm:"default:'user'" json:"role"` // user, admin, developer
	Active    bool      `gorm:"default:true" json:"active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UserRole constants
const (
	RoleUser      = "user"
	RoleAdmin     = "admin"
	RoleDeveloper = "developer"
)

// TableName specifies the table name for User model
func (User) TableName() string {
	return "users"
}

// HashPassword hashes the user's password using bcrypt
func (u *User) HashPassword(password string) error {
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.Password = string(hashedBytes)
	return nil
}

// CheckPassword compares the provided password with the hashed password
func (u *User) CheckPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password))
	return err == nil
}

// BeforeCreate hook to hash password before creating user
func (u *User) BeforeCreate(tx *gorm.DB) error {
	// Password should already be hashed, but check just in case
	if len(u.Password) < 60 { // bcrypt hash is 60 characters
		return u.HashPassword(u.Password)
	}
	return nil
}

// SafeUser returns user data without sensitive information
func (u *User) SafeUser() map[string]interface{} {
	return map[string]interface{}{
		"id":         u.ID,
		"email":      u.Email,
		"username":   u.Username,
		"first_name": u.FirstName,
		"last_name":  u.LastName,
		"role":       u.Role,
		"active":     u.Active,
		"created_at": u.CreatedAt,
	}
}

// IsAdmin checks if user has admin role
func (u *User) IsAdmin() bool {
	return u.Role == RoleAdmin
}

// IsDeveloper checks if user has developer role
func (u *User) IsDeveloper() bool {
	return u.Role == RoleDeveloper
}

// CanAccessAdminPanel checks if user can access admin features
func (u *User) CanAccessAdminPanel() bool {
	return u.IsAdmin() || u.IsDeveloper()
}
