package auth

import (
	"context"
	"net/http"
	"strings"
)

// ContextKey type for context keys
type ContextKey string

const (
	// UserContextKey is the key for user in context
	UserContextKey ContextKey = "user"
	// ClaimsContextKey is the key for JWT claims in context
	ClaimsContextKey ContextKey = "claims"
)

// AuthMiddleware validates JWT token and adds user to context
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get token from Authorization header
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error": "missing authorization header"}`, http.StatusUnauthorized)
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			http.Error(w, `{"error": "invalid authorization header format"}`, http.StatusUnauthorized)
			return
		}

		tokenString := parts[1]

		// Validate token
		claims, err := ValidateToken(tokenString)
		if err != nil {
			http.Error(w, `{"error": "invalid or expired token"}`, http.StatusUnauthorized)
			return
		}

		// Get user from database
		service := GetGlobalService()
		if service == nil {
			http.Error(w, `{"error": "auth service not initialized"}`, http.StatusInternalServerError)
			return
		}

		user, err := service.GetUserByID(claims.UserID)
		if err != nil {
			http.Error(w, `{"error": "user not found"}`, http.StatusUnauthorized)
			return
		}

		// Check if user is active
		if !user.Active {
			http.Error(w, `{"error": "account is deactivated"}`, http.StatusUnauthorized)
			return
		}

		// Add user and claims to context
		ctx := context.WithValue(r.Context(), UserContextKey, user)
		ctx = context.WithValue(ctx, ClaimsContextKey, claims)

		// Call next handler
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// OptionalAuthMiddleware is like AuthMiddleware but doesn't fail if no token
func OptionalAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			// No auth header, continue without user context
			next.ServeHTTP(w, r)
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			// Invalid format, continue without user context
			next.ServeHTTP(w, r)
			return
		}

		tokenString := parts[1]
		claims, err := ValidateToken(tokenString)
		if err != nil {
			// Invalid token, continue without user context
			next.ServeHTTP(w, r)
			return
		}

		service := GetGlobalService()
		if service == nil {
			next.ServeHTTP(w, r)
			return
		}

		user, err := service.GetUserByID(claims.UserID)
		if err != nil || !user.Active {
			next.ServeHTTP(w, r)
			return
		}

		// Add user to context
		ctx := context.WithValue(r.Context(), UserContextKey, user)
		ctx = context.WithValue(ctx, ClaimsContextKey, claims)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// RequireRole middleware requires specific role
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := GetUserFromContext(r.Context())
			if user == nil {
				http.Error(w, `{"error": "unauthorized"}`, http.StatusUnauthorized)
				return
			}

			// Check if user has required role
			hasRole := false
			for _, role := range roles {
				if user.Role == role {
					hasRole = true
					break
				}
			}

			if !hasRole {
				http.Error(w, `{"error": "insufficient permissions"}`, http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireAdmin middleware requires admin role
func RequireAdmin(next http.Handler) http.Handler {
	return RequireRole(RoleAdmin)(next)
}

// GetUserFromContext retrieves user from context
func GetUserFromContext(ctx context.Context) *User {
	user, ok := ctx.Value(UserContextKey).(*User)
	if !ok {
		return nil
	}
	return user
}

// GetClaimsFromContext retrieves JWT claims from context
func GetClaimsFromContext(ctx context.Context) *Claims {
	claims, ok := ctx.Value(ClaimsContextKey).(*Claims)
	if !ok {
		return nil
	}
	return claims
}
