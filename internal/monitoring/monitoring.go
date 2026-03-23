package monitoring

import (
	"fmt"
	"log"
	"math"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

// AlertSeverity represents alert severity level.
type AlertSeverity string

const (
	SevCritical AlertSeverity = "critical"
	SevWarning  AlertSeverity = "warning"
	SevInfo     AlertSeverity = "info"
)

// AlertState represents alert state.
type AlertState string

const (
	AlertFiring   AlertState = "firing"
	AlertResolved AlertState = "resolved"
	AlertPending  AlertState = "pending"
)

// MetricType defines the kind of metric.
type MetricType string

const (
	MetricGauge     MetricType = "gauge"
	MetricCounter   MetricType = "counter"
	MetricHistogram MetricType = "histogram"
)

// Metric represents a monitored metric with time-series data.
type Metric struct {
	Name        string     `json:"name"`
	Type        MetricType `json:"type"`
	Description string     `json:"description"`
	Unit        string     `json:"unit"`
	Current     float64    `json:"current"`
	Min         float64    `json:"min"`
	Max         float64    `json:"max"`
	Avg         float64    `json:"avg"`
	Datapoints  []Datapoint `json:"datapoints"`
	Labels      map[string]string `json:"labels,omitempty"`
}

// Datapoint is a single time-series data point.
type Datapoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
}

// Alert represents a monitoring alert.
type Alert struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Severity    AlertSeverity `json:"severity"`
	State       AlertState    `json:"state"`
	Message     string        `json:"message"`
	Metric      string        `json:"metric"`
	Threshold   float64       `json:"threshold"`
	CurrentVal  float64       `json:"current_value"`
	Labels      map[string]string `json:"labels,omitempty"`
	FiredAt     time.Time     `json:"fired_at"`
	ResolvedAt  *time.Time    `json:"resolved_at,omitempty"`
}

// AlertRule defines when an alert should fire.
type AlertRule struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Metric      string        `json:"metric"`
	Condition   string        `json:"condition"` // gt, lt, eq
	Threshold   float64       `json:"threshold"`
	Duration    string        `json:"duration"` // how long before firing
	Severity    AlertSeverity `json:"severity"`
	Enabled     bool          `json:"enabled"`
	Channels    []string      `json:"channels"` // slack, email, pagerduty
}

// LogEntry represents a structured log entry.
type LogEntry struct {
	Timestamp time.Time         `json:"timestamp"`
	Level     string            `json:"level"` // debug, info, warn, error, fatal
	Service   string            `json:"service"`
	Message   string            `json:"message"`
	TraceID   string            `json:"trace_id,omitempty"`
	SpanID    string            `json:"span_id,omitempty"`
	Fields    map[string]string `json:"fields,omitempty"`
}

// Trace represents a distributed trace.
type Trace struct {
	TraceID   string    `json:"trace_id"`
	Service   string    `json:"service"`
	Operation string    `json:"operation"`
	Duration  float64   `json:"duration_ms"`
	Status    string    `json:"status"` // ok, error
	Spans     []Span    `json:"spans"`
	StartedAt time.Time `json:"started_at"`
}

// Span represents a single span in a trace.
type Span struct {
	SpanID    string    `json:"span_id"`
	ParentID  string    `json:"parent_id,omitempty"`
	Operation string    `json:"operation"`
	Service   string    `json:"service"`
	Duration  float64   `json:"duration_ms"`
	Status    string    `json:"status"`
	Tags      map[string]string `json:"tags,omitempty"`
	StartedAt time.Time `json:"started_at"`
}

// SLO represents a Service Level Objective.
type SLO struct {
	Name       string  `json:"name"`
	Target     float64 `json:"target"`  // e.g., 99.9
	Current    float64 `json:"current"` // e.g., 99.95
	BudgetUsed float64 `json:"budget_used"` // percentage of error budget consumed
	Window     string  `json:"window"` // 7d, 30d
	Metric     string  `json:"metric"`
}

// MonitoringStats tracks observability metrics.
type MonitoringStats struct {
	TotalMetrics   int64 `json:"total_metrics"`
	ActiveAlerts   int64 `json:"active_alerts"`
	ResolvedAlerts int64 `json:"resolved_alerts"`
	LogsIngested   int64 `json:"logs_ingested"`
	TracesCollected int64 `json:"traces_collected"`
	SLOsMet        int64 `json:"slos_met"`
	SLOsViolated   int64 `json:"slos_violated"`
}

// MonitoringManager manages observability features.
type MonitoringManager struct {
	mu         sync.RWMutex
	metrics    []*Metric
	alerts     []*Alert
	alertRules []*AlertRule
	logs       []*LogEntry
	traces     []*Trace
	slos       []*SLO
	stats      *MonitoringStats
	stopCh     chan struct{}
}

