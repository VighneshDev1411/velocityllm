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

const openAIBaseURL = "https://api.openai.com/v1/chat/completions"

// OpenAIClient handles communication with the OpenAI API
type OpenAIClient struct {
	apiKey     string
	httpClient *http.Client
}

// ChatMessage represents a message in the chat format
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ChatRequest represents an OpenAI chat completion request
type ChatRequest struct {
	Model       string        `json:"model"`
	Messages    []ChatMessage `json:"messages"`
	Temperature float64       `json:"temperature,omitempty"`
	MaxTokens   int           `json:"max_tokens,omitempty"`
	TopP        float64       `json:"top_p,omitempty"`
	Stream      bool          `json:"stream,omitempty"`
}

// ChatResponse represents an OpenAI chat completion response
type ChatResponse struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []struct {
		Index   int `json:"index"`
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
		TotalTokens      int `json:"total_tokens"`
	} `json:"usage"`
}

// StreamChunk represents a streaming response chunk
type StreamChunk struct {
	ID      string `json:"id"`
	Object  string `json:"object"`
	Created int64  `json:"created"`
	Model   string `json:"model"`
	Choices []struct {
		Index int `json:"index"`
		Delta struct {
			Role    string `json:"role,omitempty"`
			Content string `json:"content,omitempty"`
		} `json:"delta"`
		FinishReason *string `json:"finish_reason"`
	} `json:"choices"`
}

// CompletionResult is the simplified result returned to our handlers
type CompletionResult struct {
	Response         string
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
	Model            string
	LatencyMs        int64
}

// NewOpenAIClient creates a new OpenAI client
func NewOpenAIClient() *OpenAIClient {
	apiKey := os.Getenv("OPENAI_API_KEY")
	return &OpenAIClient{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// IsAvailable checks if the OpenAI API key is configured
func (c *OpenAIClient) IsAvailable() bool {
	return c.apiKey != ""
}

// Complete sends a chat completion request and returns the result
func (c *OpenAIClient) Complete(prompt string, model string, temperature float64, maxTokens int, topP float64) (*CompletionResult, error) {
	if !c.IsAvailable() {
		return nil, fmt.Errorf("OpenAI API key not configured")
	}

	// Map model names to OpenAI-compatible names
	openAIModel := mapToOpenAIModel(model)

	reqBody := ChatRequest{
		Model: openAIModel,
		Messages: []ChatMessage{
			{Role: "user", Content: prompt},
		},
		Temperature: temperature,
		MaxTokens:   maxTokens,
		TopP:        topP,
		Stream:      false,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	start := time.Now()

	req, err := http.NewRequest("POST", openAIBaseURL, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

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
		return nil, fmt.Errorf("OpenAI API error (status %d): %s", resp.StatusCode, string(body))
	}

	var chatResp ChatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	latency := time.Since(start).Milliseconds()

	responseText := ""
	if len(chatResp.Choices) > 0 {
		responseText = chatResp.Choices[0].Message.Content
	}

	return &CompletionResult{
		Response:         responseText,
		PromptTokens:     chatResp.Usage.PromptTokens,
		CompletionTokens: chatResp.Usage.CompletionTokens,
		TotalTokens:      chatResp.Usage.TotalTokens,
		Model:            chatResp.Model,
		LatencyMs:        latency,
	}, nil
}

// StreamComplete sends a streaming chat completion request
// It calls the callback for each token received
func (c *OpenAIClient) StreamComplete(prompt string, model string, temperature float64, maxTokens int, topP float64, onToken func(token string) error) (*CompletionResult, error) {
	if !c.IsAvailable() {
		return nil, fmt.Errorf("OpenAI API key not configured")
	}

	openAIModel := mapToOpenAIModel(model)

	reqBody := ChatRequest{
		Model: openAIModel,
		Messages: []ChatMessage{
			{Role: "user", Content: prompt},
		},
		Temperature: temperature,
		MaxTokens:   maxTokens,
		TopP:        topP,
		Stream:      true,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	start := time.Now()

	req, err := http.NewRequest("POST", openAIBaseURL, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("OpenAI API error (status %d): %s", resp.StatusCode, string(body))
	}

	scanner := bufio.NewScanner(resp.Body)
	var fullResponse strings.Builder
	tokenCount := 0

	for scanner.Scan() {
		line := scanner.Text()

		// Skip empty lines
		if line == "" {
			continue
		}

		// Remove "data: " prefix
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")

		// Check for stream end
		if data == "[DONE]" {
			break
		}

		var chunk StreamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}

		if len(chunk.Choices) > 0 {
			content := chunk.Choices[0].Delta.Content
			if content != "" {
				fullResponse.WriteString(content)
				tokenCount++
				if err := onToken(content); err != nil {
					return nil, fmt.Errorf("token callback error: %w", err)
				}
			}
		}
	}

	latency := time.Since(start).Milliseconds()

	return &CompletionResult{
		Response:         fullResponse.String(),
		CompletionTokens: tokenCount,
		TotalTokens:      tokenCount,
		Model:            openAIModel,
		LatencyMs:        latency,
	}, nil
}

// mapToOpenAIModel maps our internal model names to OpenAI API model names
func mapToOpenAIModel(model string) string {
	switch model {
	case "gpt-4", "gpt-4-turbo":
		return "gpt-4o-mini"
	case "gpt-3.5-turbo":
		return "gpt-3.5-turbo"
	default:
		// For non-OpenAI models (claude, llama), use gpt-4o-mini as fallback
		return "gpt-4o-mini"
	}
}

// IsOpenAIModel checks if a model name is an OpenAI model
func IsOpenAIModel(model string) bool {
	return strings.Contains(strings.ToLower(model), "gpt")
}

// Global client
var globalClient *OpenAIClient

// GetClient returns the global OpenAI client
func GetClient() *OpenAIClient {
	if globalClient == nil {
		globalClient = NewOpenAIClient()
	}
	return globalClient
}
