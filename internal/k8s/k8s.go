package k8s

import (
	"fmt"
	"log"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

// PodPhase represents a Kubernetes pod phase.
type PodPhase string

const (
	PodRunning   PodPhase = "Running"
	PodPending   PodPhase = "Pending"
	PodSucceeded PodPhase = "Succeeded"
	PodFailed    PodPhase = "Failed"
	PodUnknown   PodPhase = "Unknown"
)

// DeploymentStatus represents a deployment's rollout status.
type DeploymentStatus string

const (
	DeployAvailable   DeploymentStatus = "Available"
	DeployProgressing DeploymentStatus = "Progressing"
	DeployFailed      DeploymentStatus = "Failed"
)

// Namespace represents a Kubernetes namespace.
type Namespace struct {
	Name      string    `json:"name"`
	Status    string    `json:"status"` // Active, Terminating
	Labels    map[string]string `json:"labels"`
	CreatedAt time.Time `json:"created_at"`
}

// Deployment represents a Kubernetes deployment.
type Deployment struct {
	Name              string           `json:"name"`
	Namespace         string           `json:"namespace"`
	Replicas          int              `json:"replicas"`
	ReadyReplicas     int              `json:"ready_replicas"`
	AvailableReplicas int              `json:"available_replicas"`
	UpdatedReplicas   int              `json:"updated_replicas"`
	Status            DeploymentStatus `json:"status"`
	Image             string           `json:"image"`
	Labels            map[string]string `json:"labels"`
	Strategy          string           `json:"strategy"` // RollingUpdate, Recreate
	MaxSurge          string           `json:"max_surge"`
	MaxUnavailable    string           `json:"max_unavailable"`
	CreatedAt         time.Time        `json:"created_at"`
	UpdatedAt         time.Time        `json:"updated_at"`
}

// Pod represents a Kubernetes pod.
type Pod struct {
	Name       string    `json:"name"`
	Namespace  string    `json:"namespace"`
	Phase      PodPhase  `json:"phase"`
	Node       string    `json:"node"`
	IP         string    `json:"ip"`
	CPUUsage   string    `json:"cpu_usage"`
	MemUsage   string    `json:"mem_usage"`
	Restarts   int       `json:"restarts"`
	Age        string    `json:"age"`
	Ready      string    `json:"ready"` // "1/1", "0/1"
	StartedAt  time.Time `json:"started_at"`
}

// Service represents a Kubernetes service.
type Service struct {
	Name       string            `json:"name"`
	Namespace  string            `json:"namespace"`
	Type       string            `json:"type"` // ClusterIP, NodePort, LoadBalancer
	ClusterIP  string            `json:"cluster_ip"`
	ExternalIP string            `json:"external_ip,omitempty"`
	Ports      []ServicePort     `json:"ports"`
	Selector   map[string]string `json:"selector"`
	CreatedAt  time.Time         `json:"created_at"`
}

// ServicePort represents a port on a service.
type ServicePort struct {
	Name       string `json:"name"`
	Port       int    `json:"port"`
	TargetPort int    `json:"target_port"`
	Protocol   string `json:"protocol"`
	NodePort   int    `json:"node_port,omitempty"`
}

// Node represents a Kubernetes node.
type Node struct {
	Name           string    `json:"name"`
	Status         string    `json:"status"` // Ready, NotReady
	Role           string    `json:"role"` // master, worker
	Version        string    `json:"version"`
	OS             string    `json:"os"`
	CPUCapacity    string    `json:"cpu_capacity"`
	MemCapacity    string    `json:"mem_capacity"`
	CPUUsage       string    `json:"cpu_usage"`
	MemUsage       string    `json:"mem_usage"`
	CPUPercent     float64   `json:"cpu_percent"`
	MemPercent     float64   `json:"mem_percent"`
	Pods           int       `json:"pods"`
	MaxPods        int       `json:"max_pods"`
	InternalIP     string    `json:"internal_ip"`
	CreatedAt      time.Time `json:"created_at"`
}

// HPA represents a Horizontal Pod Autoscaler.
type HPA struct {
	Name           string `json:"name"`
	Namespace      string `json:"namespace"`
	TargetRef      string `json:"target_ref"`
	MinReplicas    int    `json:"min_replicas"`
	MaxReplicas    int    `json:"max_replicas"`
	CurrentReplicas int   `json:"current_replicas"`
	DesiredReplicas int   `json:"desired_replicas"`
	CPUTarget      int    `json:"cpu_target_percent"`
	CPUCurrent     int    `json:"cpu_current_percent"`
}

// K8sEvent represents a cluster event.
type K8sEvent struct {
	Type      string    `json:"type"` // Normal, Warning
	Reason    string    `json:"reason"`
	Message   string    `json:"message"`
	Object    string    `json:"object"`
	Count     int       `json:"count"`
	FirstSeen time.Time `json:"first_seen"`
	LastSeen  time.Time `json:"last_seen"`
}

// K8sStats tracks cluster-wide metrics.
type K8sStats struct {
	TotalNodes       int64 `json:"total_nodes"`
	ReadyNodes       int64 `json:"ready_nodes"`
	TotalPods        int64 `json:"total_pods"`
	RunningPods      int64 `json:"running_pods"`
	TotalDeployments int64 `json:"total_deployments"`
	AvailableDeploys int64 `json:"available_deploys"`
	TotalServices    int64 `json:"total_services"`
	TotalNamespaces  int64 `json:"total_namespaces"`
	ScaleEvents      int64 `json:"scale_events"`
	RolloutEvents    int64 `json:"rollout_events"`
}

// K8sManager manages Kubernetes cluster state.
type K8sManager struct {
	mu          sync.RWMutex
	namespaces  []*Namespace
	deployments []*Deployment
	pods        []*Pod
	services    []*Service
	nodes       []*Node
	hpas        []*HPA
	events      []*K8sEvent
	stats       *K8sStats
	stopCh      chan struct{}
}

var (
	globalK8s     *K8sManager
	globalK8sLock sync.RWMutex
)

// InitGlobalK8s initializes the Kubernetes manager.
func InitGlobalK8s() *K8sManager {
	mgr := &K8sManager{
		stats:  &K8sStats{},
		stopCh: make(chan struct{}),
	}
	mgr.seedDemoData()

	globalK8sLock.Lock()
	globalK8s = mgr
	globalK8sLock.Unlock()

	log.Printf("[K8s] Initialized: nodes=%d deployments=%d pods=%d", len(mgr.nodes), len(mgr.deployments), len(mgr.pods))
	return mgr
}

func GetGlobalK8s() *K8sManager {
	globalK8sLock.RLock()
	defer globalK8sLock.RUnlock()
	return globalK8s
}

func (m *K8sManager) seedDemoData() {
	now := time.Now()

	// Namespaces
	m.namespaces = []*Namespace{
		{Name: "velocityllm", Status: "Active", Labels: map[string]string{"env": "production"}, CreatedAt: now.Add(-30 * 24 * time.Hour)},
		{Name: "velocityllm-staging", Status: "Active", Labels: map[string]string{"env": "staging"}, CreatedAt: now.Add(-25 * 24 * time.Hour)},
		{Name: "monitoring", Status: "Active", Labels: map[string]string{"env": "infra"}, CreatedAt: now.Add(-30 * 24 * time.Hour)},
		{Name: "kube-system", Status: "Active", Labels: map[string]string{"env": "system"}, CreatedAt: now.Add(-60 * 24 * time.Hour)},
	}

	// Nodes
	m.nodes = []*Node{
		{Name: "node-prod-1", Status: "Ready", Role: "worker", Version: "v1.29.2", OS: "Ubuntu 22.04", CPUCapacity: "8", MemCapacity: "32Gi", CPUUsage: "3.2", MemUsage: "18.5Gi", CPUPercent: 40, MemPercent: 57.8, Pods: 12, MaxPods: 110, InternalIP: "10.0.1.10", CreatedAt: now.Add(-30 * 24 * time.Hour)},
		{Name: "node-prod-2", Status: "Ready", Role: "worker", Version: "v1.29.2", OS: "Ubuntu 22.04", CPUCapacity: "8", MemCapacity: "32Gi", CPUUsage: "2.8", MemUsage: "14.2Gi", CPUPercent: 35, MemPercent: 44.4, Pods: 10, MaxPods: 110, InternalIP: "10.0.1.11", CreatedAt: now.Add(-30 * 24 * time.Hour)},
		{Name: "node-prod-3", Status: "Ready", Role: "worker", Version: "v1.29.2", OS: "Ubuntu 22.04", CPUCapacity: "16", MemCapacity: "64Gi", CPUUsage: "6.1", MemUsage: "28.7Gi", CPUPercent: 38.1, MemPercent: 44.8, Pods: 15, MaxPods: 110, InternalIP: "10.0.1.12", CreatedAt: now.Add(-20 * 24 * time.Hour)},
		{Name: "node-gpu-1", Status: "Ready", Role: "worker", Version: "v1.29.2", OS: "Ubuntu 22.04", CPUCapacity: "16", MemCapacity: "64Gi", CPUUsage: "8.5", MemUsage: "42.0Gi", CPUPercent: 53.1, MemPercent: 65.6, Pods: 8, MaxPods: 110, InternalIP: "10.0.2.10", CreatedAt: now.Add(-15 * 24 * time.Hour)},
	}

	// Deployments
	m.deployments = []*Deployment{
		{Name: "velocityllm-api", Namespace: "velocityllm", Replicas: 3, ReadyReplicas: 3, AvailableReplicas: 3, UpdatedReplicas: 3, Status: DeployAvailable, Image: "velocityllm/api:v1.2.0", Labels: map[string]string{"app": "api", "tier": "backend"}, Strategy: "RollingUpdate", MaxSurge: "25%", MaxUnavailable: "25%", CreatedAt: now.Add(-30 * 24 * time.Hour), UpdatedAt: now.Add(-2 * time.Hour)},
		{Name: "velocityllm-frontend", Namespace: "velocityllm", Replicas: 2, ReadyReplicas: 2, AvailableReplicas: 2, UpdatedReplicas: 2, Status: DeployAvailable, Image: "velocityllm/frontend:v1.2.0", Labels: map[string]string{"app": "frontend", "tier": "frontend"}, Strategy: "RollingUpdate", MaxSurge: "1", MaxUnavailable: "0", CreatedAt: now.Add(-30 * 24 * time.Hour), UpdatedAt: now.Add(-1 * time.Hour)},
		{Name: "velocityllm-worker", Namespace: "velocityllm", Replicas: 4, ReadyReplicas: 4, AvailableReplicas: 4, UpdatedReplicas: 4, Status: DeployAvailable, Image: "velocityllm/worker:v1.2.0", Labels: map[string]string{"app": "worker", "tier": "backend"}, Strategy: "RollingUpdate", MaxSurge: "50%", MaxUnavailable: "25%", CreatedAt: now.Add(-25 * 24 * time.Hour), UpdatedAt: now.Add(-6 * time.Hour)},
		{Name: "redis-cluster", Namespace: "velocityllm", Replicas: 3, ReadyReplicas: 3, AvailableReplicas: 3, UpdatedReplicas: 3, Status: DeployAvailable, Image: "redis:7.2-alpine", Labels: map[string]string{"app": "redis", "tier": "cache"}, Strategy: "RollingUpdate", MaxSurge: "1", MaxUnavailable: "1", CreatedAt: now.Add(-30 * 24 * time.Hour), UpdatedAt: now.Add(-48 * time.Hour)},
		{Name: "postgres-primary", Namespace: "velocityllm", Replicas: 1, ReadyReplicas: 1, AvailableReplicas: 1, UpdatedReplicas: 1, Status: DeployAvailable, Image: "postgres:16-alpine", Labels: map[string]string{"app": "postgres", "tier": "database"}, Strategy: "Recreate", CreatedAt: now.Add(-30 * 24 * time.Hour), UpdatedAt: now.Add(-72 * time.Hour)},
		{Name: "prometheus", Namespace: "monitoring", Replicas: 1, ReadyReplicas: 1, AvailableReplicas: 1, UpdatedReplicas: 1, Status: DeployAvailable, Image: "prom/prometheus:v2.50.0", Labels: map[string]string{"app": "prometheus"}, Strategy: "Recreate", CreatedAt: now.Add(-30 * 24 * time.Hour), UpdatedAt: now.Add(-96 * time.Hour)},
		{Name: "grafana", Namespace: "monitoring", Replicas: 1, ReadyReplicas: 1, AvailableReplicas: 1, UpdatedReplicas: 1, Status: DeployAvailable, Image: "grafana/grafana:10.3.1", Labels: map[string]string{"app": "grafana"}, Strategy: "RollingUpdate", MaxSurge: "1", MaxUnavailable: "0", CreatedAt: now.Add(-30 * 24 * time.Hour), UpdatedAt: now.Add(-120 * time.Hour)},
	}

	// Pods
	for _, d := range m.deployments {
		for i := 0; i < d.ReadyReplicas; i++ {
			nodeIdx := rand.Intn(len(m.nodes))
			age := time.Duration(rand.Intn(72)+1) * time.Hour
			m.pods = append(m.pods, &Pod{
				Name:      fmt.Sprintf("%s-%s-%s", d.Name, randStr(8), randStr(5)),
				Namespace: d.Namespace,
				Phase:     PodRunning,
				Node:      m.nodes[nodeIdx].Name,
				IP:        fmt.Sprintf("10.244.%d.%d", nodeIdx+1, rand.Intn(200)+10),
				CPUUsage:  fmt.Sprintf("%dm", rand.Intn(500)+50),
				MemUsage:  fmt.Sprintf("%dMi", rand.Intn(512)+64),
				Restarts:  rand.Intn(3),
				Age:       fmt.Sprintf("%dh", int(age.Hours())),
				Ready:     "1/1",
				StartedAt: now.Add(-age),
			})
		}
	}

	// Services
	m.services = []*Service{
		{Name: "velocityllm-api", Namespace: "velocityllm", Type: "LoadBalancer", ClusterIP: "10.96.10.1", ExternalIP: "34.120.55.100", Ports: []ServicePort{{Name: "http", Port: 80, TargetPort: 8080, Protocol: "TCP"}, {Name: "https", Port: 443, TargetPort: 8443, Protocol: "TCP"}}, Selector: map[string]string{"app": "api"}, CreatedAt: now.Add(-30 * 24 * time.Hour)},
		{Name: "velocityllm-frontend", Namespace: "velocityllm", Type: "LoadBalancer", ClusterIP: "10.96.10.2", ExternalIP: "34.120.55.101", Ports: []ServicePort{{Name: "http", Port: 80, TargetPort: 3000, Protocol: "TCP"}}, Selector: map[string]string{"app": "frontend"}, CreatedAt: now.Add(-30 * 24 * time.Hour)},
		{Name: "redis-cluster", Namespace: "velocityllm", Type: "ClusterIP", ClusterIP: "10.96.20.1", Ports: []ServicePort{{Name: "redis", Port: 6379, TargetPort: 6379, Protocol: "TCP"}}, Selector: map[string]string{"app": "redis"}, CreatedAt: now.Add(-30 * 24 * time.Hour)},
		{Name: "postgres-primary", Namespace: "velocityllm", Type: "ClusterIP", ClusterIP: "10.96.20.2", Ports: []ServicePort{{Name: "postgres", Port: 5432, TargetPort: 5432, Protocol: "TCP"}}, Selector: map[string]string{"app": "postgres"}, CreatedAt: now.Add(-30 * 24 * time.Hour)},
		{Name: "prometheus", Namespace: "monitoring", Type: "ClusterIP", ClusterIP: "10.96.30.1", Ports: []ServicePort{{Name: "http", Port: 9090, TargetPort: 9090, Protocol: "TCP"}}, Selector: map[string]string{"app": "prometheus"}, CreatedAt: now.Add(-30 * 24 * time.Hour)},
	}

	// HPAs
	m.hpas = []*HPA{
		{Name: "velocityllm-api-hpa", Namespace: "velocityllm", TargetRef: "velocityllm-api", MinReplicas: 2, MaxReplicas: 10, CurrentReplicas: 3, DesiredReplicas: 3, CPUTarget: 70, CPUCurrent: 42},
		{Name: "velocityllm-worker-hpa", Namespace: "velocityllm", TargetRef: "velocityllm-worker", MinReplicas: 2, MaxReplicas: 8, CurrentReplicas: 4, DesiredReplicas: 4, CPUTarget: 75, CPUCurrent: 55},
	}

	// Events
	m.events = []*K8sEvent{
		{Type: "Normal", Reason: "Scheduled", Message: "Successfully assigned velocityllm/velocityllm-api-abc12-xyz34 to node-prod-1", Object: "pod/velocityllm-api-abc12-xyz34", Count: 1, FirstSeen: now.Add(-2 * time.Hour), LastSeen: now.Add(-2 * time.Hour)},
		{Type: "Normal", Reason: "Pulled", Message: "Container image velocityllm/api:v1.2.0 already present on machine", Object: "pod/velocityllm-api-abc12-xyz34", Count: 1, FirstSeen: now.Add(-2 * time.Hour), LastSeen: now.Add(-2 * time.Hour)},
		{Type: "Normal", Reason: "ScalingReplicaSet", Message: "Scaled up replica set velocityllm-worker-5d8f to 4 from 3", Object: "deployment/velocityllm-worker", Count: 1, FirstSeen: now.Add(-6 * time.Hour), LastSeen: now.Add(-6 * time.Hour)},
		{Type: "Warning", Reason: "FailedScheduling", Message: "0/4 nodes are available: 2 Insufficient memory", Object: "pod/velocityllm-worker-pending", Count: 3, FirstSeen: now.Add(-12 * time.Hour), LastSeen: now.Add(-8 * time.Hour)},
		{Type: "Normal", Reason: "SuccessfulRescale", Message: "New size: 4; reason: cpu resource utilization above target", Object: "horizontalpodautoscaler/velocityllm-worker-hpa", Count: 1, FirstSeen: now.Add(-6 * time.Hour), LastSeen: now.Add(-6 * time.Hour)},
	}

	// Stats
	m.stats.TotalNodes = int64(len(m.nodes))
	m.stats.ReadyNodes = int64(len(m.nodes))
	m.stats.TotalPods = int64(len(m.pods))
	m.stats.RunningPods = int64(len(m.pods))
	m.stats.TotalDeployments = int64(len(m.deployments))
	m.stats.AvailableDeploys = int64(len(m.deployments))
	m.stats.TotalServices = int64(len(m.services))
	m.stats.TotalNamespaces = int64(len(m.namespaces))
}

func randStr(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

// ── Getters ─────────────────────────────────────────────

func (m *K8sManager) GetNamespaces() []*Namespace {
	m.mu.RLock(); defer m.mu.RUnlock()
	r := make([]*Namespace, len(m.namespaces)); copy(r, m.namespaces); return r
}

func (m *K8sManager) GetDeployments(ns string) []*Deployment {
	m.mu.RLock(); defer m.mu.RUnlock()
	var r []*Deployment
	for _, d := range m.deployments {
		if ns == "" || d.Namespace == ns { r = append(r, d) }
	}
	return r
}

func (m *K8sManager) GetPods(ns string) []*Pod {
	m.mu.RLock(); defer m.mu.RUnlock()
	var r []*Pod
	for _, p := range m.pods {
		if ns == "" || p.Namespace == ns { r = append(r, p) }
	}
	return r
}

func (m *K8sManager) GetServices(ns string) []*Service {
	m.mu.RLock(); defer m.mu.RUnlock()
	var r []*Service
	for _, s := range m.services {
		if ns == "" || s.Namespace == ns { r = append(r, s) }
	}
	return r
}

func (m *K8sManager) GetNodes() []*Node {
	m.mu.RLock(); defer m.mu.RUnlock()
	r := make([]*Node, len(m.nodes)); copy(r, m.nodes); return r
}

func (m *K8sManager) GetHPAs(ns string) []*HPA {
	m.mu.RLock(); defer m.mu.RUnlock()
	var r []*HPA
	for _, h := range m.hpas {
		if ns == "" || h.Namespace == ns { r = append(r, h) }
	}
	return r
}

func (m *K8sManager) GetEvents() []*K8sEvent {
	m.mu.RLock(); defer m.mu.RUnlock()
	r := make([]*K8sEvent, len(m.events)); copy(r, m.events); return r
}

// ── Operations ──────────────────────────────────────────

func (m *K8sManager) ScaleDeployment(name, ns string, replicas int) error {
	m.mu.Lock(); defer m.mu.Unlock()
	for _, d := range m.deployments {
		if d.Name == name && d.Namespace == ns {
			d.Replicas = replicas
			d.ReadyReplicas = replicas
			d.AvailableReplicas = replicas
			d.UpdatedReplicas = replicas
			d.UpdatedAt = time.Now()
			atomic.AddInt64(&m.stats.ScaleEvents, 1)
			log.Printf("[K8s] Scaled %s/%s to %d replicas", ns, name, replicas)
			return nil
		}
	}
	return fmt.Errorf("deployment %s/%s not found", ns, name)
}

func (m *K8sManager) RestartDeployment(name, ns string) error {
	m.mu.Lock(); defer m.mu.Unlock()
	for _, d := range m.deployments {
		if d.Name == name && d.Namespace == ns {
			d.UpdatedAt = time.Now()
			atomic.AddInt64(&m.stats.RolloutEvents, 1)
			m.events = append(m.events, &K8sEvent{
				Type: "Normal", Reason: "RolloutRestart",
				Message: fmt.Sprintf("Deployment %s/%s restarted", ns, name),
				Object: fmt.Sprintf("deployment/%s", name),
				Count: 1, FirstSeen: time.Now(), LastSeen: time.Now(),
			})
			log.Printf("[K8s] Restarted %s/%s", ns, name)
			return nil
		}
	}
	return fmt.Errorf("deployment %s/%s not found", ns, name)
}

// ── Stats ───────────────────────────────────────────────

func (m *K8sManager) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"cluster_version":     "v1.29.2",
		"total_nodes":         atomic.LoadInt64(&m.stats.TotalNodes),
		"ready_nodes":         atomic.LoadInt64(&m.stats.ReadyNodes),
		"total_pods":          atomic.LoadInt64(&m.stats.TotalPods),
		"running_pods":        atomic.LoadInt64(&m.stats.RunningPods),
		"total_deployments":   atomic.LoadInt64(&m.stats.TotalDeployments),
		"available_deploys":   atomic.LoadInt64(&m.stats.AvailableDeploys),
		"total_services":      atomic.LoadInt64(&m.stats.TotalServices),
		"total_namespaces":    atomic.LoadInt64(&m.stats.TotalNamespaces),
		"scale_events":        atomic.LoadInt64(&m.stats.ScaleEvents),
		"rollout_events":      atomic.LoadInt64(&m.stats.RolloutEvents),
	}
}

func (m *K8sManager) Stop() {
	close(m.stopCh)
	log.Printf("[K8s] Stopped")
}
