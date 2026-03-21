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

// BatchCompletionRequest represents a request to run the same prompt against multiple models
type BatchCompletionRequest struct {
	Prompt      string   `json:"prompt" validate:"required"`
	Models      []string `json:"models" validate:"required"`
	MaxTokens   int      `json:"max_tokens,omitempty"`
	Temperature float64  `json:"temperature,omitempty"`
	TopP        float64  `json:"top_p,omitempty"`
}

// BatchCompletionItem represents a single model's result in a batch run
type BatchCompletionItem struct {
	Model    string  `json:"model"`
	Provider string  `json:"provider"`
	Response string  `json:"response"`
	Tokens   int     `json:"tokens"`
	Latency  int     `json:"latency_ms"`
	Cost     float64 `json:"cost"`
	Error    string  `json:"error,omitempty"`
	Success  bool    `json:"success"`
}

// BatchCompletionResult represents the full result of a batch comparison run
type BatchCompletionResult struct {
	ID          string                `json:"id"`
	Prompt      string                `json:"prompt"`
	Models      []string              `json:"models"`
	Results     []BatchCompletionItem `json:"results"`
	TotalTimeMs int                   `json:"total_time_ms"`
	CreatedAt   string                `json:"created_at"`
}

// StreamChunk represents a single chunk in a streaming response
type StreamChunk struct {
	ID      string `json:"id"`
	Model   string `json:"model"`
	Content string `json:"content"`
	Index   int    `json:"index"`
	Done    bool   `json:"done"`
}
