package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	// JWTSecret should be loaded from environment variable
	JWTSecret = []byte("velocityllm-secret-key-change-in-production")

	// TokenExpiration defines how long tokens are valid
	TokenExpiration = 24 * time.Hour

	// RefreshTokenExpiration defines refresh token validity
	RefreshTokenExpiration = 7 * 24 * time.Hour
)

// Claims represents JWT claims
type Claims struct {
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

// GenerateToken generates a JWT token for a user
func GenerateToken(user *User) (string, error) {
	expirationTime := time.Now().Add(TokenExpiration)

	claims := &Claims{
		UserID:   user.ID,
		Email:    user.Email,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Issuer:    "velocityllm",
			Subject:   user.ID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(JWTSecret)
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// GenerateRefreshToken generates a refresh token
func GenerateRefreshToken(user *User) (string, error) {
	expirationTime := time.Now().Add(RefreshTokenExpiration)

	claims := &Claims{
		UserID:   user.ID,
		Email:    user.Email,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "velocityllm-refresh",
			Subject:   user.ID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(JWTSecret)
}

// ValidateToken validates a JWT token and returns claims
func ValidateToken(tokenString string) (*Claims, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		// Verify signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return JWTSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	return claims, nil
}

// RefreshAccessToken generates a new access token from a refresh token
func RefreshAccessToken(refreshToken string, user *User) (string, error) {
	claims, err := ValidateToken(refreshToken)
	if err != nil {
		return "", fmt.Errorf("invalid refresh token: %w", err)
	}

	// Verify the refresh token is for this user
	if claims.UserID != user.ID {
		return "", fmt.Errorf("token user mismatch")
	}

	// Generate new access token
	return GenerateToken(user)
}

// TokenPair represents access and refresh tokens
type TokenPair struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresIn    int64     `json:"expires_in"` // seconds
	TokenType    string    `json:"token_type"`
	ExpiresAt    time.Time `json:"expires_at"`
}

// GenerateTokenPair generates both access and refresh tokens
func GenerateTokenPair(user *User) (*TokenPair, error) {
	accessToken, err := GenerateToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	refreshToken, err := GenerateRefreshToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	expiresAt := time.Now().Add(TokenExpiration)

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int64(TokenExpiration.Seconds()),
		TokenType:    "Bearer",
		ExpiresAt:    expiresAt,
	}, nil
}
