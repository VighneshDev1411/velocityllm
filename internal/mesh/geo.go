package mesh

import (
	"fmt"
	"log"
	"math"
	"sort"
	"sync"
	"sync/atomic"
	"time"
)

// GeoConfig configures multi-region routing behavior.
type GeoConfig struct {
	LocalRegion       string
	LocalZone         string
	FailoverRegions   []string      // ordered failover preference
	LatencyThreshold  time.Duration // max acceptable latency before failover
	HealthyThreshold  float64       // min healthy ratio before failover (0.0-1.0)
	PreferLocalZone   bool          // prefer same zone within region
	CrossRegionWeight float64       // weight multiplier for cross-region (0.0-1.0)
}

// DefaultGeoConfig returns sensible defaults.
func DefaultGeoConfig() GeoConfig {
	return GeoConfig{
		LocalRegion:       "us-east-1",
		LocalZone:         "us-east-1a",
		FailoverRegions:   []string{"us-west-2", "eu-west-1", "ap-southeast-1"},
		LatencyThreshold:  500 * time.Millisecond,
		HealthyThreshold:  0.5,
		PreferLocalZone:   true,
		CrossRegionWeight: 0.3,
	}
}

// RegionStatus tracks the health and performance of a region.
type RegionStatus struct {
	Region          string    `json:"region"`
	Instances       int       `json:"instances"`
	Healthy         int       `json:"healthy"`
	Degraded        int       `json:"degraded"`
	Unhealthy       int       `json:"unhealthy"`
	AvgLatencyMs    float64   `json:"avg_latency_ms"`
	P99LatencyMs    float64   `json:"p99_latency_ms"`
	RequestCount    int64     `json:"request_count"`
	ErrorCount      int64     `json:"error_count"`
	ErrorRate       float64   `json:"error_rate"`
	IsFailover      bool      `json:"is_failover"`
	LastChecked     time.Time `json:"last_checked"`
}

// GeoRouter implements region-aware routing with latency tracking and failover.
type GeoRouter struct {
	mu            sync.RWMutex
	config        GeoConfig
	regionStats   map[string]*regionMetrics
	failoverState map[string]bool // region → is primary failing over
	stats         *GeoStats
}

type regionMetrics struct {
	mu           sync.Mutex
	latencies    []float64 // ring buffer of recent latencies (ms)
	latencyIdx   int
	requestCount int64
	errorCount   int64
	lastUpdated  time.Time
}

const latencyBufferSize = 100

func newRegionMetrics() *regionMetrics {
	return &regionMetrics{
		latencies: make([]float64, latencyBufferSize),
	}
}

func (rm *regionMetrics) recordLatency(ms float64) {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	rm.latencies[rm.latencyIdx%latencyBufferSize] = ms
	rm.latencyIdx++
	rm.requestCount++
	rm.lastUpdated = time.Now()
}

func (rm *regionMetrics) recordError() {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	rm.errorCount++
	rm.requestCount++
	rm.lastUpdated = time.Now()
}

func (rm *regionMetrics) avgLatency() float64 {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	count := rm.latencyIdx
	if count > latencyBufferSize {
		count = latencyBufferSize
	}
	if count == 0 {
		return 0
	}
	var sum float64
	for i := 0; i < count; i++ {
		sum += rm.latencies[i]
	}
	return sum / float64(count)
}

func (rm *regionMetrics) p99Latency() float64 {
	rm.mu.Lock()
	defer rm.mu.Unlock()
	count := rm.latencyIdx
	if count > latencyBufferSize {
		count = latencyBufferSize
	}
	if count == 0 {
		return 0
	}
	sorted := make([]float64, count)
	copy(sorted, rm.latencies[:count])
	sort.Float64s(sorted)
	idx := int(math.Ceil(float64(count)*0.99)) - 1
	if idx < 0 {
		idx = 0
	}
	return sorted[idx]
}

