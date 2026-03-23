package mesh

import (
	"fmt"
	"log"
	"sync"
	"sync/atomic"
	"time"

	"github.com/redis/go-redis/v9"
)

// MeshConfig configures the service mesh control plane.
type MeshConfig struct {
	ServiceName    string
	NodeID         string
	Host           string
	Port           int
	Version        string
	Region         string
	Zone           string
	HealthCheckURL string
}

// ServiceMesh is the control plane that coordinates service discovery,
// traffic management, health checking, and observability.
type ServiceMesh struct {
	mu           sync.RWMutex
	config       MeshConfig
	registry     *ServiceRegistry
	router       *TrafficRouter
	geoRouter    *GeoRouter
	healthChecks map[string]*HealthChecker
	stats        *MeshStats
	stopCh       chan struct{}
}

// MeshStats tracks service mesh metrics.
type MeshStats struct {
	TotalRequests     int64 `json:"total_requests"`
	SuccessfulRoutes  int64 `json:"successful_routes"`
	FailedRoutes      int64 `json:"failed_routes"`
	CircuitBreaks     int64 `json:"circuit_breaks"`
	Retries           int64 `json:"retries"`
	CanaryRequests    int64 `json:"canary_requests"`
	HealthChecksPassed int64 `json:"health_checks_passed"`
	HealthChecksFailed int64 `json:"health_checks_failed"`
}

// HealthChecker performs periodic health checks on service instances.
type HealthChecker struct {
	ServiceName string
	Interval    time.Duration
	Timeout     time.Duration
	Threshold   int // failures before marking unhealthy
	stopCh      chan struct{}
}

// Global mesh instance
var (
	globalMesh     *ServiceMesh
	globalMeshLock sync.RWMutex
)

// InitServiceMesh initializes the global service mesh.
func InitServiceMesh(rdb *redis.Client, config MeshConfig) *ServiceMesh {
	self := &ServiceInstance{
		ID:        config.NodeID,
		Name:      config.ServiceName,
		Host:      config.Host,
		Port:      config.Port,
		Version:   config.Version,
		Status:    StatusActive,
		Health:    HealthHealthy,
		Region:    config.Region,
		Zone:      config.Zone,
		Weight:    100,
		StartedAt: time.Now(),
		Metadata: map[string]string{
			"health_check_url": config.HealthCheckURL,
		},
	}

	geoConfig := GeoConfig{
		LocalRegion:       config.Region,
		LocalZone:         config.Zone,
		FailoverRegions:   []string{"us-west-2", "eu-west-1", "ap-southeast-1"},
		LatencyThreshold:  500 * time.Millisecond,
		HealthyThreshold:  0.5,
		PreferLocalZone:   true,
		CrossRegionWeight: 0.3,
	}
	// Remove local region from failover list
	filtered := make([]string, 0)
	for _, r := range geoConfig.FailoverRegions {
		if r != config.Region {
			filtered = append(filtered, r)
		}
	}
	geoConfig.FailoverRegions = filtered

	mesh := &ServiceMesh{
		config:       config,
		registry:     NewServiceRegistry(rdb, self),
		router:       NewTrafficRouter(),
		geoRouter:    NewGeoRouter(geoConfig),
		healthChecks: make(map[string]*HealthChecker),
		stats:        &MeshStats{},
		stopCh:       make(chan struct{}),
	}

	// Set default traffic policy
	mesh.router.SetPolicy(config.ServiceName, func() *TrafficPolicy {
		p := DefaultTrafficPolicy()
		p.Name = config.ServiceName
		return &p
	}())

	globalMeshLock.Lock()
	globalMesh = mesh
	globalMeshLock.Unlock()

	log.Printf("[ServiceMesh] Initialized: service=%s node=%s endpoint=%s:%d region=%s",
		config.ServiceName, config.NodeID, config.Host, config.Port, config.Region)

	return mesh
}

// GetServiceMesh returns the global service mesh instance.
func GetServiceMesh() *ServiceMesh {
	globalMeshLock.RLock()
	defer globalMeshLock.RUnlock()
	return globalMesh
}

// ── Service Discovery ───────────────────────────────────────────

