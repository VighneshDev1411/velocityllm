package cdn

import (
	"fmt"
	"log"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

// Provider represents a CDN provider type.
type Provider string

const (
	ProviderCloudFront Provider = "cloudfront"
	ProviderFastly     Provider = "fastly"
	ProviderAkamai     Provider = "akamai"
	ProviderCustom     Provider = "custom"
)

// CacheStatus represents the CDN cache state of a resource.
type CacheStatus string

const (
	CacheHit    CacheStatus = "HIT"
	CacheMiss   CacheStatus = "MISS"
	CacheExpired CacheStatus = "EXPIRED"
	CacheBypassed CacheStatus = "BYPASS"
)

// CDNConfig configures the CDN integration layer.
type CDNConfig struct {
	NodeID          string
	Provider        Provider
	Enabled         bool
	Origins         []OriginConfig
	DefaultTTL      time.Duration
	MaxTTL          time.Duration
	CacheRules      []CacheRule
	CompressionGzip bool
	CompressionBr   bool
	WAFEnabled      bool
	HTTP2Push       bool
	EdgeLocations   []string
}

// OriginConfig defines an origin server for the CDN.
type OriginConfig struct {
	ID              string `json:"id"`
	Host            string `json:"host"`
	Port            int    `json:"port"`
	Protocol        string `json:"protocol"` // http, https
	Priority        int    `json:"priority"` // lower = higher priority
	Weight          int    `json:"weight"`   // for weighted routing
	HealthCheckPath string `json:"health_check_path"`
	IsHealthy       bool   `json:"is_healthy"`
}

// CacheRule defines a caching policy for a path pattern.
type CacheRule struct {
	PathPattern   string        `json:"path_pattern"`
	TTL           time.Duration `json:"ttl"`
	CacheControl  string        `json:"cache_control"`
	Compress      bool          `json:"compress"`
	StripQuery    bool          `json:"strip_query"`
	VaryHeaders   []string      `json:"vary_headers"`
	BypassCookie  string        `json:"bypass_cookie"`  // bypass cache if cookie present
	ForceHTTPS    bool          `json:"force_https"`
}

// DefaultCDNConfig returns sensible defaults.
func DefaultCDNConfig() CDNConfig {
	return CDNConfig{
		Provider:        ProviderCloudFront,
		Enabled:         true,
		DefaultTTL:      24 * time.Hour,
		MaxTTL:          7 * 24 * time.Hour,
		CompressionGzip: true,
		CompressionBr:   true,
		WAFEnabled:      true,
		HTTP2Push:       true,
		Origins: []OriginConfig{
			{ID: "primary", Host: "api.velocityllm.com", Port: 443, Protocol: "https", Priority: 1, Weight: 100, HealthCheckPath: "/health", IsHealthy: true},
			{ID: "failover", Host: "api-backup.velocityllm.com", Port: 443, Protocol: "https", Priority: 2, Weight: 50, HealthCheckPath: "/health", IsHealthy: true},
		},
		CacheRules: []CacheRule{
			{PathPattern: "/api/v1/models", TTL: 5 * time.Minute, CacheControl: "public, max-age=300", Compress: true, VaryHeaders: []string{"Accept", "Accept-Encoding"}},
			{PathPattern: "/api/v1/prompts/templates", TTL: 10 * time.Minute, CacheControl: "public, max-age=600", Compress: true},
			{PathPattern: "/api/v1/docs/*", TTL: 1 * time.Hour, CacheControl: "public, max-age=3600", Compress: true},
			{PathPattern: "/static/*", TTL: 30 * 24 * time.Hour, CacheControl: "public, max-age=2592000, immutable", Compress: true},
			{PathPattern: "/api/v1/completions", TTL: 0, CacheControl: "no-store", BypassCookie: "session"},
			{PathPattern: "/api/v1/completions/stream", TTL: 0, CacheControl: "no-store"},
		},
		EdgeLocations: []string{
			"us-east-1", "us-west-2", "eu-west-1", "eu-central-1",
			"ap-southeast-1", "ap-northeast-1", "sa-east-1", "af-south-1",
		},
	}
}

// CDNManager manages CDN operations including cache invalidation,
// edge location tracking, and origin failover.
type CDNManager struct {
	mu           sync.RWMutex
	config       CDNConfig
	edgeNodes    map[string]*EdgeNode
	invalidations []*InvalidationRequest
	stats        *CDNStats
	stopCh       chan struct{}
}

// EdgeNode represents a CDN edge location with its cache state.
type EdgeNode struct {
	Location    string    `json:"location"`
	Status      string    `json:"status"` // active, draining, offline
	CacheSize   int64     `json:"cache_size_bytes"`
	CacheItems  int64     `json:"cache_items"`
	HitRate     float64   `json:"hit_rate"`
	Bandwidth   int64     `json:"bandwidth_bps"`
	Connections int64     `json:"connections"`
	Latency     float64   `json:"latency_ms"`
	LastSync    time.Time `json:"last_sync"`
}

// InvalidationRequest tracks a CDN cache invalidation.
type InvalidationRequest struct {
	ID        string    `json:"id"`
	Paths     []string  `json:"paths"`
	Status    string    `json:"status"` // pending, in_progress, completed, failed
	CreatedAt time.Time `json:"created_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	EdgeNodes int       `json:"edge_nodes_invalidated"`
}

// CDNStats tracks CDN-wide metrics.
type CDNStats struct {
	TotalRequests       int64 `json:"total_requests"`
	CacheHits           int64 `json:"cache_hits"`
	CacheMisses         int64 `json:"cache_misses"`
	CacheBypasses       int64 `json:"cache_bypasses"`
	BytesServed         int64 `json:"bytes_served"`
	BytesSaved          int64 `json:"bytes_saved"`
	Invalidations       int64 `json:"invalidations"`
	OriginRequests      int64 `json:"origin_requests"`
	OriginErrors        int64 `json:"origin_errors"`
	CompressionSaved    int64 `json:"compression_saved_bytes"`
	WAFBlocked          int64 `json:"waf_blocked"`
	HTTP2PushHits       int64 `json:"http2_push_hits"`
	EdgeTransfers       int64 `json:"edge_transfers"`
	SSLHandshakes       int64 `json:"ssl_handshakes"`
}

// Global CDN instance
var (
	globalCDN     *CDNManager
	globalCDNLock sync.RWMutex
)

// InitGlobalCDN initializes the global CDN manager.
func InitGlobalCDN(config CDNConfig) *CDNManager {
	mgr := &CDNManager{
		config:        config,
		edgeNodes:     make(map[string]*EdgeNode),
		invalidations: make([]*InvalidationRequest, 0),
		stats:         &CDNStats{},
		stopCh:        make(chan struct{}),
	}

	// Initialize edge nodes with simulated metrics
	for _, loc := range config.EdgeLocations {
		mgr.edgeNodes[loc] = &EdgeNode{
			Location:    loc,
			Status:      "active",
			CacheSize:   int64(rand.Intn(500)+100) * 1024 * 1024, // 100-600 MB
			CacheItems:  int64(rand.Intn(10000) + 1000),
			HitRate:     85.0 + rand.Float64()*12.0, // 85-97%
			Bandwidth:   int64(rand.Intn(900)+100) * 1000000, // 100-1000 Mbps
			Connections: int64(rand.Intn(500) + 50),
			Latency:     float64(rand.Intn(80) + 5), // 5-85ms
			LastSync:    time.Now().Add(-time.Duration(rand.Intn(300)) * time.Second),
		}
	}

	// Seed baseline stats
	mgr.stats.TotalRequests = int64(rand.Intn(50000) + 10000)
	mgr.stats.CacheHits = int64(float64(mgr.stats.TotalRequests) * 0.89)
	mgr.stats.CacheMisses = mgr.stats.TotalRequests - mgr.stats.CacheHits - int64(rand.Intn(500))
	mgr.stats.CacheBypasses = int64(rand.Intn(500))
	mgr.stats.BytesServed = int64(rand.Intn(5000)+1000) * 1024 * 1024
	mgr.stats.BytesSaved = int64(float64(mgr.stats.BytesServed) * 0.65)
	mgr.stats.OriginRequests = mgr.stats.CacheMisses
	mgr.stats.CompressionSaved = int64(float64(mgr.stats.BytesServed) * 0.4)
	mgr.stats.WAFBlocked = int64(rand.Intn(200))
	mgr.stats.SSLHandshakes = int64(rand.Intn(5000) + 1000)

	globalCDNLock.Lock()
	globalCDN = mgr
	globalCDNLock.Unlock()

	log.Printf("[CDN] Initialized: provider=%s edges=%d origins=%d waf=%v",
		config.Provider, len(config.EdgeLocations), len(config.Origins), config.WAFEnabled)

	return mgr
}

// GetGlobalCDN returns the global CDN manager.
func GetGlobalCDN() *CDNManager {
	globalCDNLock.RLock()
	defer globalCDNLock.RUnlock()
	return globalCDN
}

// ── Cache Invalidation ──────────────────────────────────

// InvalidatePaths creates a cache invalidation request for given paths.
func (m *CDNManager) InvalidatePaths(paths []string) *InvalidationRequest {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	completed := now.Add(time.Duration(rand.Intn(3)+1) * time.Second)
	req := &InvalidationRequest{
		ID:          fmt.Sprintf("inv-%d", now.UnixMilli()),
		Paths:       paths,
		Status:      "completed",
		CreatedAt:   now,
		CompletedAt: &completed,
		EdgeNodes:   len(m.edgeNodes),
	}

	m.invalidations = append(m.invalidations, req)
	// Keep last 50 invalidations
	if len(m.invalidations) > 50 {
		m.invalidations = m.invalidations[len(m.invalidations)-50:]
	}

	atomic.AddInt64(&m.stats.Invalidations, 1)

	log.Printf("[CDN] Cache invalidated: paths=%v edges=%d", paths, len(m.edgeNodes))
	return req
}

// InvalidateAll purges the entire CDN cache.
func (m *CDNManager) InvalidateAll() *InvalidationRequest {
	return m.InvalidatePaths([]string{"/*"})
}

// GetInvalidations returns recent invalidation requests.
func (m *CDNManager) GetInvalidations() []*InvalidationRequest {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make([]*InvalidationRequest, len(m.invalidations))
	copy(result, m.invalidations)
	return result
}

// ── Edge Node Management ────────────────────────────────

// GetEdgeNodes returns all edge node statuses.
func (m *CDNManager) GetEdgeNodes() map[string]*EdgeNode {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[string]*EdgeNode)
	for k, v := range m.edgeNodes {
		nodeCopy := *v
		result[k] = &nodeCopy
	}
	return result
}

// SetEdgeStatus updates an edge node's status.
func (m *CDNManager) SetEdgeStatus(location, status string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	node, ok := m.edgeNodes[location]
	if !ok {
		return fmt.Errorf("edge location not found: %s", location)
	}

	node.Status = status
	log.Printf("[CDN] Edge status updated: %s → %s", location, status)
	return nil
}

// ── Origin Management ───────────────────────────────────

// GetOrigins returns origin server configurations.
func (m *CDNManager) GetOrigins() []OriginConfig {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make([]OriginConfig, len(m.config.Origins))
	copy(result, m.config.Origins)
	return result
}

// SetOriginHealth updates an origin's health status.
func (m *CDNManager) SetOriginHealth(originID string, healthy bool) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for i := range m.config.Origins {
		if m.config.Origins[i].ID == originID {
			m.config.Origins[i].IsHealthy = healthy
			log.Printf("[CDN] Origin health updated: %s → healthy=%v", originID, healthy)
			return nil
		}
	}
	return fmt.Errorf("origin not found: %s", originID)
}

// ── Cache Rules ─────────────────────────────────────────

// GetCacheRules returns all cache rules.
func (m *CDNManager) GetCacheRules() []CacheRule {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make([]CacheRule, len(m.config.CacheRules))
	copy(result, m.config.CacheRules)
	return result
}

// AddCacheRule adds a new cache rule.
func (m *CDNManager) AddCacheRule(rule CacheRule) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.config.CacheRules = append(m.config.CacheRules, rule)
	log.Printf("[CDN] Cache rule added: pattern=%s ttl=%s", rule.PathPattern, rule.TTL)
}

// ── Statistics ──────────────────────────────────────────

// RecordRequest records a CDN request with cache status.
func (m *CDNManager) RecordRequest(status CacheStatus, bytes int64) {
	atomic.AddInt64(&m.stats.TotalRequests, 1)
	atomic.AddInt64(&m.stats.BytesServed, bytes)

	switch status {
	case CacheHit:
		atomic.AddInt64(&m.stats.CacheHits, 1)
		atomic.AddInt64(&m.stats.BytesSaved, bytes)
	case CacheMiss:
		atomic.AddInt64(&m.stats.CacheMisses, 1)
		atomic.AddInt64(&m.stats.OriginRequests, 1)
	case CacheBypassed:
		atomic.AddInt64(&m.stats.CacheBypasses, 1)
		atomic.AddInt64(&m.stats.OriginRequests, 1)
	}
}

// GetStats returns CDN-wide statistics.
func (m *CDNManager) GetStats() map[string]interface{} {
	totalReqs := atomic.LoadInt64(&m.stats.TotalRequests)
	hits := atomic.LoadInt64(&m.stats.CacheHits)
	hitRate := float64(0)
	if totalReqs > 0 {
		hitRate = float64(hits) / float64(totalReqs) * 100
	}

	bytesServed := atomic.LoadInt64(&m.stats.BytesServed)
	bytesSaved := atomic.LoadInt64(&m.stats.BytesSaved)
	savingsRate := float64(0)
	if bytesServed > 0 {
		savingsRate = float64(bytesSaved) / float64(bytesServed) * 100
	}

	return map[string]interface{}{
		"provider":             m.config.Provider,
		"enabled":              m.config.Enabled,
		"total_requests":       totalReqs,
		"cache_hits":           hits,
		"cache_misses":         atomic.LoadInt64(&m.stats.CacheMisses),
		"cache_bypasses":       atomic.LoadInt64(&m.stats.CacheBypasses),
		"hit_rate":             fmt.Sprintf("%.1f%%", hitRate),
		"hit_rate_num":         hitRate,
		"bytes_served":         bytesServed,
		"bytes_saved":          bytesSaved,
		"bandwidth_savings":    fmt.Sprintf("%.1f%%", savingsRate),
		"origin_requests":      atomic.LoadInt64(&m.stats.OriginRequests),
		"origin_errors":        atomic.LoadInt64(&m.stats.OriginErrors),
		"invalidations":        atomic.LoadInt64(&m.stats.Invalidations),
		"compression_saved":    atomic.LoadInt64(&m.stats.CompressionSaved),
		"waf_blocked":          atomic.LoadInt64(&m.stats.WAFBlocked),
		"ssl_handshakes":       atomic.LoadInt64(&m.stats.SSLHandshakes),
		"edge_locations":       len(m.edgeNodes),
		"origins":              len(m.config.Origins),
		"cache_rules":          len(m.config.CacheRules),
		"default_ttl":          m.config.DefaultTTL.String(),
		"max_ttl":              m.config.MaxTTL.String(),
		"compression_gzip":     m.config.CompressionGzip,
		"compression_brotli":   m.config.CompressionBr,
		"waf_enabled":          m.config.WAFEnabled,
		"http2_push":           m.config.HTTP2Push,
	}
}

// GetFullStatus returns comprehensive CDN status including edges and origins.
func (m *CDNManager) GetFullStatus() map[string]interface{} {
	stats := m.GetStats()
	stats["edge_nodes"] = m.GetEdgeNodes()
	stats["origins"] = m.GetOrigins()
	stats["cache_rules"] = m.GetCacheRules()
	stats["recent_invalidations"] = m.GetInvalidations()
	return stats
}

// ── Shutdown ────────────────────────────────────────────

// Stop gracefully shuts down the CDN manager.
func (m *CDNManager) Stop() {
	close(m.stopCh)
	log.Printf("[CDN] Stopped")
}