// GeoStats tracks geo-routing metrics.
type GeoStats struct {
	LocalRoutes      int64 `json:"local_routes"`
	CrossRegionRoutes int64 `json:"cross_region_routes"`
	FailoverRoutes   int64 `json:"failover_routes"`
	ZonePreferred    int64 `json:"zone_preferred"`
}

// NewGeoRouter creates a new geo-aware router.
func NewGeoRouter(config GeoConfig) *GeoRouter {
	gr := &GeoRouter{
		config:        config,
		regionStats:   make(map[string]*regionMetrics),
		failoverState: make(map[string]bool),
		stats:         &GeoStats{},
	}

	// Initialize metrics for known regions
	gr.regionStats[config.LocalRegion] = newRegionMetrics()
	for _, r := range config.FailoverRegions {
		gr.regionStats[r] = newRegionMetrics()
	}

	log.Printf("[GeoRouter] Initialized: local=%s/%s failover=%v",
		config.LocalRegion, config.LocalZone, config.FailoverRegions)

	return gr
}

// SelectInstances returns instances sorted by region preference with failover.
func (gr *GeoRouter) SelectInstances(instances []*ServiceInstance) []*ServiceInstance {
	if len(instances) == 0 {
		return nil
	}

	gr.mu.RLock()
	defer gr.mu.RUnlock()

	// Bucket instances by region
	byRegion := make(map[string][]*ServiceInstance)
	for _, inst := range instances {
		region := inst.Region
		if region == "" {
			region = "unknown"
		}
		byRegion[region] = append(byRegion[region], inst)
	}

	// Check if local region is healthy enough
	localInstances := byRegion[gr.config.LocalRegion]
	localHealthy := countHealthy(localInstances)
	localTotal := len(localInstances)
	localRatio := float64(0)
	if localTotal > 0 {
		localRatio = float64(localHealthy) / float64(localTotal)
	}

	// If local region is healthy, prefer it
	if localRatio >= gr.config.HealthyThreshold && localHealthy > 0 {
		result := gr.sortByZonePreference(localInstances)
		atomic.AddInt64(&gr.stats.LocalRoutes, 1)
		return result
	}

	// Failover: try regions in order
	atomic.AddInt64(&gr.stats.FailoverRoutes, 1)
	var result []*ServiceInstance

	// Add local healthy instances first (even if below threshold)
	for _, inst := range localInstances {
		if inst.Health == HealthHealthy {
			result = append(result, inst)
		}
	}

	// Add failover regions in preference order
	for _, region := range gr.config.FailoverRegions {
		regionInstances := byRegion[region]
		healthy := filterHealthy(regionInstances)
		result = append(result, healthy...)
	}

	// Add any remaining unknown-region instances
	if unknowns, ok := byRegion["unknown"]; ok {
		result = append(result, filterHealthy(unknowns)...)
	}

	if len(result) == 0 {
		// Last resort: return all instances regardless of health
		return instances
	}

	return result
}

func (gr *GeoRouter) sortByZonePreference(instances []*ServiceInstance) []*ServiceInstance {
	if !gr.config.PreferLocalZone {
		return instances
	}

	// Sort: same zone first, then others
	localZone := gr.config.LocalZone
	sort.SliceStable(instances, func(i, j int) bool {
		iLocal := instances[i].Zone == localZone
		jLocal := instances[j].Zone == localZone
		if iLocal != jLocal {
			atomic.AddInt64(&gr.stats.ZonePreferred, 1)
			return iLocal
		}
		return false
	})

	return instances
}

// RecordLatency records a request latency for a region.
func (gr *GeoRouter) RecordLatency(region string, latencyMs float64) {
	gr.mu.RLock()
	metrics, ok := gr.regionStats[region]
	gr.mu.RUnlock()

	if !ok {
		gr.mu.Lock()
		metrics = newRegionMetrics()
		gr.regionStats[region] = metrics
		gr.mu.Unlock()
	}

	metrics.recordLatency(latencyMs)

	// Track cross-region routing
	if region != gr.config.LocalRegion {
		atomic.AddInt64(&gr.stats.CrossRegionRoutes, 1)
	}
}