// Discover returns all healthy instances of a service.
func (m *ServiceMesh) Discover(serviceName string) []*ServiceInstance {
	return m.registry.GetHealthyInstances(serviceName)
}

// DiscoverAll returns all instances (including unhealthy).
func (m *ServiceMesh) DiscoverAll(serviceName string) []*ServiceInstance {
	return m.registry.GetInstances(serviceName)
}

// GetAllServices returns all registered instances in the mesh.
func (m *ServiceMesh) GetAllServices() []*ServiceInstance {
	return m.registry.GetAllInstances()
}

// ── Traffic Routing ─────────────────────────────────────────────

// Route selects the best instance for a service based on traffic policy.
func (m *ServiceMesh) Route(serviceName string) (*ServiceInstance, error) {
	atomic.AddInt64(&m.stats.TotalRequests, 1)

	instances := m.registry.GetHealthyInstances(serviceName)
	if len(instances) == 0 {
		// Try degraded instances
		instances = m.registry.GetInstances(serviceName)
		if len(instances) == 0 {
			atomic.AddInt64(&m.stats.FailedRoutes, 1)
			return nil, fmt.Errorf("no instances available for service: %s", serviceName)
		}
	}

	// Apply geo-routing: reorder instances by region preference
	if m.geoRouter != nil {
		instances = m.geoRouter.SelectInstances(instances)
	}

	selected := m.router.SelectInstance(serviceName, instances)
	if selected == nil {
		atomic.AddInt64(&m.stats.FailedRoutes, 1)
		return nil, fmt.Errorf("failed to select instance for: %s", serviceName)
	}

	atomic.AddInt64(&m.stats.SuccessfulRoutes, 1)

	// Track canary requests
	policy := m.router.GetPolicy(serviceName)
	if policy.CanaryRouting != nil && policy.CanaryRouting.Enabled && selected.Version == policy.CanaryRouting.CanaryVersion {
		atomic.AddInt64(&m.stats.CanaryRequests, 1)
	}

	return selected, nil
}

// ── Traffic Policy Management ───────────────────────────────────

// SetTrafficPolicy configures the traffic policy for a service.
func (m *ServiceMesh) SetTrafficPolicy(serviceName string, policy *TrafficPolicy) {
	m.router.SetPolicy(serviceName, policy)
	log.Printf("[ServiceMesh] Traffic policy updated for %s: lb=%s cb=%v canary=%v",
		serviceName, policy.LoadBalancing.Algorithm, policy.CircuitBreaker.Enabled,
		policy.CanaryRouting != nil && policy.CanaryRouting.Enabled)
}

// GetTrafficPolicy returns the current traffic policy for a service.
func (m *ServiceMesh) GetTrafficPolicy(serviceName string) *TrafficPolicy {
	return m.router.GetPolicy(serviceName)
}

// GetAllPolicies returns all traffic policies.
func (m *ServiceMesh) GetAllPolicies() map[string]*TrafficPolicy {
	return m.router.GetAllPolicies()
}

// ── Health Management ───────────────────────────────────────────

// UpdateInstanceHealth updates the health state of an instance.
func (m *ServiceMesh) UpdateInstanceHealth(instanceID string, health HealthState) {
	m.registry.UpdateHealth(instanceID, health)
	if health == HealthHealthy {
		atomic.AddInt64(&m.stats.HealthChecksPassed, 1)
	} else {
		atomic.AddInt64(&m.stats.HealthChecksFailed, 1)
	}
}

// Drain puts this instance into draining mode.
func (m *ServiceMesh) Drain() {
	m.registry.Drain()
}

// ── Geo-Routing ─────────────────────────────────────────────────

// GetGeoRouter returns the geo-aware router.
func (m *ServiceMesh) GetGeoRouter() *GeoRouter {
	return m.geoRouter
}

