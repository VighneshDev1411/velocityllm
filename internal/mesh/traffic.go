package mesh

import (
	"math/rand"
	"sync"
	"time"
)

// TrafficPolicy defines how traffic is routed to service instances.
type TrafficPolicy struct {
	Name             string           `json:"name"`
	LoadBalancing    LBPolicy         `json:"load_balancing"`
	CircuitBreaker   CBPolicy         `json:"circuit_breaker"`
	Retry            RetryPolicy      `json:"retry"`
	Timeout          time.Duration    `json:"timeout"`
	CanaryRouting    *CanaryPolicy    `json:"canary,omitempty"`
	RateLimiting     *RateLimitPolicy `json:"rate_limiting,omitempty"`
}

type LBPolicy struct {
	Algorithm string `json:"algorithm"` // round-robin, least-connections, random, weighted
}

type CBPolicy struct {
	Enabled          bool          `json:"enabled"`
	FailureThreshold int           `json:"failure_threshold"`
	SuccessThreshold int           `json:"success_threshold"`
	Timeout          time.Duration `json:"timeout"`
	HalfOpenRequests int           `json:"half_open_requests"`
}

type RetryPolicy struct {
	MaxAttempts   int           `json:"max_attempts"`
	InitialDelay  time.Duration `json:"initial_delay"`
	MaxDelay      time.Duration `json:"max_delay"`
	BackoffFactor float64       `json:"backoff_factor"`
	RetryOn       []int         `json:"retry_on"` // HTTP status codes to retry on
}

type CanaryPolicy struct {
	Enabled       bool   `json:"enabled"`
	CanaryVersion string `json:"canary_version"`
	TrafficPct    int    `json:"traffic_pct"` // 0-100 percentage to canary
}

type RateLimitPolicy struct {
	RequestsPerSecond int `json:"requests_per_second"`
	BurstSize         int `json:"burst_size"`
}

// DefaultTrafficPolicy returns a production-ready default policy.
func DefaultTrafficPolicy() TrafficPolicy {
	return TrafficPolicy{
		Name: "default",
		LoadBalancing: LBPolicy{
			Algorithm: "round-robin",
		},
		CircuitBreaker: CBPolicy{
			Enabled:          true,
			FailureThreshold: 5,
			SuccessThreshold: 2,
			Timeout:          30 * time.Second,
			HalfOpenRequests: 1,
		},
		Retry: RetryPolicy{
			MaxAttempts:   3,
			InitialDelay:  500 * time.Millisecond,
			MaxDelay:      5 * time.Second,
			BackoffFactor: 2.0,
			RetryOn:       []int{502, 503, 504},
		},
		Timeout: 30 * time.Second,
	}
}

// TrafficRouter selects service instances based on traffic policies.
type TrafficRouter struct {
	mu       sync.RWMutex
	policies map[string]*TrafficPolicy // service name → policy
	rrIndex  map[string]int            // round-robin counters
}

// NewTrafficRouter creates a new traffic router.
func NewTrafficRouter() *TrafficRouter {
	return &TrafficRouter{
		policies: make(map[string]*TrafficPolicy),
		rrIndex:  make(map[string]int),
	}
}

// SetPolicy sets the traffic policy for a service.
func (tr *TrafficRouter) SetPolicy(serviceName string, policy *TrafficPolicy) {
	tr.mu.Lock()
	defer tr.mu.Unlock()
	tr.policies[serviceName] = policy
}

// GetPolicy returns the traffic policy for a service.
func (tr *TrafficRouter) GetPolicy(serviceName string) *TrafficPolicy {
	tr.mu.RLock()
	defer tr.mu.RUnlock()
	if p, ok := tr.policies[serviceName]; ok {
		return p
	}
	defaultPolicy := DefaultTrafficPolicy()
	return &defaultPolicy
}

// SelectInstance chooses a service instance based on the traffic policy.
func (tr *TrafficRouter) SelectInstance(serviceName string, instances []*ServiceInstance) *ServiceInstance {
	if len(instances) == 0 {
		return nil
	}

	tr.mu.Lock()
	defer tr.mu.Unlock()

	policy := tr.policies[serviceName]
	if policy == nil {
		p := DefaultTrafficPolicy()
		policy = &p
	}

	// Handle canary routing
	if policy.CanaryRouting != nil && policy.CanaryRouting.Enabled {
		return tr.selectWithCanary(serviceName, instances, policy.CanaryRouting)
	}

	// Standard load balancing
	return tr.selectByAlgorithm(serviceName, instances, policy.LoadBalancing.Algorithm)
}

func (tr *TrafficRouter) selectWithCanary(serviceName string, instances []*ServiceInstance, canary *CanaryPolicy) *ServiceInstance {
	var stable, canaryInstances []*ServiceInstance
	for _, inst := range instances {
		if inst.Version == canary.CanaryVersion {
			canaryInstances = append(canaryInstances, inst)
		} else {
			stable = append(stable, inst)
		}
	}

	// Route percentage to canary
	if len(canaryInstances) > 0 && rand.Intn(100) < canary.TrafficPct {
		return canaryInstances[rand.Intn(len(canaryInstances))]
	}

	if len(stable) > 0 {
		return stable[rand.Intn(len(stable))]
	}

	// Fallback
	return instances[rand.Intn(len(instances))]
}

func (tr *TrafficRouter) selectByAlgorithm(serviceName string, instances []*ServiceInstance, algorithm string) *ServiceInstance {
	switch algorithm {
	case "round-robin":
		idx := tr.rrIndex[serviceName]
		tr.rrIndex[serviceName] = (idx + 1) % len(instances)
		return instances[idx%len(instances)]

	case "weighted":
		totalWeight := 0
		for _, inst := range instances {
			w := inst.Weight
			if w <= 0 {
				w = 1
			}
			totalWeight += w
		}
		r := rand.Intn(totalWeight)
		for _, inst := range instances {
			w := inst.Weight
			if w <= 0 {
				w = 1
			}
			r -= w
			if r < 0 {
				return inst
			}
		}
		return instances[0]

	case "random":
		return instances[rand.Intn(len(instances))]

	default: // round-robin
		idx := tr.rrIndex[serviceName]
		tr.rrIndex[serviceName] = (idx + 1) % len(instances)
		return instances[idx%len(instances)]
	}
}

// GetAllPolicies returns all configured traffic policies.
func (tr *TrafficRouter) GetAllPolicies() map[string]*TrafficPolicy {
	tr.mu.RLock()
	defer tr.mu.RUnlock()

	result := make(map[string]*TrafficPolicy)
	for k, v := range tr.policies {
		result[k] = v
	}
	return result
}
