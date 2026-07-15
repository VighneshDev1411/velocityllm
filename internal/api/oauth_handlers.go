package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/auth"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// oauthStateCookie holds the CSRF state (format "<provider>:<nonce>") between the
// redirect and callback steps of the OAuth flow.
const oauthStateCookie = "vlm_oauth_state"

// generateOAuthNonce returns a random hex string used for CSRF protection.
func generateOAuthNonce() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b)
}

// OAuth2 configuration loaded from environment
func getOAuthConfig() map[string]map[string]string {
	return map[string]map[string]string{
		"google": {
			"client_id":     os.Getenv("GOOGLE_CLIENT_ID"),
			"client_secret": os.Getenv("GOOGLE_CLIENT_SECRET"),
			"auth_url":      "https://accounts.google.com/o/oauth2/v2/auth",
			"token_url":     "https://oauth2.googleapis.com/token",
			"userinfo_url":  "https://www.googleapis.com/oauth2/v2/userinfo",
			"scope":         "openid email profile",
		},
		"github": {
			"client_id":     os.Getenv("GITHUB_CLIENT_ID"),
			"client_secret": os.Getenv("GITHUB_CLIENT_SECRET"),
			"auth_url":      "https://github.com/login/oauth/authorize",
			"token_url":     "https://github.com/login/oauth/access_token",
			"userinfo_url":  "https://api.github.com/user",
			"scope":         "read:user user:email",
		},
	}
}

func getRedirectBase() string {
	base := os.Getenv("OAUTH_REDIRECT_BASE_URL")
	if base == "" {
		base = "http://localhost:8080"
	}
	return base
}

// OAuthProvidersHandler returns available OAuth providers
func OAuthProvidersHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	config := getOAuthConfig()
	providers := make([]map[string]interface{}, 0)

	for name, cfg := range config {
		providers = append(providers, map[string]interface{}{
			"name":      name,
			"available": cfg["client_id"] != "",
		})
	}

	types.WriteSuccess(w, "OAuth providers", map[string]interface{}{
		"providers": providers,
	})
}

// OAuthRedirectHandler redirects user to OAuth provider's authorization page
func OAuthRedirectHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	provider := r.URL.Query().Get("provider")
	if provider == "" {
		types.WriteError(w, http.StatusBadRequest, "provider parameter required")
		return
	}

	config := getOAuthConfig()
	cfg, ok := config[provider]
	if !ok {
		types.WriteError(w, http.StatusBadRequest, "unsupported provider: "+provider)
		return
	}

	if cfg["client_id"] == "" {
		types.WriteError(w, http.StatusBadRequest, provider+" OAuth not configured. Set "+strings.ToUpper(provider)+"_CLIENT_ID and "+strings.ToUpper(provider)+"_CLIENT_SECRET environment variables.")
		return
	}

	// Clean, query-less redirect URI so it matches the Google/GitHub console entry
	// exactly. The provider is carried in `state` instead of the URI query.
	redirectURI := getRedirectBase() + "/api/v1/auth/oauth/callback"

	// state = "<provider>:<nonce>". The nonce is echoed back by the provider and
	// validated against an HttpOnly cookie on callback (real CSRF protection).
	state := provider + ":" + generateOAuthNonce()
	http.SetCookie(w, &http.Cookie{
		Name:     oauthStateCookie,
		Value:    state,
		Path:     "/",
		MaxAge:   600, // 10 minutes to complete the flow
		HttpOnly: true,
		Secure:   strings.HasPrefix(getRedirectBase(), "https://"),
		SameSite: http.SameSiteLaxMode,
	})

	params := url.Values{}
	params.Set("client_id", cfg["client_id"])
	params.Set("redirect_uri", redirectURI)
	params.Set("scope", cfg["scope"])
	params.Set("response_type", "code")
	params.Set("state", state)

	authURL := cfg["auth_url"] + "?" + params.Encode()

	utils.Info("OAuth redirect: provider=%s, url=%s", provider, cfg["auth_url"])
	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

