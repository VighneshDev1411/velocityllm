package auth

import (
	"fmt"
	"regexp"
	"strings"

	"gorm.io/gorm"
)

// Service handles authentication operations
type Service struct {
	db *gorm.DB
}

// NewService creates a new authentication service
func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

// RegisterRequest represents a user registration request
type RegisterRequest struct {
	Email     string `json:"email"`
	Username  string `json:"username"`
	Password  string `json:"password"`
	FirstName string `json:"first_name,omitempty"`
	LastName  string `json:"last_name,omitempty"`
}

// LoginRequest represents a user login request
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// Validate validates the registration request
func (r *RegisterRequest) Validate() error {
	// Email validation
	if r.Email == "" {
		return fmt.Errorf("email is required")
	}
	if !isValidEmail(r.Email) {
		return fmt.Errorf("invalid email format")
	}

	// Username validation
	if r.Username == "" {
		return fmt.Errorf("username is required")
	}
	if len(r.Username) < 3 {
		return fmt.Errorf("username must be at least 3 characters")
	}
	if !isValidUsername(r.Username) {
		return fmt.Errorf("username can only contain letters, numbers, and underscores")
	}

	// Password validation
	if r.Password == "" {
		return fmt.Errorf("password is required")
	}
	if len(r.Password) < 8 {
		return fmt.Errorf("password must be at least 8 characters")
	}

	return nil
}

// Register creates a new user account
func (s *Service) Register(req *RegisterRequest) (*User, error) {
	// Validate request
	if err := req.Validate(); err != nil {
		return nil, err
	}

	// Check if email already exists
	var existingUser User
	if err := s.db.Where("email = ?", strings.ToLower(req.Email)).First(&existingUser).Error; err == nil {
		return nil, fmt.Errorf("email already registered")
	}

	// Check if username already exists
	if err := s.db.Where("username = ?", req.Username).First(&existingUser).Error; err == nil {
		return nil, fmt.Errorf("username already taken")
	}

	// Create new user
	user := &User{
		Email:     strings.ToLower(req.Email),
		Username:  req.Username,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Role:      RoleUser,
		Active:    true,
	}

	// Hash password
	if err := user.HashPassword(req.Password); err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Save to database
	if err := s.db.Create(user).Error; err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	return user, nil
}

// Login authenticates a user and returns token pair
func (s *Service) Login(req *LoginRequest) (*User, *TokenPair, error) {
	// Find user by email
	var user User
	if err := s.db.Where("email = ?", strings.ToLower(req.Email)).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil, fmt.Errorf("invalid email or password")
		}
		return nil, nil, fmt.Errorf("database error: %w", err)
	}

	// Check if user is active
	if !user.Active {
		return nil, nil, fmt.Errorf("account is deactivated")
	}

	// Verify password
	if !user.CheckPassword(req.Password) {
		return nil, nil, fmt.Errorf("invalid email or password")
	}

	// Generate token pair
	tokens, err := GenerateTokenPair(&user)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	return &user, tokens, nil
}

// GetUserByID retrieves a user by ID
func (s *Service) GetUserByID(userID string) (*User, error) {
	var user User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("user not found")
		}
		return nil, err
	}
	return &user, nil
}

// FindOrCreateOAuthUser finds existing user by OAuth ID or email, or creates a new one
func (s *Service) FindOrCreateOAuthUser(provider, oauthID, email, username, firstName, lastName, avatarURL string) (*User, bool, error) {
	var user User

	// First try to find by OAuth provider + ID
	if err := s.db.Where("oauth_provider = ? AND oauth_id = ?", provider, oauthID).First(&user).Error; err == nil {
		return &user, false, nil
	}

	// Try to find by email
	if err := s.db.Where("email = ?", strings.ToLower(email)).First(&user).Error; err == nil {
		// Link OAuth to existing account
		s.db.Model(&user).Updates(map[string]interface{}{
			"oauth_provider": provider,
			"oauth_id":       oauthID,
			"avatar_url":     avatarURL,
		})
		return &user, false, nil
	}

	// Ensure unique username
	baseUsername := username
	if baseUsername == "" {
		baseUsername = strings.Split(email, "@")[0]
	}
	finalUsername := baseUsername
	counter := 1
	for {
		var count int64
		s.db.Model(&User{}).Where("username = ?", finalUsername).Count(&count)
		if count == 0 {
			break
		}
		finalUsername = fmt.Sprintf("%s_%d", baseUsername, counter)
		counter++
	}

	// Create new user
	user = User{
		Email:         strings.ToLower(email),
		Username:      finalUsername,
		Password:      "$oauth$", // OAuth users don't have a password
		FirstName:     firstName,
		LastName:      lastName,
		Role:          RoleUser,
		Active:        true,
		OAuthProvider: provider,
		OAuthID:       oauthID,
		AvatarURL:     avatarURL,
	}

	if err := s.db.Create(&user).Error; err != nil {
		return nil, false, fmt.Errorf("failed to create OAuth user: %w", err)
	}

	return &user, true, nil
}

// GetUserByEmail retrieves a user by email
func (s *Service) GetUserByEmail(email string) (*User, error) {
	var user User
	if err := s.db.Where("email = ?", strings.ToLower(email)).First(&user).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("user not found")
		}
		return nil, err
	}
	return &user, nil
}

// UpdateUser updates user information
func (s *Service) UpdateUser(userID string, updates map[string]interface{}) error {
	// Don't allow password updates through this method
	delete(updates, "password")
	delete(updates, "email") // Email should have separate verification flow

	return s.db.Model(&User{}).Where("id = ?", userID).Updates(updates).Error
}

// ChangePassword changes a user's password
func (s *Service) ChangePassword(userID, oldPassword, newPassword string) error {
	user, err := s.GetUserByID(userID)
	if err != nil {
		return err
	}

	// Verify old password
	if !user.CheckPassword(oldPassword) {
		return fmt.Errorf("incorrect current password")
	}

	// Validate new password
	if len(newPassword) < 8 {
		return fmt.Errorf("new password must be at least 8 characters")
	}

	// Hash and update password
	if err := user.HashPassword(newPassword); err != nil {
		return err
	}

	return s.db.Model(&User{}).Where("id = ?", userID).Update("password", user.Password).Error
}

// DeactivateUser deactivates a user account
func (s *Service) DeactivateUser(userID string) error {
	return s.db.Model(&User{}).Where("id = ?", userID).Update("active", false).Error
}

// ListUsers lists all users (admin function)
func (s *Service) ListUsers(limit, offset int) ([]User, int64, error) {
	var users []User
	var total int64

	if err := s.db.Model(&User{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := s.db.Limit(limit).Offset(offset).Find(&users).Error; err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

// Helper functions

func isValidEmail(email string) bool {
	emailRegex := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	return emailRegex.MatchString(email)
}

func isValidUsername(username string) bool {
	usernameRegex := regexp.MustCompile(`^[a-zA-Z0-9_]+$`)
	return usernameRegex.MatchString(username)
}

// Global service instance
var globalService *Service

// InitGlobalService initializes the global auth service
func InitGlobalService(db *gorm.DB) {
	globalService = NewService(db)
}

// GetGlobalService returns the global auth service
func GetGlobalService() *Service {
	return globalService
}
