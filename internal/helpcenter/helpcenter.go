package helpcenter

import (
	"fmt"
	"log"
	"strings"
	"sync"
	"time"
)

// Guide represents a help guide / tutorial.
type Guide struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Category    string   `json:"category"` // getting-started, api, platform, deployment, security
	Summary     string   `json:"summary"`
	Content     string   `json:"content"`
	Tags        []string `json:"tags"`
	ReadTime    string   `json:"read_time"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// FAQ represents a frequently asked question.
type FAQ struct {
	ID       string `json:"id"`
	Question string `json:"question"`
	Answer   string `json:"answer"`
	Category string `json:"category"`
	Votes    int    `json:"votes"`
}

// Tutorial represents a step-by-step tutorial.
type Tutorial struct {
	ID          string           `json:"id"`
	Title       string           `json:"title"`
	Description string           `json:"description"`
	Difficulty  string           `json:"difficulty"` // beginner, intermediate, advanced
	Steps       []TutorialStep   `json:"steps"`
	Tags        []string         `json:"tags"`
	EstTime     string           `json:"est_time"`
}

// TutorialStep is a single step in a tutorial.
type TutorialStep struct {
	Title   string `json:"title"`
	Content string `json:"content"`
	Code    string `json:"code,omitempty"`
}

// HelpCenterManager manages all help center content.
type HelpCenterManager struct {
	mu        sync.RWMutex
	guides    []*Guide
	faqs      []*FAQ
	tutorials []*Tutorial
}

var (
	globalHC     *HelpCenterManager
	globalHCLock sync.RWMutex
)

func InitGlobalHelpCenter() *HelpCenterManager {
	mgr := &HelpCenterManager{}
	mgr.seedContent()

	globalHCLock.Lock()
	globalHC = mgr
	globalHCLock.Unlock()

	log.Printf("[HelpCenter] Initialized: guides=%d faqs=%d tutorials=%d", len(mgr.guides), len(mgr.faqs), len(mgr.tutorials))
	return mgr
}

func GetGlobalHelpCenter() *HelpCenterManager {
	globalHCLock.RLock()
	defer globalHCLock.RUnlock()
	return globalHC
}

func (m *HelpCenterManager) seedContent() {
	now := time.Now()

	m.guides = []*Guide{
		{ID: "g-1", Title: "Getting Started with VelocityLLM", Category: "getting-started", Summary: "Set up your first LLM inference pipeline in under 5 minutes", Content: "VelocityLLM is a production-grade LLM inference engine that provides intelligent routing, caching, and monitoring for your AI workloads. This guide walks you through initial setup, API key creation, and your first completion request.", Tags: []string{"quickstart", "setup", "beginner"}, ReadTime: "5 min", UpdatedAt: now.Add(-24 * time.Hour)},
		{ID: "g-2", Title: "Authentication & API Keys", Category: "api", Summary: "Learn how to create, manage, and rotate API keys securely", Content: "VelocityLLM uses Bearer token authentication. Create API keys with specific scopes (completions, analytics, admin) from the API Keys page. Keys follow the format vlm_sk_... and should never be exposed client-side. Rotate keys every 90 days for security.", Tags: []string{"auth", "api-keys", "security"}, ReadTime: "4 min", UpdatedAt: now.Add(-48 * time.Hour)},
		{ID: "g-3", Title: "Multi-Provider Routing", Category: "platform", Summary: "Configure intelligent routing across OpenAI, Anthropic, Mistral, and more", Content: "The router evaluates each request against provider health, latency, cost, and capability. Strategies include cost-optimized, latency-optimized, round-robin, and smart routing. Circuit breakers automatically failover on provider outages.", Tags: []string{"routing", "providers", "failover"}, ReadTime: "7 min", UpdatedAt: now.Add(-72 * time.Hour)},
		{ID: "g-4", Title: "Streaming Completions", Category: "api", Summary: "Use Server-Sent Events (SSE) for real-time token streaming", Content: "For long outputs, use the /api/v1/completions/stream endpoint. Tokens arrive as SSE events, enabling typewriter-style rendering. Set Accept: text/event-stream and handle data: events. The stream ends with a [DONE] sentinel.", Tags: []string{"streaming", "sse", "real-time"}, ReadTime: "6 min", UpdatedAt: now.Add(-96 * time.Hour)},
		{ID: "g-5", Title: "RAG & Knowledge Base", Category: "platform", Summary: "Upload documents and query them with retrieval-augmented generation", Content: "Upload PDFs, markdown, or text files to create a knowledge base. VelocityLLM chunks, embeds, and indexes documents automatically. Use the /api/v1/rag/query endpoint to ask questions grounded in your documents.", Tags: []string{"rag", "documents", "embeddings"}, ReadTime: "8 min", UpdatedAt: now.Add(-120 * time.Hour)},
		{ID: "g-6", Title: "Deploying to Kubernetes", Category: "deployment", Summary: "Production deployment with Helm charts and horizontal scaling", Content: "VelocityLLM ships with Kubernetes manifests and Helm charts. Configure resource limits, HPA for autoscaling, and health probes. Use the included Prometheus ServiceMonitor for metrics scraping.", Tags: []string{"kubernetes", "helm", "production"}, ReadTime: "10 min", UpdatedAt: now.Add(-144 * time.Hour)},
		{ID: "g-7", Title: "Security Best Practices", Category: "security", Summary: "Harden your VelocityLLM deployment with these security measures", Content: "Enable TLS 1.3, configure CORS strictly, use rate limiting, rotate secrets regularly, scan dependencies for vulnerabilities, and enable WAF rules. VelocityLLM supports SOC2, GDPR, PCI-DSS, and HIPAA compliance checks.", Tags: []string{"security", "compliance", "hardening"}, ReadTime: "8 min", UpdatedAt: now.Add(-168 * time.Hour)},
		{ID: "g-8", Title: "Caching Strategies", Category: "platform", Summary: "Reduce latency and cost with multi-level and semantic caching", Content: "VelocityLLM provides L1 (in-memory), L2 (Redis), and semantic caching. Semantic cache matches similar prompts using embedding similarity. Configure TTLs, cache warming, and tag-based invalidation for fine-grained control.", Tags: []string{"caching", "performance", "cost"}, ReadTime: "6 min", UpdatedAt: now.Add(-192 * time.Hour)},
	}

	m.faqs = []*FAQ{
		{ID: "f-1", Question: "What LLM providers does VelocityLLM support?", Answer: "VelocityLLM supports OpenAI (GPT-4o, GPT-4, GPT-3.5), Anthropic (Claude 3.5 Sonnet, Claude 3 Opus), Mistral (Large, Medium), and Groq (Llama, Mixtral). Custom model endpoints can be added via the Model Hosting feature.", Category: "general", Votes: 42},
		{ID: "f-2", Question: "How does the smart routing work?", Answer: "The smart router considers model health, current latency, cost per token, and request characteristics. It uses circuit breakers to detect unhealthy providers, automatic failover, and can be configured with strategies like cost-optimized, latency-optimized, or round-robin.", Category: "routing", Votes: 38},
		{ID: "f-3", Question: "What's the maximum prompt length?", Answer: "Maximum prompt length depends on the selected model's context window. GPT-4o supports 128K tokens, Claude 3.5 supports 200K tokens. VelocityLLM automatically handles context management and truncation.", Category: "api", Votes: 35},
		{ID: "f-4", Question: "How does semantic caching work?", Answer: "Semantic caching uses embedding vectors to find similar past prompts. If a new prompt has >85% cosine similarity to a cached prompt, the cached response is returned instantly. This works across paraphrases and minor wording changes.", Category: "caching", Votes: 31},
		{ID: "f-5", Question: "Can I self-host VelocityLLM?", Answer: "Yes, VelocityLLM is designed for self-hosting. Deploy using Docker, Kubernetes (Helm charts provided), or directly via the Go binary. You need PostgreSQL for persistence and optionally Redis for caching and distributed features.", Category: "deployment", Votes: 28},
		{ID: "f-6", Question: "How are API keys scoped?", Answer: "API keys can be scoped to: completions (inference only), analytics (read metrics), admin (full access). Keys follow the principle of least privilege — create separate keys for different services.", Category: "security", Votes: 25},
		{ID: "f-7", Question: "What monitoring is available?", Answer: "VelocityLLM provides built-in metrics (latency, throughput, errors, cost), distributed tracing, structured logging, SLO tracking, and alerting. It also exposes a Prometheus-compatible /metrics endpoint.", Category: "monitoring", Votes: 22},
		{ID: "f-8", Question: "How do I set up webhooks?", Answer: "Create webhooks via the API or UI. Specify the target URL, event types (completion.created, model.error, etc.), and an optional secret for HMAC-SHA256 signature verification. Failed deliveries are retried with exponential backoff.", Category: "api", Votes: 19},
		{ID: "f-9", Question: "What's the difference between fine-tuning and RAG?", Answer: "Fine-tuning modifies a model's weights to specialize it for your use case (expensive, permanent). RAG retrieves relevant documents at query time to provide context (cheaper, dynamic). Use RAG for knowledge that changes frequently, fine-tuning for specialized behavior.", Category: "general", Votes: 33},
		{ID: "f-10", Question: "How does rate limiting work?", Answer: "Rate limiting is enforced per API key at 100 requests/minute by default (configurable per tier). When exceeded, the API returns 429 with a Retry-After header. In clustered deployments, rate limits are distributed via Redis sliding windows.", Category: "api", Votes: 27},
	}

	m.tutorials = []*Tutorial{
		{
			ID: "t-1", Title: "Your First Completion Request", Description: "Make your first API call to VelocityLLM and get an AI response", Difficulty: "beginner", EstTime: "5 min",
			Tags: []string{"quickstart", "api"},
			Steps: []TutorialStep{
				{Title: "Get Your API Key", Content: "Navigate to the API Keys page and create a new key with 'completions' scope."},
				{Title: "Make a Request", Content: "Use curl or your preferred HTTP client to send a completion request.", Code: "curl -X POST http://localhost:8080/api/v1/completions \\\n  -H 'Authorization: Bearer YOUR_KEY' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"prompt\": \"Hello, world!\"}'"},
				{Title: "Check the Response", Content: "The response includes the completion text, model used, token count, latency, and cost."},
			},
		},
		{
			ID: "t-2", Title: "Setting Up RAG with Document Upload", Description: "Upload documents and query them with AI-powered retrieval", Difficulty: "intermediate", EstTime: "15 min",
			Tags: []string{"rag", "documents", "embeddings"},
			Steps: []TutorialStep{
				{Title: "Upload a Document", Content: "Upload a document to the knowledge base.", Code: "curl -X POST http://localhost:8080/api/v1/rag/documents \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"title\": \"Company Handbook\", \"content\": \"...\", \"type\": \"text\"}'"},
				{Title: "Query the Knowledge Base", Content: "Ask a question and VelocityLLM will find relevant documents and generate an answer.", Code: "curl -X POST http://localhost:8080/api/v1/rag/query \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"query\": \"What is our PTO policy?\"}'"},
				{Title: "Review Retrieved Documents", Content: "The response includes both the AI answer and the source documents used, with relevance scores."},
			},
		},
		{
			ID: "t-3", Title: "Building a Workflow Pipeline", Description: "Create a multi-step LLM workflow with conditional routing", Difficulty: "advanced", EstTime: "20 min",
			Tags: []string{"workflows", "pipelines", "advanced"},
			Steps: []TutorialStep{
				{Title: "Design Your Workflow", Content: "Open the Workflow Builder and add nodes: a prompt node, a conditional router, and two output nodes."},
				{Title: "Configure Nodes", Content: "Set the prompt template, routing conditions (e.g., sentiment > 0.5 routes to path A), and output formatting."},
				{Title: "Test the Workflow", Content: "Run the workflow with sample inputs. Check execution traces to verify each step.", Code: "curl -X POST http://localhost:8080/api/v1/workflows/workflows/execute \\\n  -d '{\"id\": \"wf-1\", \"input\": {\"text\": \"Analyze this...\"}}'"},
				{Title: "Deploy to Production", Content: "Enable the workflow and it will be available via the API. Monitor execution metrics on the Workflows page."},
			},
		},
		{
			ID: "t-4", Title: "Monitoring & Alerting Setup", Description: "Configure alerts, SLOs, and dashboards for production monitoring", Difficulty: "intermediate", EstTime: "10 min",
			Tags: []string{"monitoring", "alerts", "slo"},
			Steps: []TutorialStep{
				{Title: "Check Platform Health", Content: "Navigate to the Observability page to see real-time metrics, active alerts, and SLO status."},
				{Title: "Configure Alert Rules", Content: "Enable or disable alert rules for key metrics like error rate, latency P99, and throughput."},
				{Title: "Set Up SLOs", Content: "SLOs are pre-configured for availability (99.9%), latency (P99 < 500ms), error rate (<1%), and throughput."},
				{Title: "Connect External Monitoring", Content: "VelocityLLM exposes Prometheus metrics. Configure Grafana dashboards using the provided templates."},
			},
		},
	}
}

// ── Getters ─────────────────────────────────────────────

func (m *HelpCenterManager) GetGuides() []*Guide { m.mu.RLock(); defer m.mu.RUnlock(); r := make([]*Guide, len(m.guides)); copy(r, m.guides); return r }
func (m *HelpCenterManager) GetFAQs() []*FAQ { m.mu.RLock(); defer m.mu.RUnlock(); r := make([]*FAQ, len(m.faqs)); copy(r, m.faqs); return r }
func (m *HelpCenterManager) GetTutorials() []*Tutorial { m.mu.RLock(); defer m.mu.RUnlock(); r := make([]*Tutorial, len(m.tutorials)); copy(r, m.tutorials); return r }

func (m *HelpCenterManager) Search(query string) map[string]interface{} {
	m.mu.RLock(); defer m.mu.RUnlock()
	q := strings.ToLower(query)
	var guides []*Guide
	var faqs []*FAQ
	var tutorials []*Tutorial
	for _, g := range m.guides {
		if strings.Contains(strings.ToLower(g.Title), q) || strings.Contains(strings.ToLower(g.Summary), q) || containsTag(g.Tags, q) { guides = append(guides, g) }
	}
	for _, f := range m.faqs {
		if strings.Contains(strings.ToLower(f.Question), q) || strings.Contains(strings.ToLower(f.Answer), q) { faqs = append(faqs, f) }
	}
	for _, t := range m.tutorials {
		if strings.Contains(strings.ToLower(t.Title), q) || strings.Contains(strings.ToLower(t.Description), q) || containsTag(t.Tags, q) { tutorials = append(tutorials, t) }
	}
	return map[string]interface{}{"guides": guides, "faqs": faqs, "tutorials": tutorials, "total": len(guides) + len(faqs) + len(tutorials)}
}

func (m *HelpCenterManager) GetStats() map[string]interface{} {
	m.mu.RLock(); defer m.mu.RUnlock()
	categories := make(map[string]int)
	for _, g := range m.guides { categories[g.Category]++ }
	return map[string]interface{}{
		"guides":     len(m.guides),
		"faqs":       len(m.faqs),
		"tutorials":  len(m.tutorials),
		"categories": categories,
	}
}

func (m *HelpCenterManager) VoteFAQ(id string) error {
	m.mu.Lock(); defer m.mu.Unlock()
	for _, f := range m.faqs {
		if f.ID == id { f.Votes++; return nil }
	}
	return fmt.Errorf("FAQ not found: %s", id)
}

func containsTag(tags []string, q string) bool {
	for _, t := range tags {
		if strings.Contains(strings.ToLower(t), q) { return true }
	}
	return false
}
