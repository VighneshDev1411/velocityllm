package middleware

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/cache"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// ResponseCacheConfig configures the HTTP response cache middleware
type ResponseCacheConfig struct {
	Enabled    bool
	DefaultTTL time.Duration
	RouteTTLs  map[string]time.Duration // path prefix → TTL
	SkipRoutes []string                 // path prefixes to never cache
}

// ResponseCacheStats tracks per-endpoint cache metrics
type ResponseCacheStats struct {
	mu       sync.RWMutex
	Hits     int64 `json:"hits"`
	Misses   int64 `json:"misses"`
	Bypassed int64 `json:"bypassed"`
	ByRoute  map[string]*RouteCacheStats `json:"by_route"`
}

// RouteCacheStats tracks cache stats for a single route prefix
type RouteCacheStats struct {
	Hits     int64   `json:"hits"`
	Misses   int64   `json:"misses"`
	HitRate  float64 `json:"hit_rate"`
	AvgSizeB int64   `json:"avg_size_bytes"`
	totalSize int64
}

var (
	globalResponseCacheStats *ResponseCacheStats
	responseCacheOnce        sync.Once
)

// GetResponseCacheStats returns global response cache stats
func GetResponseCacheStats() *ResponseCacheStats {
	responseCacheOnce.Do(func() {
		globalResponseCacheStats = &ResponseCacheStats{
			ByRoute: make(map[string]*RouteCacheStats),
		}
	})
	return globalResponseCacheStats
}

// GetSnapshot returns a JSON-safe snapshot of the stats
func (s *ResponseCacheStats) GetSnapshot() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	total := s.Hits + s.Misses
	hitRate := 0.0
	if total > 0 {
		hitRate = float64(s.Hits) / float64(total)
	}

	routes := make(map[string]interface{})
	for route, rs := range s.ByRoute {
		rt := rs.Hits + rs.Misses
		hr := 0.0
		if rt > 0 {
			hr = float64(rs.Hits) / float64(rt)
		}
		avg := int64(0)
		if rs.Hits > 0 {
			avg = rs.totalSize / rs.Hits
		}
		routes[route] = map[string]interface{}{
			"hits":           rs.Hits,
			"misses":         rs.Misses,
			"hit_rate":       hr,
			"avg_size_bytes": avg,
		}
	}

	return map[string]interface{}{
		"hits":     s.Hits,
		"misses":   s.Misses,
		"bypassed": s.Bypassed,
		"hit_rate": hitRate,
		"total":    total,
		"by_route": routes,
	}
}

func (s *ResponseCacheStats) recordHit(route string, size int) {
	atomic.AddInt64(&s.Hits, 1)
	s.mu.Lock()
	rs, ok := s.ByRoute[route]
	if !ok {
		rs = &RouteCacheStats{}
		s.ByRoute[route] = rs
	}
	rs.Hits++
	rs.totalSize += int64(size)
	s.mu.Unlock()
}

func (s *ResponseCacheStats) recordMiss(route string) {
	atomic.AddInt64(&s.Misses, 1)
	s.mu.Lock()
	rs, ok := s.ByRoute[route]
	if !ok {
		rs = &RouteCacheStats{}
		s.ByRoute[route] = rs
	}
	rs.Misses++
	s.mu.Unlock()
}

// cachedResponse is what we store in Redis
type cachedResponse struct {
	StatusCode int               `json:"status_code"`
	Headers    map[string]string `json:"headers"`
	Body       []byte            `json:"body"`
	CachedAt   time.Time         `json:"cached_at"`
}

// captureWriter captures the response for caching
type captureWriter struct {
	http.ResponseWriter
	statusCode int
	body       bytes.Buffer
}

func (cw *captureWriter) WriteHeader(code int) {
	cw.statusCode = code
	cw.ResponseWriter.WriteHeader(code)
}

func (cw *captureWriter) Write(b []byte) (int, error) {
	cw.body.Write(b)
	return cw.ResponseWriter.Write(b)
}

