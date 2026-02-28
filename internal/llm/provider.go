package llm

import "fmt"

// Provider routes requests to the correct LLM provider based on model name
type Provider struct {
	openai    *OpenAIClient
	anthropic *AnthropicClient
}

// NewProvider creates a provider with all available clients
func NewProvider() *Provider {
	return &Provider{
		openai:    GetClient(),
		anthropic: GetAnthropicClient(),
	}
}

// Complete routes a completion request to the appropriate provider
func (p *Provider) Complete(prompt string, model string, temperature float64, maxTokens int, topP float64) (*CompletionResult, error) {
	if IsAnthropicModel(model) && p.anthropic.IsAvailable() {
		return p.anthropic.Complete(prompt, model, temperature, maxTokens, topP)
	}

	if p.openai.IsAvailable() {
		return p.openai.Complete(prompt, model, temperature, maxTokens, topP)
	}

	return nil, fmt.Errorf("no LLM provider available for model: %s", model)
}

// StreamComplete routes a streaming request to the appropriate provider
func (p *Provider) StreamComplete(prompt string, model string, temperature float64, maxTokens int, topP float64, onToken func(string) error) (*CompletionResult, error) {
	if IsAnthropicModel(model) && p.anthropic.IsAvailable() {
		return p.anthropic.StreamComplete(prompt, model, temperature, maxTokens, topP, onToken)
	}

	if p.openai.IsAvailable() {
		return p.openai.StreamComplete(prompt, model, temperature, maxTokens, topP, onToken)
	}

	return nil, fmt.Errorf("no LLM provider available for model: %s", model)
}

// IsAvailable checks if any provider is available
func (p *Provider) IsAvailable() bool {
	return p.openai.IsAvailable() || p.anthropic.IsAvailable()
}

// AvailableProviders returns which providers are configured
func (p *Provider) AvailableProviders() []string {
	providers := make([]string, 0)
	if p.openai.IsAvailable() {
		providers = append(providers, "openai")
	}
	if p.anthropic.IsAvailable() {
		providers = append(providers, "anthropic")
	}
	return providers
}

// ChatStreamComplete routes a multi-turn streaming request to the appropriate provider
func (p *Provider) ChatStreamComplete(messages []ChatMessage, model string, temperature float64, maxTokens int, topP float64, onToken func(string) error) (*CompletionResult, error) {
	if IsAnthropicModel(model) && p.anthropic.IsAvailable() {
		return p.anthropic.ChatStreamComplete(messages, model, temperature, maxTokens, topP, onToken)
	}

	if p.openai.IsAvailable() {
		// Fallback: concatenate messages into a single prompt for OpenAI
		prompt := ""
		for _, m := range messages {
			prompt += fmt.Sprintf("%s: %s\n", m.Role, m.Content)
		}
		return p.openai.StreamComplete(prompt, model, temperature, maxTokens, topP, onToken)
	}

	return nil, fmt.Errorf("no LLM provider available for model: %s", model)
}

// Global provider
var globalProvider *Provider

// GetProvider returns the global provider
func GetProvider() *Provider {
	if globalProvider == nil {
		globalProvider = NewProvider()
	}
	return globalProvider
}
