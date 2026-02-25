package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// Result is a standardised LLM response.
type Result struct {
	Response     string
	InputTokens  int
	OutputTokens int
	TotalTokens  int
}

// Call dispatches to the correct provider and returns a real LLM response.
// endpoint is only used for local/self-hosted models.
func Call(ctx context.Context, provider, modelName, endpoint, prompt string, maxTokens int, temperature float64) (Result, error) {
	if maxTokens <= 0 {
		maxTokens = 512
	}
	if temperature == 0 {
		temperature = 0.7
	}

	switch provider {
	case "openai":
		return callOpenAICompat(ctx, "https://api.openai.com", os.Getenv("OPENAI_API_KEY"), modelName, prompt, maxTokens, temperature)
	case "anthropic":
		return callAnthropic(ctx, modelName, prompt, maxTokens, temperature)
	case "local":
		base := endpoint
		if base == "" {
			base = "http://localhost:8000"
		}
		return callOpenAICompat(ctx, base, "", modelName, prompt, maxTokens, temperature)
	default:
		return Result{}, fmt.Errorf("unsupported provider: %s", provider)
	}
}

// PingProvider makes a real lightweight HTTP call to verify the provider API
// is reachable and the API key is valid. Returns true on success.
func PingProvider(ctx context.Context, provider string) bool {
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	var (
		reqURL string
		req    *http.Request
		err    error
	)

	switch provider {
	case "openai":
		apiKey := os.Getenv("OPENAI_API_KEY")
		if apiKey == "" {
			return false
		}
		reqURL = "https://api.openai.com/v1/models"
		req, err = http.NewRequestWithContext(pingCtx, http.MethodGet, reqURL, nil)
		if err != nil {
			return false
		}
		req.Header.Set("Authorization", "Bearer "+apiKey)

	case "anthropic":
		apiKey := os.Getenv("ANTHROPIC_API_KEY")
		if apiKey == "" {
			return false
		}
		reqURL = "https://api.anthropic.com/v1/models"
		req, err = http.NewRequestWithContext(pingCtx, http.MethodGet, reqURL, nil)
		if err != nil {
			return false
		}
		req.Header.Set("x-api-key", apiKey)
		req.Header.Set("anthropic-version", "2023-06-01")

	default:
		// Unknown providers are assumed healthy
		return true
	}

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	// Drain body so the connection can be reused
	io.Copy(io.Discard, resp.Body) //nolint:errcheck
	return resp.StatusCode == http.StatusOK
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI / OpenAI-compatible API
// ─────────────────────────────────────────────────────────────────────────────

type openAIRequest struct {
	Model       string           `json:"model"`
	Messages    []openAIMessage  `json:"messages"`
	MaxTokens   int              `json:"max_tokens"`
	Temperature float64          `json:"temperature"`
}

type openAIMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
	Error *struct {
		Message string `json:"message"`
		Type    string `json:"type"`
	} `json:"error,omitempty"`
}

func callOpenAICompat(ctx context.Context, baseURL, apiKey, modelName, prompt string, maxTokens int, temperature float64) (Result, error) {
	reqBody := openAIRequest{
		Model:       modelName,
		Messages:    []openAIMessage{{Role: "user", Content: prompt}},
		MaxTokens:   maxTokens,
		Temperature: temperature,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return Result{}, fmt.Errorf("marshal openai request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return Result{}, fmt.Errorf("create openai request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return Result{}, fmt.Errorf("openai http: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return Result{}, fmt.Errorf("read openai response: %w", err)
	}

	var parsed openAIResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return Result{}, fmt.Errorf("unmarshal openai response: %w", err)
	}

	if parsed.Error != nil {
		return Result{}, fmt.Errorf("openai api error (%s): %s", parsed.Error.Type, parsed.Error.Message)
	}
	if len(parsed.Choices) == 0 {
		return Result{}, fmt.Errorf("openai returned no choices")
	}

	return Result{
		Response:     parsed.Choices[0].Message.Content,
		InputTokens:  parsed.Usage.PromptTokens,
		OutputTokens: parsed.Usage.CompletionTokens,
		TotalTokens:  parsed.Usage.TotalTokens,
	}, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Anthropic Messages API
// ─────────────────────────────────────────────────────────────────────────────

// anthropicModelMap translates the internal short names stored in the DB
// to the actual model IDs accepted by the Anthropic API.
var anthropicModelMap = map[string]string{
	"claude-3-opus":     "claude-opus-4-6",
	"claude-3-sonnet":   "claude-sonnet-4-6",
	"claude-3-haiku":    "claude-haiku-4-5-20251001",
	"claude-3-5-sonnet": "claude-sonnet-4-6",
	"claude-3-5-haiku":  "claude-haiku-4-5-20251001",
}

type anthropicRequest struct {
	Model       string             `json:"model"`
	Messages    []anthropicMessage `json:"messages"`
	MaxTokens   int                `json:"max_tokens"`
	Temperature float64            `json:"temperature,omitempty"`
}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Usage struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
	Error *struct {
		Type    string `json:"type"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func callAnthropic(ctx context.Context, modelName, prompt string, maxTokens int, temperature float64) (Result, error) {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	if apiKey == "" {
		return Result{}, fmt.Errorf("ANTHROPIC_API_KEY not set")
	}

	// Resolve to actual Anthropic API model ID
	apiModelID := modelName
	if mapped, ok := anthropicModelMap[modelName]; ok {
		apiModelID = mapped
	}

	reqBody := anthropicRequest{
		Model:       apiModelID,
		Messages:    []anthropicMessage{{Role: "user", Content: prompt}},
		MaxTokens:   maxTokens,
		Temperature: temperature,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return Result{}, fmt.Errorf("marshal anthropic request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.anthropic.com/v1/messages", bytes.NewReader(body))
	if err != nil {
		return Result{}, fmt.Errorf("create anthropic request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return Result{}, fmt.Errorf("anthropic http: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return Result{}, fmt.Errorf("read anthropic response: %w", err)
	}

	var parsed anthropicResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return Result{}, fmt.Errorf("unmarshal anthropic response: %w", err)
	}

	if parsed.Error != nil {
		return Result{}, fmt.Errorf("anthropic api error (%s): %s", parsed.Error.Type, parsed.Error.Message)
	}
	if len(parsed.Content) == 0 {
		return Result{}, fmt.Errorf("anthropic returned empty content")
	}

	return Result{
		Response:     parsed.Content[0].Text,
		InputTokens:  parsed.Usage.InputTokens,
		OutputTokens: parsed.Usage.OutputTokens,
		TotalTokens:  parsed.Usage.InputTokens + parsed.Usage.OutputTokens,
	}, nil
}