// RouteGeo selects the best instance using geo-aware routing.
func (m *ServiceMesh) RouteGeo(serviceName string) (*ServiceInstance, string, error) {
	atomic.AddInt64(&m.stats.TotalRequests, 1)

	instances := m.registry.GetInstances(serviceName)
	if len(instances) == 0 {
		atomic.AddInt64(&m.stats.FailedRoutes, 1)
		return nil, "", fmt.Errorf("no instances available for service: %s", serviceName)
	}

	// Apply geo-routing
	sorted := m.geoRouter.SelectInstances(instances)
	if len(sorted) == 0 {
		atomic.AddInt64(&m.stats.FailedRoutes, 1)
		return nil, "", fmt.Errorf("no routable instances for: %s", serviceName)
	}

	selected := sorted[0]
	routeType := "local"
	if selected.Region != m.config.Region {
		routeType = "cross-region"
	}

	atomic.AddInt64(&m.stats.SuccessfulRoutes, 1)
	return selected, routeType, nil
}

// GetRegionStatuses returns health/latency info for all regions.
func (m *ServiceMesh) GetRegionStatuses() []RegionStatus {
	instances := m.registry.GetAllInstances()
	return m.geoRouter.GetRegionStatuses(instances)
}

// RecordRegionLatency records a request latency for a region.
func (m *ServiceMesh) RecordRegionLatency(region string, latencyMs float64) {
	m.geoRouter.RecordLatency(region, latencyMs)
}

// RecordRegionError records a request error for a region.
func (m *ServiceMesh) RecordRegionError(region string) {
	m.geoRouter.RecordError(region)
}

// ── Observability ───────────────────────────────────────────────

// GetTopology returns the full mesh topology.
func (m *ServiceMesh) GetTopology() map[string]interface{} {
	instances := m.registry.GetAllInstances()

	// Group by service name
	serviceMap := make(map[string][]map[string]interface{})
	for _, inst := range instances {
		serviceMap[inst.Name] = append(serviceMap[inst.Name], map[string]interface{}{
			"id":       inst.ID,
			"endpoint": inst.Endpoint(),
			"version":  inst.Version,
			"status":   inst.Status,
			"health":   inst.Health,
			"region":   inst.Region,
			"zone":     inst.Zone,
			"weight":   inst.Weight,
			"last_seen": inst.LastSeen,
		})
	}

	return map[string]interface{}{
		"services":       serviceMap,
		"total_instances": len(instances),
		"total_services":  len(serviceMap),
	}
}

// GetStats returns mesh-wide statistics.
func (m *ServiceMesh) GetStats() map[string]interface{} {
	policies := m.router.GetAllPolicies()
	policyList := make([]map[string]interface{}, 0)
	for name, p := range policies {
		policyList = append(policyList, map[string]interface{}{
			"service":          name,
			"load_balancing":   p.LoadBalancing.Algorithm,
			"circuit_breaker":  p.CircuitBreaker.Enabled,
			"retry_attempts":   p.Retry.MaxAttempts,
			"timeout":          p.Timeout.String(),
			"canary_enabled":   p.CanaryRouting != nil && p.CanaryRouting.Enabled,
		})
	}

	return map[string]interface{}{
		"node_id":              m.config.NodeID,
		"service_name":         m.config.ServiceName,
		"region":               m.config.Region,
		"zone":                 m.config.Zone,
		"total_requests":       atomic.LoadInt64(&m.stats.TotalRequests),
		"successful_routes":    atomic.LoadInt64(&m.stats.SuccessfulRoutes),
		"failed_routes":        atomic.LoadInt64(&m.stats.FailedRoutes),
		"circuit_breaks":       atomic.LoadInt64(&m.stats.CircuitBreaks),
		"retries":              atomic.LoadInt64(&m.stats.Retries),
		"canary_requests":      atomic.LoadInt64(&m.stats.CanaryRequests),
		"health_checks_passed": atomic.LoadInt64(&m.stats.HealthChecksPassed),
		"health_checks_failed": atomic.LoadInt64(&m.stats.HealthChecksFailed),
		"traffic_policies":     policyList,
		"topology":             m.GetTopology(),
		"geo_routing":          m.geoRouter.GetStats(),
		"region_statuses":      m.GetRegionStatuses(),
	}
}

// ── Shutdown ────────────────────────────────────────────────────

// Stop gracefully shuts down the service mesh.
func (m *ServiceMesh) Stop() {
	close(m.stopCh)
	m.registry.Stop()
	log.Printf("[ServiceMesh] Stopped: %s", m.config.NodeID)
}
