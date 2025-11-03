package types

// CompletionRequest represents a request to generate text completion
type CompletionRequest struct {
	Model       string  `json:"model" validate:"required"`
	Prompt      string  `json:"prompt" validate:"required"`
	MaxTokens   int     `json:"max_tokens,omitempty"`
	Temperature float64 `json:"temperature,omitempty"`
	TopP        float64 `json:"top_p,omitempty"`
	UseCache    bool    `json:"use_cache"`
}

// CompletionResponse represents the response from a completion request
type CompletionResponse struct {
	ID        string  `json:"id"`
	Model     string  `json:"model"`
	Prompt    string  `json:"prompt"`
	Response  string  `json:"response"`
	Tokens    int     `json:"tokens"`
	Latency   int     `json:"latency_ms"`
	Cost      float64 `json:"cost"`
	CacheHit  bool    `json:"cache_hit"`
	Provider  string  `json:"provider"`
	CreatedAt string  `json:"created_at"`
}

// CachedCompletion represents a cached completion response
type CachedCompletion struct {
	Response string  `json:"response"`
	Tokens   int     `json:"tokens"`
	Cost     float64 `json:"cost"`
	Provider string  `json:"provider"`
	Model    string  `json:"model"`
	CachedAt string  `json:"cached_at"`
}