// NewResponseCacheMiddleware creates HTTP response caching middleware
func NewResponseCacheMiddleware(config ResponseCacheConfig) func(http.Handler) http.Handler {
	cacheService := cache.NewCacheService(config.DefaultTTL)
	stats := GetResponseCacheStats()

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Only cache GET requests
			if !config.Enabled || r.Method != http.MethodGet {
				next.ServeHTTP(w, r)
				return
			}

			// Check skip routes
			for _, skip := range config.SkipRoutes {
				if strings.HasPrefix(r.URL.Path, skip) {
					atomic.AddInt64(&stats.Bypassed, 1)
					next.ServeHTTP(w, r)
					return
				}
			}

			// Check Cache-Control: no-cache
			if r.Header.Get("Cache-Control") == "no-cache" {
				atomic.AddInt64(&stats.Bypassed, 1)
				w.Header().Set("X-Cache", "BYPASS")
				next.ServeHTTP(w, r)
				return
			}

			// Determine TTL for this route
			ttl := config.DefaultTTL
			routeKey := ""
			for prefix, t := range config.RouteTTLs {
				if strings.HasPrefix(r.URL.Path, prefix) {
					if len(prefix) > len(routeKey) { // longest match
						ttl = t
						routeKey = prefix
					}
				}
			}
			if routeKey == "" {
				routeKey = r.URL.Path
			}

			// Skip if TTL is 0
			if ttl == 0 {
				atomic.AddInt64(&stats.Bypassed, 1)
				next.ServeHTTP(w, r)
				return
			}

			// Generate cache key
			cacheKey := generateCacheKey(r)

			// Try cache lookup
			var cached cachedResponse
			found, err := cacheService.Get(r.Context(), cacheKey, &cached)
			if err == nil && found {
				// Cache HIT
				stats.recordHit(routeKey, len(cached.Body))
				for k, v := range cached.Headers {
					w.Header().Set(k, v)
				}
				w.Header().Set("X-Cache", "HIT")
				age := time.Since(cached.CachedAt).Seconds()
				w.Header().Set("X-Cache-Age", fmt.Sprintf("%.0fs", age))
				w.WriteHeader(cached.StatusCode)
				w.Write(cached.Body)
				return
			}

			// Cache MISS — capture response
			stats.recordMiss(routeKey)
			cw := &captureWriter{ResponseWriter: w, statusCode: 200}
			w.Header().Set("X-Cache", "MISS")
			next.ServeHTTP(cw, r)

			// Only cache successful responses under 1MB
			if cw.statusCode == 200 && cw.body.Len() < 1024*1024 {
				headers := make(map[string]string)
				for k, v := range cw.Header() {
					if len(v) > 0 && k != "X-Cache" {
						headers[k] = v[0]
					}
				}
				resp := cachedResponse{
					StatusCode: cw.statusCode,
					Headers:    headers,
					Body:       cw.body.Bytes(),
					CachedAt:   time.Now(),
				}
				go func() {
					if err := cacheService.Set(r.Context(), cacheKey, resp, ttl); err != nil {
						utils.Debug("Failed to cache response: %v", err)
					}
				}()
			}
		})
	}
}

func generateCacheKey(r *http.Request) string {
	// Sort query params for consistent keys
	params := r.URL.Query()
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var qb strings.Builder
	for _, k := range keys {
		vals := params[k]
		sort.Strings(vals)
		for _, v := range vals {
			qb.WriteString(k)
			qb.WriteString("=")
			qb.WriteString(v)
			qb.WriteString("&")
		}
	}

	raw := fmt.Sprintf("%s:%s:%s", r.Method, r.URL.Path, qb.String())
	hash := sha256.Sum256([]byte(raw))
	return "http:cache:" + hex.EncodeToString(hash[:16])
}

// DefaultResponseCacheConfig returns sensible defaults
func DefaultResponseCacheConfig() ResponseCacheConfig {
	return ResponseCacheConfig{
		Enabled:    true,
		DefaultTTL: 30 * time.Second,
		RouteTTLs: map[string]time.Duration{
			"/api/v1/models":          60 * time.Second,
			"/api/v1/metrics/":        10 * time.Second,
			"/api/v1/system/health":   5 * time.Second,
			"/api/v1/analytics/":      30 * time.Second,
			"/api/v1/settings":        5 * time.Minute,
			"/api/v1/billing/":        2 * time.Minute,
			"/api/v1/cluster/":        15 * time.Second,
			"/api/v1/workers/metrics": 10 * time.Second,
		},
		SkipRoutes: []string{
			"/api/v1/cache/",
			"/api/v1/auth/",
			"/api/v1/ws",
			"/api/v1/completions",
			"/api/v1/chat/",
			"/health",
		},
	}
}

// Invalidate removes a specific response from cache
func InvalidateResponseCache(pattern string) (int64, error) {
	svc := cache.NewCacheService(0)
	return svc.Clear(nil, "http:cache:*")
}

// GetResponseCacheStatsJSON returns stats as JSON bytes
func GetResponseCacheStatsJSON() ([]byte, error) {
	stats := GetResponseCacheStats()
	return json.Marshal(stats.GetSnapshot())
}