var (
	globalMon     *MonitoringManager
	globalMonLock sync.RWMutex
)

func InitGlobalMonitoring() *MonitoringManager {
	mgr := &MonitoringManager{
		stats:  &MonitoringStats{},
		stopCh: make(chan struct{}),
	}
	mgr.seedDemoData()

	globalMonLock.Lock()
	globalMon = mgr
	globalMonLock.Unlock()

	log.Printf("[Monitoring] Initialized: metrics=%d alerts=%d traces=%d", len(mgr.metrics), len(mgr.alerts), len(mgr.traces))
	return mgr
}

func GetGlobalMonitoring() *MonitoringManager {
	globalMonLock.RLock()
	defer globalMonLock.RUnlock()
	return globalMon
}

func genDatapoints(base, variance float64, count int) []Datapoint {
	now := time.Now()
	pts := make([]Datapoint, count)
	for i := 0; i < count; i++ {
		pts[i] = Datapoint{
			Timestamp: now.Add(-time.Duration(count-i) * time.Minute),
			Value:     math.Max(0, base+variance*(rand.Float64()*2-1)),
		}
	}
	return pts
}

func (m *MonitoringManager) seedDemoData() {
	now := time.Now()

	// Metrics
	m.metrics = []*Metric{
		{Name: "http_request_duration_ms", Type: MetricHistogram, Description: "HTTP request latency", Unit: "ms", Current: 45.2, Min: 8.1, Max: 890.5, Avg: 52.3, Datapoints: genDatapoints(50, 20, 60), Labels: map[string]string{"service": "api"}},
		{Name: "http_requests_total", Type: MetricCounter, Description: "Total HTTP requests", Unit: "req", Current: 158432, Min: 0, Max: 158432, Avg: 2640, Datapoints: genDatapoints(2640, 500, 60)},
		{Name: "cpu_usage_percent", Type: MetricGauge, Description: "CPU utilization", Unit: "%", Current: 42.5, Min: 15.2, Max: 78.9, Avg: 38.7, Datapoints: genDatapoints(40, 15, 60)},
		{Name: "memory_usage_percent", Type: MetricGauge, Description: "Memory utilization", Unit: "%", Current: 61.3, Min: 45.0, Max: 72.8, Avg: 58.2, Datapoints: genDatapoints(58, 8, 60)},
		{Name: "error_rate", Type: MetricGauge, Description: "Error rate (5xx)", Unit: "%", Current: 0.12, Min: 0.0, Max: 2.1, Avg: 0.15, Datapoints: genDatapoints(0.15, 0.1, 60)},
		{Name: "cache_hit_rate", Type: MetricGauge, Description: "Cache hit ratio", Unit: "%", Current: 92.4, Min: 85.1, Max: 97.2, Avg: 91.8, Datapoints: genDatapoints(92, 4, 60)},
		{Name: "db_connections_active", Type: MetricGauge, Description: "Active DB connections", Unit: "conn", Current: 24, Min: 5, Max: 45, Avg: 22, Datapoints: genDatapoints(22, 8, 60)},
		{Name: "queue_depth", Type: MetricGauge, Description: "Message queue depth", Unit: "msgs", Current: 128, Min: 0, Max: 1500, Avg: 200, Datapoints: genDatapoints(200, 100, 60)},
		{Name: "tokens_per_second", Type: MetricGauge, Description: "LLM inference throughput", Unit: "tok/s", Current: 1250, Min: 800, Max: 2100, Avg: 1180, Datapoints: genDatapoints(1180, 200, 60)},
		{Name: "p99_latency_ms", Type: MetricGauge, Description: "P99 request latency", Unit: "ms", Current: 245, Min: 120, Max: 890, Avg: 280, Datapoints: genDatapoints(280, 80, 60)},
	}

	// Alert rules
	m.alertRules = []*AlertRule{
		{ID: "rule-1", Name: "High Error Rate", Metric: "error_rate", Condition: "gt", Threshold: 1.0, Duration: "5m", Severity: SevCritical, Enabled: true, Channels: []string{"slack", "pagerduty"}},
		{ID: "rule-2", Name: "High CPU Usage", Metric: "cpu_usage_percent", Condition: "gt", Threshold: 80.0, Duration: "10m", Severity: SevWarning, Enabled: true, Channels: []string{"slack"}},
		{ID: "rule-3", Name: "High Memory Usage", Metric: "memory_usage_percent", Condition: "gt", Threshold: 85.0, Duration: "10m", Severity: SevWarning, Enabled: true, Channels: []string{"slack"}},
		{ID: "rule-4", Name: "High P99 Latency", Metric: "p99_latency_ms", Condition: "gt", Threshold: 500.0, Duration: "5m", Severity: SevWarning, Enabled: true, Channels: []string{"slack", "email"}},
		{ID: "rule-5", Name: "Low Cache Hit Rate", Metric: "cache_hit_rate", Condition: "lt", Threshold: 80.0, Duration: "15m", Severity: SevInfo, Enabled: true, Channels: []string{"slack"}},
		{ID: "rule-6", Name: "Queue Backlog", Metric: "queue_depth", Condition: "gt", Threshold: 1000.0, Duration: "5m", Severity: SevWarning, Enabled: true, Channels: []string{"slack"}},
	}

	// Alerts
	resolved1 := now.Add(-2 * time.Hour)
	m.alerts = []*Alert{
		{ID: "alert-1", Name: "High P99 Latency", Severity: SevWarning, State: AlertResolved, Message: "P99 latency exceeded 500ms threshold", Metric: "p99_latency_ms", Threshold: 500, CurrentVal: 612, FiredAt: now.Add(-4 * time.Hour), ResolvedAt: &resolved1},
		{ID: "alert-2", Name: "Queue Backlog", Severity: SevWarning, State: AlertResolved, Message: "Queue depth exceeded 1000 messages", Metric: "queue_depth", Threshold: 1000, CurrentVal: 1350, FiredAt: now.Add(-8 * time.Hour), ResolvedAt: &resolved1},
		{ID: "alert-3", Name: "High Error Rate", Severity: SevCritical, State: AlertFiring, Message: "Error rate spiked above 1% on /api/v1/completions", Metric: "error_rate", Threshold: 1.0, CurrentVal: 1.8, Labels: map[string]string{"endpoint": "/api/v1/completions"}, FiredAt: now.Add(-15 * time.Minute)},
	}

	// Logs
	levels := []string{"info", "info", "info", "warn", "error", "debug", "info"}
	services := []string{"api", "worker", "cache", "queue", "mesh"}
	messages := []string{
		"Request completed successfully", "Cache miss for key models:list", "Worker pool scaled to 8 threads",
		"Connection pool exhausted, waiting", "Failed to process message: timeout", "Health check passed",
		"Rate limit applied for api_key_abc", "Model inference completed in 85ms", "Redis reconnected after failover",
		"JWT token refreshed", "Webhook delivery failed, retrying", "Database query took 250ms",
	}
	traceIDs := []string{"abc123def456", "789ghi012jkl", "mno345pqr678", "stu901vwx234"}

	for i := 0; i < 50; i++ {
		m.logs = append(m.logs, &LogEntry{
			Timestamp: now.Add(-time.Duration(i*2+rand.Intn(3)) * time.Minute),
			Level:     levels[rand.Intn(len(levels))],
			Service:   services[rand.Intn(len(services))],
			Message:   messages[rand.Intn(len(messages))],
			TraceID:   traceIDs[rand.Intn(len(traceIDs))],
			SpanID:    fmt.Sprintf("span-%d", rand.Intn(1000)),
		})
	}

	// Traces
	operations := []string{"POST /api/v1/completions", "GET /api/v1/models", "POST /api/v1/cache/clear", "GET /api/v1/requests/stats"}
	for i := 0; i < 10; i++ {
		op := operations[rand.Intn(len(operations))]
		totalDur := float64(rand.Intn(400) + 20)
		status := "ok"
		if rand.Float64() < 0.1 { status = "error" }
		spans := []Span{
			{SpanID: fmt.Sprintf("s-%d-1", i), Operation: "http.request", Service: "api-gateway", Duration: totalDur, Status: status, StartedAt: now.Add(-time.Duration(i*10) * time.Minute)},
			{SpanID: fmt.Sprintf("s-%d-2", i), ParentID: fmt.Sprintf("s-%d-1", i), Operation: "auth.verify", Service: "auth", Duration: totalDur * 0.05, Status: "ok", StartedAt: now.Add(-time.Duration(i*10) * time.Minute)},
			{SpanID: fmt.Sprintf("s-%d-3", i), ParentID: fmt.Sprintf("s-%d-1", i), Operation: "cache.lookup", Service: "cache", Duration: totalDur * 0.08, Status: "ok", StartedAt: now.Add(-time.Duration(i*10) * time.Minute)},
			{SpanID: fmt.Sprintf("s-%d-4", i), ParentID: fmt.Sprintf("s-%d-1", i), Operation: "model.inference", Service: "worker", Duration: totalDur * 0.7, Status: status, StartedAt: now.Add(-time.Duration(i*10) * time.Minute)},
			{SpanID: fmt.Sprintf("s-%d-5", i), ParentID: fmt.Sprintf("s-%d-4", i), Operation: "db.query", Service: "postgres", Duration: totalDur * 0.1, Status: "ok", StartedAt: now.Add(-time.Duration(i*10) * time.Minute)},
		}
		m.traces = append(m.traces, &Trace{
			TraceID: fmt.Sprintf("trace-%d-%s", i, randHex(8)), Service: "api", Operation: op,
			Duration: totalDur, Status: status, Spans: spans, StartedAt: now.Add(-time.Duration(i*10) * time.Minute),
		})
	}

	// SLOs
	m.slos = []*SLO{
		{Name: "API Availability", Target: 99.9, Current: 99.95, BudgetUsed: 35.2, Window: "30d", Metric: "uptime"},
		{Name: "P99 Latency < 500ms", Target: 99.0, Current: 98.7, BudgetUsed: 78.5, Window: "7d", Metric: "p99_latency_ms"},
		{Name: "Error Rate < 1%", Target: 99.5, Current: 99.88, BudgetUsed: 22.1, Window: "30d", Metric: "error_rate"},
		{Name: "Inference Throughput", Target: 95.0, Current: 97.2, BudgetUsed: 18.4, Window: "7d", Metric: "tokens_per_second"},
	}

	// Stats
	m.stats.TotalMetrics = int64(len(m.metrics))
	m.stats.ActiveAlerts = 1
	m.stats.ResolvedAlerts = 2
	m.stats.LogsIngested = int64(len(m.logs)) * 100
	m.stats.TracesCollected = int64(len(m.traces)) * 50
	m.stats.SLOsMet = 3
	m.stats.SLOsViolated = 1
}