// RecordError records a request error for a region.
func (gr *GeoRouter) RecordError(region string) {
	gr.mu.RLock()
	metrics, ok := gr.regionStats[region]
	gr.mu.RUnlock()

	if !ok {
		return
	}
	metrics.recordError()
}

// GetRegionStatuses returns health and latency info for all known regions.
func (gr *GeoRouter) GetRegionStatuses(instances []*ServiceInstance) []RegionStatus {
	gr.mu.RLock()
	defer gr.mu.RUnlock()

	// Group instances by region
	byRegion := make(map[string][]*ServiceInstance)
	for _, inst := range instances {
		region := inst.Region
		if region == "" {
			region = "unknown"
		}
		byRegion[region] = append(byRegion[region], inst)
	}

	var statuses []RegionStatus

	// Build status for each region with metrics
	allRegions := make(map[string]bool)
	allRegions[gr.config.LocalRegion] = true
	for _, r := range gr.config.FailoverRegions {
		allRegions[r] = true
	}
	for r := range byRegion {
		allRegions[r] = true
	}

	for region := range allRegions {
		regionInstances := byRegion[region]
		healthy, degraded, unhealthy := countByHealth(regionInstances)

		status := RegionStatus{
			Region:      region,
			Instances:   len(regionInstances),
			Healthy:     healthy,
			Degraded:    degraded,
			Unhealthy:   unhealthy,
			IsFailover:  region != gr.config.LocalRegion,
			LastChecked: time.Now(),
		}

		if metrics, ok := gr.regionStats[region]; ok {
			status.AvgLatencyMs = metrics.avgLatency()
			status.P99LatencyMs = metrics.p99Latency()
			status.RequestCount = metrics.requestCount
			status.ErrorCount = metrics.errorCount
			if metrics.requestCount > 0 {
				status.ErrorRate = float64(metrics.errorCount) / float64(metrics.requestCount) * 100
			}
		}

		statuses = append(statuses, status)
	}

	// Sort: local first, then by instance count
	sort.SliceStable(statuses, func(i, j int) bool {
		if statuses[i].Region == gr.config.LocalRegion {
			return true
		}
		if statuses[j].Region == gr.config.LocalRegion {
			return false
		}
		return statuses[i].Instances > statuses[j].Instances
	})

	return statuses
}

// GetStats returns geo-routing statistics.
func (gr *GeoRouter) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"local_region":        gr.config.LocalRegion,
		"local_zone":          gr.config.LocalZone,
		"failover_regions":    gr.config.FailoverRegions,
		"latency_threshold":   gr.config.LatencyThreshold.String(),
		"healthy_threshold":   fmt.Sprintf("%.0f%%", gr.config.HealthyThreshold*100),
		"prefer_local_zone":   gr.config.PreferLocalZone,
		"cross_region_weight": gr.config.CrossRegionWeight,
		"local_routes":        atomic.LoadInt64(&gr.stats.LocalRoutes),
		"cross_region_routes": atomic.LoadInt64(&gr.stats.CrossRegionRoutes),
		"failover_routes":     atomic.LoadInt64(&gr.stats.FailoverRoutes),
		"zone_preferred":      atomic.LoadInt64(&gr.stats.ZonePreferred),
	}
}

// ── Helpers ─────────────────────────────────────────────────────

func countHealthy(instances []*ServiceInstance) int {
	count := 0
	for _, inst := range instances {
		if inst.Health == HealthHealthy && inst.Status == StatusActive {
			count++
		}
	}
	return count
}

func filterHealthy(instances []*ServiceInstance) []*ServiceInstance {
	var result []*ServiceInstance
	for _, inst := range instances {
		if inst.Health == HealthHealthy && inst.Status == StatusActive {
			result = append(result, inst)
		}
	}
	return result
}

func countByHealth(instances []*ServiceInstance) (healthy, degraded, unhealthy int) {
	for _, inst := range instances {
		switch inst.Health {
		case HealthHealthy:
			healthy++
		case HealthDegraded:
			degraded++
		case HealthUnhealthy:
			unhealthy++
		}
	}
	return
}
