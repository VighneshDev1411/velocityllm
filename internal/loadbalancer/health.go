package loadbalancer

import (
	"context"
	"net/http"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// HealthChecker periodically probes each backend and updates its Healthy flag.
// It is separate from the LLM model health checker (internal/router/health_checker.go)
// — this one manages the upstream server pool (e.g. VelocityLLM instances behind
// an internal load balancer).
type HealthChecker struct {
	lb       *LoadBalancer
	interval time.Duration
	timeout  time.Duration
	path     string // HTTP path to probe, e.g. "/health/live"
	client   *http.Client
	stopChan chan struct{}
	once     sync.Once
}

// NewHealthChecker creates a HealthChecker that probes backends at the given interval.
func NewHealthChecker(lb *LoadBalancer, interval, timeout time.Duration, probePath string) *HealthChecker {
	return &HealthChecker{
		lb:       lb,
		interval: interval,
		timeout:  timeout,
		path:     probePath,
		client: &http.Client{
			Timeout: timeout,
			// Don't follow redirects — a redirect from /health means misconfiguration
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
		stopChan: make(chan struct{}),
	}
}

// Start launches the background health-check loop.
func (hc *HealthChecker) Start() {
	hc.once.Do(func() {
		go hc.loop()
		utils.Info("Backend health checker started (interval=%s path=%s)", hc.interval, hc.path)
	})
}

// Stop halts the health-check loop.
func (hc *HealthChecker) Stop() {
	select {
	case <-hc.stopChan:
	default:
		close(hc.stopChan)
	}
}

func (hc *HealthChecker) loop() {
	// Run immediately on start, then on every tick
	hc.checkAll()
	ticker := time.NewTicker(hc.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			hc.checkAll()
		case <-hc.stopChan:
			return
		}
	}
}

func (hc *HealthChecker) checkAll() {
	hc.lb.mu.RLock()
	backends := make([]*Backend, len(hc.lb.backends))
	copy(backends, hc.lb.backends)
	hc.lb.mu.RUnlock()

	var wg sync.WaitGroup
	for _, b := range backends {
		if !b.Active {
			continue
		}
		wg.Add(1)
		go func(backend *Backend) {
			defer wg.Done()
			healthy := hc.probe(backend)
			wasHealthy := backend.Healthy
			hc.lb.SetHealthy(backend.ID, healthy)
			if wasHealthy != healthy {
				if healthy {
					utils.Info("Backend recovered: %s (%s)", backend.ID, backend.Address)
				} else {
					utils.Error("Backend unhealthy: %s (%s)", backend.ID, backend.Address)
				}
			}
		}(b)
	}
	wg.Wait()
}

func (hc *HealthChecker) probe(b *Backend) bool {
	url := "http://" + b.Address + hc.path
	ctx, cancel := context.WithTimeout(context.Background(), hc.timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return false
	}
	resp, err := hc.client.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}