func randHex(n int) string {
	const hex = "0123456789abcdef"
	b := make([]byte, n)
	for i := range b { b[i] = hex[rand.Intn(len(hex))] }
	return string(b)
}

// ── Getters ─────────────────────────────────────────────

func (m *MonitoringManager) GetMetrics() []*Metric { m.mu.RLock(); defer m.mu.RUnlock(); r := make([]*Metric, len(m.metrics)); copy(r, m.metrics); return r }
func (m *MonitoringManager) GetAlerts() []*Alert { m.mu.RLock(); defer m.mu.RUnlock(); r := make([]*Alert, len(m.alerts)); copy(r, m.alerts); return r }
func (m *MonitoringManager) GetAlertRules() []*AlertRule { m.mu.RLock(); defer m.mu.RUnlock(); r := make([]*AlertRule, len(m.alertRules)); copy(r, m.alertRules); return r }
func (m *MonitoringManager) GetLogs(limit int) []*LogEntry {
	m.mu.RLock(); defer m.mu.RUnlock()
	if limit <= 0 || limit > len(m.logs) { limit = len(m.logs) }
	r := make([]*LogEntry, limit); copy(r, m.logs[:limit]); return r
}
func (m *MonitoringManager) GetTraces() []*Trace { m.mu.RLock(); defer m.mu.RUnlock(); r := make([]*Trace, len(m.traces)); copy(r, m.traces); return r }
func (m *MonitoringManager) GetSLOs() []*SLO { m.mu.RLock(); defer m.mu.RUnlock(); r := make([]*SLO, len(m.slos)); copy(r, m.slos); return r }

