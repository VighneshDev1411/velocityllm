package llm

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

const anthropicBaseURL = "https://api.anthropic.com/v1/messages"
const anthropicVersion = "2023-06-01"

// AnthropicClient handles communication with the Anthropic API
type AnthropicClient struct {
	apiKey     string
	httpClient *http.Client
}

// AnthropicMessage represents a message in the Anthropic format
type AnthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// AnthropicRequest represents an Anthropic messages API request
type AnthropicRequest struct {
	Model       string             `json:"model"`
	MaxTokens   int                `json:"max_tokens"`
	Messages    []AnthropicMessage `json:"messages"`
	Temperature float64            `json:"temperature,omitempty"`
	TopP        float64            `json:"top_p,omitempty"`
	Stream      bool               `json:"stream,omitempty"`
}

// AnthropicResponse represents an Anthropic messages API response
type AnthropicResponse struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Role    string `json:"role"`
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
	Model      string `json:"model"`
	StopReason string `json:"stop_reason"`
	Usage      struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
}

// AnthropicStreamEvent represents a streaming event from Anthropic
type AnthropicStreamEvent struct {
	Type  string `json:"type"`
	Index int    `json:"index,omitempty"`
	Delta *struct {
		Type string `json:"type,omitempty"`
		Text string `json:"text,omitempty"`
	} `json:"delta,omitempty"`
	ContentBlock *struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content_block,omitempty"`
	Message *AnthropicResponse `json:"message,omitempty"`
	Usage   *struct {
		OutputTokens int `json:"output_tokens"`
	} `json:"usage,omitempty"`
}

// NewAnthropicClient creates a new Anthropic client
func NewAnthropicClient() *AnthropicClient {
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	return &AnthropicClient{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// IsAvailable checks if the Anthropic API key is configured
func (c *AnthropicClient) IsAvailable() bool {
	return c.apiKey != ""
}

// Complete sends a messages request and returns the result
func (c *AnthropicClient) Complete(prompt string, model string, temperature float64, maxTokens int, topP float64) (*CompletionResult, error) {
	if !c.IsAvailable() {
		return nil, fmt.Errorf("Anthropic API key not configured")
	}

	anthropicModel := mapToAnthropicModel(model)

	reqBody := AnthropicRequest{
		Model:     anthropicModel,
		MaxTokens: maxTokens,
		Messages: []AnthropicMessage{
			{Role: "user", Content: prompt},
		},
		Temperature: temperature,
		TopP:        topP,
		Stream:      false,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	start := time.Now()

	req, err := http.NewRequest("POST", anthropicBaseURL, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("anthropic-version", anthropicVersion)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Anthropic API error (status %d): %s", resp.StatusCode, string(body))
	}

	var anthropicResp AnthropicResponse
	if err := json.Unmarshal(body, &anthropicResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	latency := time.Since(start).Milliseconds()

	responseText := ""
	for _, block := range anthropicResp.Content {
		if block.Type == "text" {
			responseText += block.Text
		}
	}

	return &CompletionResult{
		Response:         responseText,
		PromptTokens:     anthropicResp.Usage.InputTokens,
		CompletionTokens: anthropicResp.Usage.OutputTokens,
		TotalTokens:      anthropicResp.Usage.InputTokens + anthropicResp.Usage.OutputTokens,
		Model:            anthropicResp.Model,
		LatencyMs:        latency,
	}, nil
}

// StreamComplete sends a streaming messages request
func (c *AnthropicClient) StreamComplete(prompt string, model string, temperature float64, maxTokens int, topP float64, onToken func(token string) error) (*CompletionResult, error) {
	if !c.IsAvailable() {
		return nil, fmt.Errorf("Anthropic API key not configured")
	}

	anthropicModel := mapToAnthropicModel(model)

	reqBody := AnthropicRequest{
		Model:     anthropicModel,
		MaxTokens: maxTokens,
		Messages: []AnthropicMessage{
			{Role: "user", Content: prompt},
		},
		Temperature: temperature,
		TopP:        topP,
		Stream:      true,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	start := time.Now()

	req, err := http.NewRequest("POST", anthropicBaseURL, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", c.apiKey)
	req.Header.Set("anthropic-version", anthropicVersion)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Anthropic API error (status %d): %s", resp.StatusCode, string(body))
	}

	scanner := bufio.NewScanner(resp.Body)
	var fullResponse strings.Builder
	tokenCount := 0

	for scanner.Scan() {
		line := scanner.Text()

		if line == "" {
			continue
		}

		// Anthropic sends "event: " lines followed by "data: " lines
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")

		var event AnthropicStreamEvent
		if err := json.Unmarshal([]byte(data), &event); err != nil {
			continue
		}

		switch event.Type {
		case "content_block_delta":
			if event.Delta != nil && event.Delta.Text != "" {
				fullResponse.WriteString(event.Delta.Text)
				tokenCount++
				if err := onToken(event.Delta.Text); err != nil {
					return nil, fmt.Errorf("token callback error: %w", err)
				}
			}
		case "message_stop":
			// Stream complete
		}
	}

	latency := time.Since(start).Milliseconds()

	return &CompletionResult{
		Response:         fullResponse.String(),
		CompletionTokens: tokenCount,
		TotalTokens:      tokenCount,
		Model:            anthropicModel,
		LatencyMs:        latency,
	}, nil
}

// mapToAnthropicModel maps our internal model names to Anthropic API model names
func mapToAnthropicModel(model string) string {
	switch model {
	case "claude-3-opus", "claude-opus":
		return "claude-sonnet-4-20250514"
	case "claude-3-sonnet", "claude-sonnet":
		return "claude-sonnet-4-20250514"
	case "claude-3-haiku", "claude-haiku":
		return "claude-haiku-4-20250514"
	default:
		return "claude-sonnet-4-20250514"
	}
}

// IsAnthropicModel checks if a model name is an Anthropic model
func IsAnthropicModel(model string) bool {
	return strings.Contains(strings.ToLower(model), "claude")
}

// Global Anthropic client
var globalAnthropicClient *AnthropicClient

// GetAnthropicClient returns the global Anthropic client
func GetAnthropicClient() *AnthropicClient {
	if globalAnthropicClient == nil {
		globalAnthropicClient = NewAnthropicClient()
	}
	return globalAnthropicClient
}
