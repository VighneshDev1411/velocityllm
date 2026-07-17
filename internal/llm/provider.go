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

// Complete routes a completion request to the appropriate provider.
// A Claude model is NEVER routed to OpenAI — if Anthropic isn't configured we
// return a clear error instead of silently sending a claude-* model to OpenAI
// (which OpenAI rejects, producing an empty response in the UI).
func (p *Provider) Complete(prompt string, model string, temperature float64, maxTokens int, topP float64) (*CompletionResult, error) {
	if IsAnthropicModel(model) {
		if !p.anthropic.IsAvailable() {
			return nil, fmt.Errorf("model %q requires Anthropic, but ANTHROPIC_API_KEY is not configured", model)
		}
		return p.anthropic.Complete(prompt, model, temperature, maxTokens, topP)
	}

	if p.openai.IsAvailable() {
		return p.openai.Complete(prompt, model, temperature, maxTokens, topP)
	}

	return nil, fmt.Errorf("no LLM provider available for model: %s", model)
}

// StreamComplete routes a streaming request to the appropriate provider.
// See Complete for why Claude models are not routed to OpenAI.
func (p *Provider) StreamComplete(prompt string, model string, temperature float64, maxTokens int, topP float64, onToken func(string) error) (*CompletionResult, error) {
	if IsAnthropicModel(model) {
		if !p.anthropic.IsAvailable() {
			return nil, fmt.Errorf("model %q requires Anthropic, but ANTHROPIC_API_KEY is not configured", model)
		}
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

// ChatStreamComplete routes a multi-turn streaming request to the appropriate
// provider. See Complete for why Claude models are not routed to OpenAI.
func (p *Provider) ChatStreamComplete(messages []ChatMessage, model string, temperature float64, maxTokens int, topP float64, onToken func(string) error) (*CompletionResult, error) {
	if IsAnthropicModel(model) {
		if !p.anthropic.IsAvailable() {
			return nil, fmt.Errorf("model %q requires Anthropic, but ANTHROPIC_API_KEY is not configured", model)
		}
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