// OAuthCallbackHandler handles the callback from OAuth provider
func OAuthCallbackHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	stateParam := r.URL.Query().Get("state")
	code := r.URL.Query().Get("code")
	errParam := r.URL.Query().Get("error")

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	if errParam != "" {
		http.Redirect(w, r, frontendURL+"/login?error="+url.QueryEscape("OAuth failed: "+errParam), http.StatusTemporaryRedirect)
		return
	}

	// CSRF: the state echoed back by the provider must match the nonce cookie set
	// during the redirect step.
	stateCookie, cookieErr := r.Cookie(oauthStateCookie)
	if cookieErr != nil || stateParam == "" || stateCookie.Value != stateParam {
		http.Redirect(w, r, frontendURL+"/login?error="+url.QueryEscape("Invalid OAuth state"), http.StatusTemporaryRedirect)
		return
	}
	// Consume the state cookie now that it's validated.
	http.SetCookie(w, &http.Cookie{Name: oauthStateCookie, Value: "", Path: "/", MaxAge: -1})

	// Provider is encoded in state as "<provider>:<nonce>".
	provider := stateParam
	if i := strings.IndexByte(stateParam, ':'); i > 0 {
		provider = stateParam[:i]
	}

	if code == "" {
		http.Redirect(w, r, frontendURL+"/login?error="+url.QueryEscape("No authorization code received"), http.StatusTemporaryRedirect)
		return
	}

	config := getOAuthConfig()
	cfg, ok := config[provider]
	if !ok {
		http.Redirect(w, r, frontendURL+"/login?error="+url.QueryEscape("Unknown provider"), http.StatusTemporaryRedirect)
		return
	}

	// Exchange code for token — redirect_uri must match the (clean) one used at redirect.
	redirectURI := getRedirectBase() + "/api/v1/auth/oauth/callback"
	accessToken, err := exchangeCodeForToken(cfg, code, redirectURI)
	if err != nil {
		utils.Error("OAuth token exchange failed: %v", err)
		http.Redirect(w, r, frontendURL+"/login?error="+url.QueryEscape("Token exchange failed"), http.StatusTemporaryRedirect)
		return
	}

	// Get user info from provider
	userInfo, err := getUserInfo(provider, cfg["userinfo_url"], accessToken)
	if err != nil {
		utils.Error("OAuth user info failed: %v", err)
		http.Redirect(w, r, frontendURL+"/login?error="+url.QueryEscape("Failed to get user info"), http.StatusTemporaryRedirect)
		return
	}

	// Find or create user
	authService := auth.GetGlobalService()
	if authService == nil {
		http.Redirect(w, r, frontendURL+"/login?error="+url.QueryEscape("Auth service unavailable"), http.StatusTemporaryRedirect)
		return
	}

	user, isNew, err := authService.FindOrCreateOAuthUser(
		provider,
		userInfo.ID,
		userInfo.Email,
		userInfo.Username,
		userInfo.FirstName,
		userInfo.LastName,
		userInfo.AvatarURL,
	)
	if err != nil {
		utils.Error("OAuth user creation failed: %v", err)
		http.Redirect(w, r, frontendURL+"/login?error="+url.QueryEscape("Account creation failed"), http.StatusTemporaryRedirect)
		return
	}

	// Generate JWT tokens
	tokens, err := auth.GenerateTokenPair(user)
	if err != nil {
		utils.Error("OAuth token generation failed: %v", err)
		http.Redirect(w, r, frontendURL+"/login?error="+url.QueryEscape("Token generation failed"), http.StatusTemporaryRedirect)
		return
	}

	action := "login"
	if isNew {
		action = "register"
	}

	utils.Info("OAuth %s successful: provider=%s, user=%s, email=%s", action, provider, user.Username, user.Email)

	// Redirect to frontend with tokens
	params := url.Values{}
	params.Set("access_token", tokens.AccessToken)
	params.Set("refresh_token", tokens.RefreshToken)
	params.Set("provider", provider)
	params.Set("action", action)

	http.Redirect(w, r, frontendURL+"/oauth/callback?"+params.Encode(), http.StatusTemporaryRedirect)
}

