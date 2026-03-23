package security

import (
	"fmt"
	"log"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

// ThreatLevel represents the severity of a security finding.
type ThreatLevel string

const (
	ThreatCritical ThreatLevel = "critical"
	ThreatHigh     ThreatLevel = "high"
	ThreatMedium   ThreatLevel = "medium"
	ThreatLow      ThreatLevel = "low"
	ThreatInfo     ThreatLevel = "info"
)

// ScanStatus represents a security scan status.
type ScanStatus string

const (
	ScanPassed ScanStatus = "passed"
	ScanFailed ScanStatus = "failed"
	ScanWarn   ScanStatus = "warning"
)

// SecurityScan represents a completed security scan.
type SecurityScan struct {
	ID          string     `json:"id"`
	Type        string     `json:"type"` // vulnerability, dependency, sast, container, secret
	Status      ScanStatus `json:"status"`
	Findings    int        `json:"findings"`
	Critical    int        `json:"critical"`
	High        int        `json:"high"`
	Medium      int        `json:"medium"`
	Low         int        `json:"low"`
	Duration    string     `json:"duration"`
	CompletedAt time.Time  `json:"completed_at"`
}

// Vulnerability represents a discovered vulnerability.
type Vulnerability struct {
	ID          string      `json:"id"`
	Title       string      `json:"title"`
	Severity    ThreatLevel `json:"severity"`
	Package     string      `json:"package"`
	Version     string      `json:"version"`
	FixedIn     string      `json:"fixed_in"`
	CVSS        float64     `json:"cvss"`
	CVE         string      `json:"cve"`
	Description string      `json:"description"`
	Status      string      `json:"status"` // open, fixed, ignored
	DiscoveredAt time.Time  `json:"discovered_at"`
}

// SecretFinding represents a detected secret in code.
type SecretFinding struct {
	ID       string    `json:"id"`
	Type     string    `json:"type"` // api_key, password, token, private_key
	File     string    `json:"file"`
	Line     int       `json:"line"`
	Status   string    `json:"status"` // active, revoked, false_positive
	DetectedAt time.Time `json:"detected_at"`
}

// ComplianceCheck represents a compliance rule check.
type ComplianceCheck struct {
	ID          string `json:"id"`
	Framework   string `json:"framework"` // SOC2, HIPAA, GDPR, PCI-DSS
	Control     string `json:"control"`
	Description string `json:"description"`
	Status      string `json:"status"` // compliant, non_compliant, partial
	Evidence    string `json:"evidence"`
}

// WAFEvent represents a WAF-blocked request.
type WAFEvent struct {
	ID        string    `json:"id"`
	Rule      string    `json:"rule"`
	Action    string    `json:"action"` // block, alert, rate_limit
	SourceIP  string    `json:"source_ip"`
	Path      string    `json:"path"`
	Method    string    `json:"method"`
	Category  string    `json:"category"` // sqli, xss, rce, path_traversal, bot
	Timestamp time.Time `json:"timestamp"`
}

// SecurityPolicy represents a security policy.
type SecurityPolicy struct {
	Name        string `json:"name"`
	Enabled     bool   `json:"enabled"`
	Description string `json:"description"`
	Category    string `json:"category"` // auth, network, data, access
}

// SecurityStats tracks security metrics.
type SecurityStats struct {
	TotalScans         int64 `json:"total_scans"`
	Vulnerabilities    int64 `json:"vulnerabilities"`
	CriticalVulns      int64 `json:"critical_vulns"`
	SecretsDetected    int64 `json:"secrets_detected"`
	ComplianceScore    float64 `json:"compliance_score"`
	WAFEventsBlocked   int64 `json:"waf_events_blocked"`
	PoliciesEnabled    int64 `json:"policies_enabled"`
	LastScanAt         time.Time `json:"last_scan_at"`
}

// SecurityManager manages security hardening features.
type SecurityManager struct {
	mu              sync.RWMutex
	scans           []*SecurityScan
	vulnerabilities []*Vulnerability
	secrets         []*SecretFinding
	compliance      []*ComplianceCheck
	wafEvents       []*WAFEvent
	policies        []*SecurityPolicy
	stats           *SecurityStats
	stopCh          chan struct{}
}

var (
	globalSec     *SecurityManager
	globalSecLock sync.RWMutex
)

func InitGlobalSecurity() *SecurityManager {
	mgr := &SecurityManager{
		stats:  &SecurityStats{},
		stopCh: make(chan struct{}),
	}
	mgr.seedDemoData()

	globalSecLock.Lock()
	globalSec = mgr
	globalSecLock.Unlock()

	log.Printf("[Security] Initialized: scans=%d vulns=%d policies=%d", len(mgr.scans), len(mgr.vulnerabilities), len(mgr.policies))
	return mgr
}

func GetGlobalSecurity() *SecurityManager {
	globalSecLock.RLock()
	defer globalSecLock.RUnlock()
	return globalSec
}

func (m *SecurityManager) seedDemoData() {
	now := time.Now()

	// Scans
	m.scans = []*SecurityScan{
		{ID: "scan-1", Type: "vulnerability", Status: ScanWarn, Findings: 12, Critical: 0, High: 2, Medium: 5, Low: 5, Duration: "2m 34s", CompletedAt: now.Add(-2 * time.Hour)},
		{ID: "scan-2", Type: "dependency", Status: ScanPassed, Findings: 3, Critical: 0, High: 0, Medium: 2, Low: 1, Duration: "45s", CompletedAt: now.Add(-4 * time.Hour)},
		{ID: "scan-3", Type: "sast", Status: ScanPassed, Findings: 1, Critical: 0, High: 0, Medium: 1, Low: 0, Duration: "1m 12s", CompletedAt: now.Add(-6 * time.Hour)},
		{ID: "scan-4", Type: "container", Status: ScanWarn, Findings: 8, Critical: 0, High: 1, Medium: 3, Low: 4, Duration: "3m 05s", CompletedAt: now.Add(-12 * time.Hour)},
		{ID: "scan-5", Type: "secret", Status: ScanPassed, Findings: 0, Critical: 0, High: 0, Medium: 0, Low: 0, Duration: "28s", CompletedAt: now.Add(-1 * time.Hour)},
	}

	// Vulnerabilities
	m.vulnerabilities = []*Vulnerability{
		{ID: "vuln-1", Title: "golang.org/x/net HTTP/2 Rapid Reset", Severity: ThreatHigh, Package: "golang.org/x/net", Version: "v0.17.0", FixedIn: "v0.23.0", CVSS: 7.5, CVE: "CVE-2023-44487", Description: "HTTP/2 rapid reset attack vulnerability", Status: "open", DiscoveredAt: now.Add(-48 * time.Hour)},
		{ID: "vuln-2", Title: "crypto/tls: slow verification of certificate chains", Severity: ThreatMedium, Package: "stdlib", Version: "go1.21.5", FixedIn: "go1.21.6", CVSS: 5.3, CVE: "CVE-2024-24784", Description: "Slow TLS certificate chain verification", Status: "fixed", DiscoveredAt: now.Add(-72 * time.Hour)},
		{ID: "vuln-3", Title: "Redis SORT_RO command vulnerability", Severity: ThreatHigh, Package: "redis", Version: "7.0.14", FixedIn: "7.0.15", CVSS: 8.1, CVE: "CVE-2024-31449", Description: "Potential RCE via SORT_RO command", Status: "open", DiscoveredAt: now.Add(-24 * time.Hour)},
		{ID: "vuln-4", Title: "next: SSRF in Server Actions", Severity: ThreatMedium, Package: "next", Version: "14.1.0", FixedIn: "14.1.1", CVSS: 5.9, CVE: "CVE-2024-34350", Description: "Server-Side Request Forgery via server actions", Status: "fixed", DiscoveredAt: now.Add(-96 * time.Hour)},
		{ID: "vuln-5", Title: "PostgreSQL: Memory disclosure in libpq", Severity: ThreatLow, Package: "postgres", Version: "16.1", FixedIn: "16.2", CVSS: 3.7, CVE: "CVE-2024-0985", Description: "Memory disclosure in connection handling", Status: "ignored", DiscoveredAt: now.Add(-120 * time.Hour)},
	}

	// Secrets
	m.secrets = []*SecretFinding{
		{ID: "sec-1", Type: "api_key", File: "config/test.env.example", Line: 12, Status: "false_positive", DetectedAt: now.Add(-72 * time.Hour)},
		{ID: "sec-2", Type: "token", File: "scripts/deploy-old.sh", Line: 45, Status: "revoked", DetectedAt: now.Add(-48 * time.Hour)},
	}

	// Compliance
	m.compliance = []*ComplianceCheck{
		{ID: "cc-1", Framework: "SOC2", Control: "CC6.1", Description: "Encryption at rest for all data stores", Status: "compliant", Evidence: "AES-256 encryption enabled on PostgreSQL and Redis"},
		{ID: "cc-2", Framework: "SOC2", Control: "CC6.6", Description: "Network security controls", Status: "compliant", Evidence: "VPC with security groups, no public DB access"},
		{ID: "cc-3", Framework: "SOC2", Control: "CC7.2", Description: "Monitoring and alerting", Status: "compliant", Evidence: "Prometheus + Grafana + PagerDuty integration"},
		{ID: "cc-4", Framework: "GDPR", Control: "Art. 32", Description: "Data encryption in transit", Status: "compliant", Evidence: "TLS 1.3 enforced on all endpoints"},
		{ID: "cc-5", Framework: "GDPR", Control: "Art. 17", Description: "Right to erasure implementation", Status: "partial", Evidence: "API endpoint exists, async deletion pending"},
		{ID: "cc-6", Framework: "PCI-DSS", Control: "Req 6.5", Description: "Secure coding practices", Status: "compliant", Evidence: "SAST scans in CI/CD, no critical findings"},
		{ID: "cc-7", Framework: "HIPAA", Control: "164.312(a)", Description: "Access control mechanisms", Status: "compliant", Evidence: "RBAC with JWT, session management"},
		{ID: "cc-8", Framework: "HIPAA", Control: "164.312(e)", Description: "Transmission security", Status: "compliant", Evidence: "TLS 1.3, HSTS headers, certificate pinning"},
	}

	// WAF Events
	ips := []string{"45.33.32.156", "192.168.1.100", "10.0.0.50", "203.0.113.42", "198.51.100.77"}
	categories := []string{"sqli", "xss", "path_traversal", "bot", "rce", "sqli"}
	paths := []string{"/api/v1/completions", "/api/v1/models", "/admin", "/wp-login.php", "/.env"}
	for i := 0; i < 20; i++ {
		m.wafEvents = append(m.wafEvents, &WAFEvent{
			ID: fmt.Sprintf("waf-%d", i+1), Rule: fmt.Sprintf("WAF-%03d", rand.Intn(50)+1),
			Action: "block", SourceIP: ips[rand.Intn(len(ips))],
			Path: paths[rand.Intn(len(paths))], Method: []string{"GET", "POST", "PUT"}[rand.Intn(3)],
			Category: categories[rand.Intn(len(categories))],
			Timestamp: now.Add(-time.Duration(i*30+rand.Intn(30)) * time.Minute),
		})
	}

	// Policies
	m.policies = []*SecurityPolicy{
		{Name: "TLS 1.3 Enforcement", Enabled: true, Description: "Require TLS 1.3 for all connections", Category: "network"},
		{Name: "JWT Token Rotation", Enabled: true, Description: "Rotate JWT signing keys every 24h", Category: "auth"},
		{Name: "Rate Limiting", Enabled: true, Description: "API rate limiting per key (100 req/min)", Category: "access"},
		{Name: "CORS Strict Mode", Enabled: true, Description: "Only allow whitelisted origins", Category: "network"},
		{Name: "SQL Injection Prevention", Enabled: true, Description: "Parameterized queries enforced", Category: "data"},
		{Name: "Input Sanitization", Enabled: true, Description: "Sanitize all user inputs", Category: "data"},
		{Name: "Audit Logging", Enabled: true, Description: "Log all admin actions", Category: "access"},
		{Name: "Container Scanning", Enabled: true, Description: "Scan images before deployment", Category: "network"},
		{Name: "Secret Rotation", Enabled: false, Description: "Auto-rotate secrets every 90 days", Category: "auth"},
		{Name: "IP Allowlisting", Enabled: false, Description: "Restrict admin access to allowed IPs", Category: "access"},
	}

	// Stats
	var enabledPolicies int64
	for _, p := range m.policies {
		if p.Enabled { enabledPolicies++ }
	}
	var compliant int
	for _, c := range m.compliance {
		if c.Status == "compliant" { compliant++ }
	}

	m.stats.TotalScans = int64(len(m.scans))
	m.stats.Vulnerabilities = int64(len(m.vulnerabilities))
	m.stats.CriticalVulns = 0
	m.stats.SecretsDetected = int64(len(m.secrets))
	m.stats.ComplianceScore = float64(compliant) / float64(len(m.compliance)) * 100
	m.stats.WAFEventsBlocked = int64(len(m.wafEvents))
	m.stats.PoliciesEnabled = enabledPolicies
	m.stats.LastScanAt = m.scans[0].CompletedAt
}

// ── Getters ─────────────────────────────────────────────

func (m *SecurityManager) GetScans() []*SecurityScan { m.mu.RLock(); defer m.mu.RUnlock(); r := make([]*SecurityScan, len(m.scans)); copy(r, m.scans); return r }
func (m *SecurityManager) GetVulnerabilities() []*Vulnerability { m.mu.RLock(); defer m.mu.RUnlock(); r := make([]*Vulnerability, len(m.vulnerabilities)); copy(r, m.vulnerabilities); return r }
func (m *SecurityManager) GetSecrets() []*SecretFinding { m.mu.RLock(); defer m.mu.RUnlock(); r := make([]*SecretFinding, len(m.secrets)); copy(r, m.secrets); return r }
func (m *SecurityManager) GetCompliance() []*ComplianceCheck { m.mu.RLock(); defer m.mu.RUnlock(); r := make([]*ComplianceCheck, len(m.compliance)); copy(r, m.compliance); return r }
func (m *SecurityManager) GetWAFEvents(limit int) []*WAFEvent {
	m.mu.RLock(); defer m.mu.RUnlock()
	if limit <= 0 || limit > len(m.wafEvents) { limit = len(m.wafEvents) }
	r := make([]*WAFEvent, limit); copy(r, m.wafEvents[:limit]); return r
}
func (m *SecurityManager) GetPolicies() []*SecurityPolicy { m.mu.RLock(); defer m.mu.RUnlock(); r := make([]*SecurityPolicy, len(m.policies)); copy(r, m.policies); return r }

func (m *SecurityManager) TogglePolicy(name string) error {
	m.mu.Lock(); defer m.mu.Unlock()
	for _, p := range m.policies {
		if p.Name == name {
			p.Enabled = !p.Enabled
			if p.Enabled { atomic.AddInt64(&m.stats.PoliciesEnabled, 1) } else { atomic.AddInt64(&m.stats.PoliciesEnabled, -1) }
			return nil
		}
	}
	return fmt.Errorf("policy not found: %s", name)
}

func (m *SecurityManager) RunScan(scanType string) *SecurityScan {
	m.mu.Lock(); defer m.mu.Unlock()
	scan := &SecurityScan{
		ID: fmt.Sprintf("scan-%d", time.Now().UnixMilli()), Type: scanType, Status: ScanPassed,
		Findings: rand.Intn(5), Medium: rand.Intn(3), Low: rand.Intn(3),
		Duration: fmt.Sprintf("%ds", rand.Intn(120)+10), CompletedAt: time.Now(),
	}
	scan.Findings = scan.Medium + scan.Low
	if scan.Medium > 0 { scan.Status = ScanWarn }
	m.scans = append([]*SecurityScan{scan}, m.scans...)
	if len(m.scans) > 20 { m.scans = m.scans[:20] }
	atomic.AddInt64(&m.stats.TotalScans, 1)
	return scan
}

func (m *SecurityManager) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"total_scans":       atomic.LoadInt64(&m.stats.TotalScans),
		"vulnerabilities":   atomic.LoadInt64(&m.stats.Vulnerabilities),
		"critical_vulns":    atomic.LoadInt64(&m.stats.CriticalVulns),
		"secrets_detected":  atomic.LoadInt64(&m.stats.SecretsDetected),
		"compliance_score":  m.stats.ComplianceScore,
		"waf_events_blocked": atomic.LoadInt64(&m.stats.WAFEventsBlocked),
		"policies_enabled":  atomic.LoadInt64(&m.stats.PoliciesEnabled),
		"last_scan_at":      m.stats.LastScanAt,
	}
}

func (m *SecurityManager) Stop() { close(m.stopCh); log.Printf("[Security] Stopped") }
