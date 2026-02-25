// Package loadbalancer implements server-side load balancing algorithms used
// when VelocityLLM itself routes requests across a pool of backend instances
// (e.g. a pool of LLM provider endpoints or a pool of worker nodes).
package loadbalancer

import (
	"errors"
	"hash/fnv"
	"math/rand"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// Algorithm names supported by the load balancer.
type Algorithm string

const (
	AlgorithmRoundRobin         Algorithm = "round_robin"
	AlgorithmWeightedRoundRobin Algorithm = "weighted_round_robin"
	AlgorithmLeastConnections   Algorithm = "least_connections"
	AlgorithmIPHash             Algorithm = "ip_hash"
	AlgorithmRandom             Algorithm = "random"
)

// Backend represents a single upstream server in the pool.
type Backend struct {
	ID          string `json:"id"`
	Address     string `json:"address"`   // host:port
	Weight      int    `json:"weight"`    // 1-100, used by weighted algorithms
	Active      bool   `json:"active"`    // false = removed from rotation
	Healthy     bool   `json:"healthy"`   // updated by health checker
	connections int64  // atomic: active in-flight connections
	requests    int64  // atomic: total requests routed here
	mu          sync.RWMutex
}

func (b *Backend) IncrConnections() { atomic.AddInt64(&b.connections, 1) }
func (b *Backend) DecrConnections() { atomic.AddInt64(&b.connections, -1) }
func (b *Backend) Connections() int64 { return atomic.LoadInt64(&b.connections) }
func (b *Backend) Requests() int64   { return atomic.LoadInt64(&b.requests) }

func (b *Backend) IsAvailable() bool {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.Active && b.Healthy
}

// LoadBalancer distributes requests across a pool of Backend instances using
// the configured Algorithm.
type LoadBalancer struct {
	mu        sync.RWMutex
	backends  []*Backend
	algorithm Algorithm
	counter   uint64        // round-robin cursor (atomic)
	rng       *rand.Rand
	// weighted round-robin state
	wrrCurrentWeights []int
}

// New creates a LoadBalancer with the given algorithm and initial backends.
func New(algorithm Algorithm, backends []*Backend) *LoadBalancer {
	lb := &LoadBalancer{
		algorithm: algorithm,
		rng:       rand.New(rand.NewSource(time.Now().UnixNano())),
	}
	lb.backends = make([]*Backend, len(backends))
	copy(lb.backends, backends)
	lb.resetWRR()
	utils.Info("LoadBalancer created: algorithm=%s backends=%d", algorithm, len(backends))
	return lb
}

// Next selects the next backend using the configured algorithm.
// clientIP is used only by ip_hash; pass "" for other algorithms.
// Returns ErrNoBackends if the pool is empty or all backends are unhealthy.
func (lb *LoadBalancer) Next(clientIP string) (*Backend, error) {
	lb.mu.RLock()
	defer lb.mu.RUnlock()

	available := lb.availableBackends()
	if len(available) == 0 {
		return nil, ErrNoBackends
	}

	switch lb.algorithm {
	case AlgorithmRoundRobin:
		return lb.roundRobin(available), nil
	case AlgorithmWeightedRoundRobin:
		return lb.weightedRoundRobin(), nil
	case AlgorithmLeastConnections:
		return lb.leastConnections(available), nil
	case AlgorithmIPHash:
		return lb.ipHash(available, clientIP), nil
	case AlgorithmRandom:
		return lb.random(available), nil
	default:
		return lb.roundRobin(available), nil
	}
}

// Done must be called after each request routed via Next to decrement
// the active connection counter (used by least_connections).
func (lb *LoadBalancer) Done(b *Backend) {
	b.DecrConnections()
}

// AddBackend adds a new backend to the pool.
func (lb *LoadBalancer) AddBackend(b *Backend) {
	lb.mu.Lock()
	defer lb.mu.Unlock()
	lb.backends = append(lb.backends, b)
	lb.resetWRR()
	utils.Info("Backend added: %s (%s)", b.ID, b.Address)
}

// RemoveBackend marks a backend inactive by ID.
func (lb *LoadBalancer) RemoveBackend(id string) {
	lb.mu.Lock()
	defer lb.mu.Unlock()
	for _, b := range lb.backends {
		if b.ID == id {
			b.mu.Lock()
			b.Active = false
			b.mu.Unlock()
			utils.Info("Backend removed: %s", id)
			return
		}
	}
}

// SetHealthy updates the health status of a backend.
func (lb *LoadBalancer) SetHealthy(id string, healthy bool) {
	lb.mu.RLock()
	defer lb.mu.RUnlock()
	for _, b := range lb.backends {
		if b.ID == id {
			b.mu.Lock()
			b.Healthy = healthy
			b.mu.Unlock()
			return
		}
	}
}

// UpdateWeight changes a backend's weight (used by weighted_round_robin).
func (lb *LoadBalancer) UpdateWeight(id string, weight int) {
	lb.mu.Lock()
	defer lb.mu.Unlock()
	for _, b := range lb.backends {
		if b.ID == id {
			b.mu.Lock()
			b.Weight = weight
			b.mu.Unlock()
			lb.resetWRR()
			return
		}
	}
}

// Stats returns a snapshot of each backend's metrics.
func (lb *LoadBalancer) Stats() []BackendStats {
	lb.mu.RLock()
	defer lb.mu.RUnlock()
	stats := make([]BackendStats, 0, len(lb.backends))
	for _, b := range lb.backends {
		b.mu.RLock()
		stats = append(stats, BackendStats{
			ID:          b.ID,
			Address:     b.Address,
			Weight:      b.Weight,
			Active:      b.Active,
			Healthy:     b.Healthy,
			Connections: b.Connections(),
			TotalReqs:   b.Requests(),
		})
		b.mu.RUnlock()
	}
	return stats
}

// Algorithm returns the current algorithm name.
func (lb *LoadBalancer) Algorithm() Algorithm { return lb.algorithm }

// SetAlgorithm changes the algorithm at runtime.
func (lb *LoadBalancer) SetAlgorithm(a Algorithm) {
	lb.mu.Lock()
	defer lb.mu.Unlock()
	lb.algorithm = a
	utils.Info("LoadBalancer algorithm changed to: %s", a)
}

// ---- internal algorithms ----------------------------------------------------

func (lb *LoadBalancer) availableBackends() []*Backend {
	out := make([]*Backend, 0, len(lb.backends))
	for _, b := range lb.backends {
		if b.IsAvailable() {
			out = append(out, b)
		}
	}
	return out
}

// roundRobin uses a global atomic counter mod len(available).
func (lb *LoadBalancer) roundRobin(available []*Backend) *Backend {
	n := uint64(len(available))
	idx := atomic.AddUint64(&lb.counter, 1) % n
	b := available[idx]
	atomic.AddInt64(&b.requests, 1)
	b.IncrConnections()
	return b
}

// weightedRoundRobin implements smooth weighted round-robin (Nginx algorithm).
// It iterates over all backends (including inactive ones, skipping them) and
// picks the one with the highest current weight after adding its configured weight.
func (lb *LoadBalancer) weightedRoundRobin() *Backend {
	// Ensure current-weight slice exists
	if len(lb.wrrCurrentWeights) != len(lb.backends) {
		lb.resetWRR()
	}

	totalWeight := 0
	for i, b := range lb.backends {
		if !b.IsAvailable() {
			continue
		}
		lb.wrrCurrentWeights[i] += b.Weight
		totalWeight += b.Weight
	}

	var best *Backend
	bestIdx := -1
	for i, b := range lb.backends {
		if !b.IsAvailable() {
			continue
		}
		if best == nil || lb.wrrCurrentWeights[i] > lb.wrrCurrentWeights[bestIdx] {
			best = b
			bestIdx = i
		}
	}
	if best == nil {
		return lb.availableBackends()[0]
	}
	lb.wrrCurrentWeights[bestIdx] -= totalWeight
	atomic.AddInt64(&best.requests, 1)
	best.IncrConnections()
	return best
}

// leastConnections routes to the backend with the fewest active connections.
func (lb *LoadBalancer) leastConnections(available []*Backend) *Backend {
	best := available[0]
	for _, b := range available[1:] {
		if b.Connections() < best.Connections() {
			best = b
		}
	}
	atomic.AddInt64(&best.requests, 1)
	best.IncrConnections()
	return best
}

// ipHash consistently maps a client IP to the same backend (sticky without cookies).
func (lb *LoadBalancer) ipHash(available []*Backend, clientIP string) *Backend {
	if clientIP == "" {
		return lb.roundRobin(available)
	}
	h := fnv.New32a()
	h.Write([]byte(clientIP))
	idx := h.Sum32() % uint32(len(available))
	b := available[idx]
	atomic.AddInt64(&b.requests, 1)
	b.IncrConnections()
	return b
}

// random picks a uniformly random available backend.
func (lb *LoadBalancer) random(available []*Backend) *Backend {
	b := available[lb.rng.Intn(len(available))]
	atomic.AddInt64(&b.requests, 1)
	b.IncrConnections()
	return b
}

func (lb *LoadBalancer) resetWRR() {
	lb.wrrCurrentWeights = make([]int, len(lb.backends))
}

// ---- errors -----------------------------------------------------------------

var ErrNoBackends = errors.New("load balancer: no healthy backends available")

// ---- stats ------------------------------------------------------------------

// BackendStats is the JSON-serialisable snapshot of a Backend.
type BackendStats struct {
	ID          string `json:"id"`
	Address     string `json:"address"`
	Weight      int    `json:"weight"`
	Active      bool   `json:"active"`
	Healthy     bool   `json:"healthy"`
	Connections int64  `json:"active_connections"`
	TotalReqs   int64  `json:"total_requests"`
}

// ---- reverse-proxy middleware -----------------------------------------------

// Middleware wraps an http.Handler and injects a chosen backend into the
// request context so downstream handlers can inspect routing decisions.
func (lb *LoadBalancer) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clientIP := extractIP(r)
		b, err := lb.Next(clientIP)
		if err != nil {
			http.Error(w, "Service Unavailable: no healthy backends", http.StatusServiceUnavailable)
			return
		}
		defer lb.Done(b)
		// Attach chosen backend ID to response header for observability
		w.Header().Set("X-Routed-To", b.ID)
		next.ServeHTTP(w, r)
	})
}

func extractIP(r *http.Request) string {
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		return ip
	}
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	return r.RemoteAddr
}

// ---- global singleton -------------------------------------------------------

var (
	globalLB   *LoadBalancer
	globalLBMu sync.RWMutex
)

// InitGlobal creates the global LoadBalancer.
func InitGlobal(algorithm Algorithm, backends []*Backend) *LoadBalancer {
	globalLBMu.Lock()
	defer globalLBMu.Unlock()
	globalLB = New(algorithm, backends)
	return globalLB
}

// GetGlobal returns the global LoadBalancer (may be nil before InitGlobal).
func GetGlobal() *LoadBalancer {
	globalLBMu.RLock()
	defer globalLBMu.RUnlock()
	return globalLB
}