func (m *MonitoringManager) ToggleAlertRule(id string) error {
	m.mu.Lock(); defer m.mu.Unlock()
	for _, r := range m.alertRules {
		if r.ID == id { r.Enabled = !r.Enabled; return nil }
	}
	return fmt.Errorf("rule not found: %s", id)
}

func (m *MonitoringManager) ResolveAlert(id string) error {
	m.mu.Lock(); defer m.mu.Unlock()
	for _, a := range m.alerts {
		if a.ID == id && a.State == AlertFiring {
			a.State = AlertResolved
			now := time.Now(); a.ResolvedAt = &now
			atomic.AddInt64(&m.stats.ActiveAlerts, -1)
			atomic.AddInt64(&m.stats.ResolvedAlerts, 1)
			return nil
		}
	}
	return fmt.Errorf("alert not found or not firing: %s", id)
}

func (m *MonitoringManager) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"total_metrics":    atomic.LoadInt64(&m.stats.TotalMetrics),
		"active_alerts":    atomic.LoadInt64(&m.stats.ActiveAlerts),
		"resolved_alerts":  atomic.LoadInt64(&m.stats.ResolvedAlerts),
		"logs_ingested":    atomic.LoadInt64(&m.stats.LogsIngested),
		"traces_collected": atomic.LoadInt64(&m.stats.TracesCollected),
		"slos_met":         atomic.LoadInt64(&m.stats.SLOsMet),
		"slos_violated":    atomic.LoadInt64(&m.stats.SLOsViolated),
	}
}

func (m *MonitoringManager) Stop() { close(m.stopCh); log.Printf("[Monitoring] Stopped") }