// exchangeCodeForToken exchanges authorization code for access token
func exchangeCodeForToken(cfg map[string]string, code, redirectURI string) (string, error) {
	data := url.Values{}
	data.Set("client_id", cfg["client_id"])
	data.Set("client_secret", cfg["client_secret"])
	data.Set("code", code)
	data.Set("redirect_uri", redirectURI)
	data.Set("grant_type", "authorization_code")

	req, err := http.NewRequest("POST", cfg["token_url"], strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("token request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read token response: %w", err)
	}

	var tokenResp map[string]interface{}
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", fmt.Errorf("failed to parse token response: %w", err)
	}

	if errMsg, ok := tokenResp["error"]; ok {
		return "", fmt.Errorf("token error: %v - %v", errMsg, tokenResp["error_description"])
	}

	accessToken, ok := tokenResp["access_token"].(string)
	if !ok || accessToken == "" {
		return "", fmt.Errorf("no access_token in response")
	}

	return accessToken, nil
}

// OAuthUserInfo holds normalized user info from OAuth provider
type OAuthUserInfo struct {
	ID        string
	Email     string
	Username  string
	FirstName string
	LastName  string
	AvatarURL string
}

// getUserInfo fetches user info from OAuth provider
func getUserInfo(provider, userinfoURL, accessToken string) (*OAuthUserInfo, error) {
	req, err := http.NewRequest("GET", userinfoURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")

	// GitHub requires User-Agent header
	if provider == "github" {
		req.Header.Set("User-Agent", "VelocityLLM")
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("userinfo request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read userinfo response: %w", err)
	}

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("failed to parse userinfo: %w", err)
	}

	switch provider {
	case "google":
		return parseGoogleUser(data)
	case "github":
		return parseGitHubUser(data, accessToken)
	default:
		return nil, fmt.Errorf("unsupported provider: %s", provider)
	}
}

func parseGoogleUser(data map[string]interface{}) (*OAuthUserInfo, error) {
	email, _ := data["email"].(string)
	if email == "" {
		return nil, fmt.Errorf("no email in Google response")
	}

	id, _ := data["id"].(string)
	name, _ := data["name"].(string)
	picture, _ := data["picture"].(string)

	parts := strings.SplitN(name, " ", 2)
	firstName := ""
	lastName := ""
	if len(parts) > 0 {
		firstName = parts[0]
	}
	if len(parts) > 1 {
		lastName = parts[1]
	}

	username := strings.Split(email, "@")[0]

	return &OAuthUserInfo{
		ID:        id,
		Email:     email,
		Username:  username,
		FirstName: firstName,
		LastName:  lastName,
		AvatarURL: picture,
	}, nil
}

func parseGitHubUser(data map[string]interface{}, accessToken string) (*OAuthUserInfo, error) {
	id := fmt.Sprintf("%.0f", data["id"])
	login, _ := data["login"].(string)
	name, _ := data["name"].(string)
	avatarURL, _ := data["avatar_url"].(string)
	email, _ := data["email"].(string)

	// If email is not public, fetch from /user/emails
	if email == "" {
		email = fetchGitHubEmail(accessToken)
	}

	if email == "" {
		email = login + "@github.com"
	}

	parts := strings.SplitN(name, " ", 2)
	firstName := ""
	lastName := ""
	if len(parts) > 0 {
		firstName = parts[0]
	}
	if len(parts) > 1 {
		lastName = parts[1]
	}

	return &OAuthUserInfo{
		ID:        id,
		Email:     email,
		Username:  login,
		FirstName: firstName,
		LastName:  lastName,
		AvatarURL: avatarURL,
	}, nil
}

func fetchGitHubEmail(accessToken string) string {
	req, err := http.NewRequest("GET", "https://api.github.com/user/emails", nil)
	if err != nil {
		return ""
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "VelocityLLM")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return ""
	}

	var emails []map[string]interface{}
	if err := json.Unmarshal(body, &emails); err != nil {
		return ""
	}

	// Find primary email
	for _, e := range emails {
		if primary, ok := e["primary"].(bool); ok && primary {
			if email, ok := e["email"].(string); ok {
				return email
			}
		}
	}

	// Fallback to first email
	if len(emails) > 0 {
		if email, ok := emails[0]["email"].(string); ok {
			return email
		}
	}

	return ""
}
