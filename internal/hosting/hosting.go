package hosting

import (
	"fmt"
	"log"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

// ModelStatus represents the deployment status of a custom model.
type ModelStatus string

const (
	StatusDeploying ModelStatus = "deploying"
	StatusRunning   ModelStatus = "running"
	StatusStopped   ModelStatus = "stopped"
	StatusFailed    ModelStatus = "failed"
	StatusScaling   ModelStatus = "scaling"
)

// GPUType represents available GPU types.
type GPUType string

const (
	GPUA100  GPUType = "A100-80GB"
	GPUA10G  GPUType = "A10G-24GB"
	GPUT4    GPUType = "T4-16GB"
	GPUL4    GPUType = "L4-24GB"
	GPUH100  GPUType = "H100-80GB"
	GPUNone  GPUType = "CPU-only"
)

// HostedModel represents a custom model deployment.
type HostedModel struct {
	ID              string      `json:"id"`
	Name            string      `json:"name"`
	Framework       string      `json:"framework"` // pytorch, tensorflow, onnx, triton
	ModelSource     string      `json:"model_source"` // huggingface, s3, local
	ModelPath       string      `json:"model_path"` // e.g., meta-llama/Llama-3-8B
	Status          ModelStatus `json:"status"`
	GPU             GPUType     `json:"gpu"`
	Replicas        int         `json:"replicas"`
	MinReplicas     int         `json:"min_replicas"`
	MaxReplicas     int         `json:"max_replicas"`
	CPULimit        string      `json:"cpu_limit"`
	MemoryLimit     string      `json:"memory_limit"`
	Port            int         `json:"port"`
	Endpoint        string      `json:"endpoint"`
	HealthEndpoint  string      `json:"health_endpoint"`
	Quantization    string      `json:"quantization"` // none, int8, int4, gptq, awq
	MaxBatchSize    int         `json:"max_batch_size"`
	MaxSequenceLen  int         `json:"max_sequence_len"`
	CostPerHour     float64     `json:"cost_per_hour"`
	Metrics         ModelMetrics `json:"metrics"`
	CreatedAt       time.Time   `json:"created_at"`
	LastDeployedAt  time.Time   `json:"last_deployed_at"`
	Owner           string      `json:"owner"`
}

// ModelMetrics tracks runtime metrics for a hosted model.
type ModelMetrics struct {
	TotalRequests    int64   `json:"total_requests"`
	AvgLatencyMs     float64 `json:"avg_latency_ms"`
	P99LatencyMs     float64 `json:"p99_latency_ms"`
	TokensPerSecond  float64 `json:"tokens_per_second"`
	GPUUtilization   float64 `json:"gpu_utilization"` // 0-100
	MemoryUsedGB     float64 `json:"memory_used_gb"`
	MemoryTotalGB    float64 `json:"memory_total_gb"`
	Uptime           string  `json:"uptime"`
	ErrorRate        float64 `json:"error_rate"`
}

// DeployRequest represents a request to deploy a custom model.
type DeployRequest struct {
	Name           string  `json:"name"`
	Framework      string  `json:"framework"`
	ModelSource    string  `json:"model_source"`
	ModelPath      string  `json:"model_path"`
	GPU            GPUType `json:"gpu"`
	Replicas       int     `json:"replicas"`
	Quantization   string  `json:"quantization"`
	MaxBatchSize   int     `json:"max_batch_size"`
	MaxSequenceLen int     `json:"max_sequence_len"`
}

// HostingStats tracks platform-wide hosting metrics.
type HostingStats struct {
	TotalModels     int64   `json:"total_models"`
	RunningModels   int64   `json:"running_models"`
	TotalGPUs       int64   `json:"total_gpus"`
	TotalRequests   int64   `json:"total_requests"`
	AvgGPUUtil      float64 `json:"avg_gpu_utilization"`
	TotalCostPerHour float64 `json:"total_cost_per_hour"`
}

// HostingManager manages custom model deployments.
type HostingManager struct {
	mu     sync.RWMutex
	models map[string]*HostedModel
	stats  *HostingStats
	stopCh chan struct{}
}

// Global instance
var (
	globalHosting     *HostingManager
	globalHostingLock sync.RWMutex
)

// InitGlobalHosting initializes the hosting manager.
func InitGlobalHosting() *HostingManager {
	mgr := &HostingManager{
		models: make(map[string]*HostedModel),
		stats:  &HostingStats{},
		stopCh: make(chan struct{}),
	}

	mgr.seedDemoData()

	globalHostingLock.Lock()
	globalHosting = mgr
	globalHostingLock.Unlock()

	log.Printf("[Hosting] Initialized: models=%d", len(mgr.models))
	return mgr
}

// GetGlobalHosting returns the global hosting manager.
func GetGlobalHosting() *HostingManager {
	globalHostingLock.RLock()
	defer globalHostingLock.RUnlock()
	return globalHosting
}

func (m *HostingManager) seedDemoData() {
	now := time.Now()

	models := []HostedModel{
		{
			ID: "mdl-1", Name: "llama-3-8b", Framework: "pytorch", ModelSource: "huggingface",
			ModelPath: "meta-llama/Llama-3-8B-Instruct", Status: StatusRunning, GPU: GPUA10G,
			Replicas: 2, MinReplicas: 1, MaxReplicas: 4, CPULimit: "8", MemoryLimit: "32Gi",
			Port: 8081, Endpoint: "http://models.velocityllm.com:8081/v1", HealthEndpoint: "/health",
			Quantization: "none", MaxBatchSize: 32, MaxSequenceLen: 8192, CostPerHour: 1.50,
			Metrics: ModelMetrics{
				TotalRequests: int64(rand.Intn(10000) + 5000), AvgLatencyMs: 85.4, P99LatencyMs: 245.2,
				TokensPerSecond: 156.3, GPUUtilization: 72.5, MemoryUsedGB: 18.2, MemoryTotalGB: 24.0,
				Uptime: "5d 12h 34m", ErrorRate: 0.12,
			},
			CreatedAt: now.Add(-7 * 24 * time.Hour), LastDeployedAt: now.Add(-5 * 24 * time.Hour), Owner: "u-1",
		},
		{
			ID: "mdl-2", Name: "mistral-7b-finetuned", Framework: "pytorch", ModelSource: "s3",
			ModelPath: "s3://velocityllm-models/mistral-7b-ft-v2", Status: StatusRunning, GPU: GPUT4,
			Replicas: 1, MinReplicas: 1, MaxReplicas: 3, CPULimit: "4", MemoryLimit: "16Gi",
			Port: 8082, Endpoint: "http://models.velocityllm.com:8082/v1", HealthEndpoint: "/health",
			Quantization: "int8", MaxBatchSize: 16, MaxSequenceLen: 4096, CostPerHour: 0.75,
			Metrics: ModelMetrics{
				TotalRequests: int64(rand.Intn(5000) + 2000), AvgLatencyMs: 62.1, P99LatencyMs: 180.5,
				TokensPerSecond: 210.7, GPUUtilization: 58.3, MemoryUsedGB: 8.5, MemoryTotalGB: 16.0,
				Uptime: "3d 8h 15m", ErrorRate: 0.08,
			},
			CreatedAt: now.Add(-5 * 24 * time.Hour), LastDeployedAt: now.Add(-3 * 24 * time.Hour), Owner: "u-1",
		},
		{
			ID: "mdl-3", Name: "codegen-2b", Framework: "onnx", ModelSource: "huggingface",
			ModelPath: "Salesforce/codegen2-3_7B", Status: StatusStopped, GPU: GPUT4,
			Replicas: 0, MinReplicas: 0, MaxReplicas: 2, CPULimit: "4", MemoryLimit: "16Gi",
			Port: 8083, Endpoint: "http://models.velocityllm.com:8083/v1", HealthEndpoint: "/health",
			Quantization: "int4", MaxBatchSize: 8, MaxSequenceLen: 2048, CostPerHour: 0.50,
			Metrics: ModelMetrics{
				TotalRequests: int64(rand.Intn(1000) + 200), AvgLatencyMs: 45.0, P99LatencyMs: 120.0,
				TokensPerSecond: 0, GPUUtilization: 0, MemoryUsedGB: 0, MemoryTotalGB: 16.0,
				Uptime: "0", ErrorRate: 0,
			},
			CreatedAt: now.Add(-10 * 24 * time.Hour), LastDeployedAt: now.Add(-8 * 24 * time.Hour), Owner: "u-2",
		},
		{
			ID: "mdl-4", Name: "embedding-large", Framework: "triton", ModelSource: "huggingface",
			ModelPath: "BAAI/bge-large-en-v1.5", Status: StatusRunning, GPU: GPUL4,
			Replicas: 3, MinReplicas: 2, MaxReplicas: 6, CPULimit: "4", MemoryLimit: "8Gi",
			Port: 8084, Endpoint: "http://models.velocityllm.com:8084/v1", HealthEndpoint: "/health",
			Quantization: "none", MaxBatchSize: 64, MaxSequenceLen: 512, CostPerHour: 0.90,
			Metrics: ModelMetrics{
				TotalRequests: int64(rand.Intn(20000) + 10000), AvgLatencyMs: 12.3, P99LatencyMs: 35.8,
				TokensPerSecond: 890.2, GPUUtilization: 45.1, MemoryUsedGB: 4.2, MemoryTotalGB: 24.0,
				Uptime: "12d 3h 45m", ErrorRate: 0.02,
			},
			CreatedAt: now.Add(-14 * 24 * time.Hour), LastDeployedAt: now.Add(-12 * 24 * time.Hour), Owner: "u-1",
		},
	}

	var runningCount int64
	var totalGPUs int64
	var totalCost float64
	var gpuUtilSum float64
	var gpuUtilCount int

	for i := range models {
		m.models[models[i].ID] = &models[i]
		if models[i].Status == StatusRunning {
			runningCount++
			totalGPUs += int64(models[i].Replicas)
			totalCost += models[i].CostPerHour * float64(models[i].Replicas)
			gpuUtilSum += models[i].Metrics.GPUUtilization
			gpuUtilCount++
		}
	}

	m.stats.TotalModels = int64(len(models))
	m.stats.RunningModels = runningCount
	m.stats.TotalGPUs = totalGPUs
	m.stats.TotalRequests = int64(rand.Intn(30000) + 15000)
	m.stats.TotalCostPerHour = totalCost
	if gpuUtilCount > 0 {
		m.stats.AvgGPUUtil = gpuUtilSum / float64(gpuUtilCount)
	}
}

// ── Model Operations ────────────────────────────────────

// GetModels returns all hosted models.
func (m *HostingManager) GetModels() []*HostedModel {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make([]*HostedModel, 0, len(m.models))
	for _, model := range m.models {
		result = append(result, model)
	}
	return result
}

// GetModel returns a model by ID.
func (m *HostingManager) GetModel(id string) *HostedModel {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.models[id]
}

// DeployModel deploys a new custom model.
func (m *HostingManager) DeployModel(req DeployRequest) *HostedModel {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	id := fmt.Sprintf("mdl-%d", now.UnixMilli())

	replicas := req.Replicas
	if replicas == 0 {
		replicas = 1
	}
	costMap := map[GPUType]float64{
		GPUA100: 3.50, GPUA10G: 1.50, GPUT4: 0.75, GPUL4: 0.90, GPUH100: 5.00, GPUNone: 0.10,
	}
	cost := costMap[req.GPU]
	if cost == 0 {
		cost = 1.00
	}

	model := &HostedModel{
		ID: id, Name: req.Name, Framework: req.Framework, ModelSource: req.ModelSource,
		ModelPath: req.ModelPath, Status: StatusDeploying, GPU: req.GPU,
		Replicas: replicas, MinReplicas: 1, MaxReplicas: replicas * 2,
		CPULimit: "4", MemoryLimit: "16Gi", Port: 8080 + len(m.models) + 1,
		Endpoint:       fmt.Sprintf("http://models.velocityllm.com:%d/v1", 8080+len(m.models)+1),
		HealthEndpoint: "/health",
		Quantization:   req.Quantization, MaxBatchSize: req.MaxBatchSize, MaxSequenceLen: req.MaxSequenceLen,
		CostPerHour: cost, CreatedAt: now, LastDeployedAt: now, Owner: "u-1",
		Metrics: ModelMetrics{MemoryTotalGB: 16.0},
	}

	// Simulate deployment completing quickly
	model.Status = StatusRunning
	model.Metrics.GPUUtilization = float64(rand.Intn(30) + 10)
	model.Metrics.Uptime = "0h 0m"

	m.models[id] = model
	atomic.AddInt64(&m.stats.TotalModels, 1)
	atomic.AddInt64(&m.stats.RunningModels, 1)
	atomic.AddInt64(&m.stats.TotalGPUs, int64(replicas))

	log.Printf("[Hosting] Model deployed: %s (%s) on %s x%d", req.Name, req.ModelPath, req.GPU, replicas)
	return model
}

// ScaleModel adjusts the replica count.
func (m *HostingManager) ScaleModel(id string, replicas int) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	model, ok := m.models[id]
	if !ok {
		return fmt.Errorf("model not found: %s", id)
	}
	if replicas < 0 || replicas > model.MaxReplicas {
		return fmt.Errorf("replicas must be 0-%d", model.MaxReplicas)
	}

	oldReplicas := model.Replicas
	model.Replicas = replicas
	if replicas == 0 {
		model.Status = StatusStopped
		atomic.AddInt64(&m.stats.RunningModels, -1)
	} else if model.Status == StatusStopped {
		model.Status = StatusRunning
		atomic.AddInt64(&m.stats.RunningModels, 1)
	}
	atomic.AddInt64(&m.stats.TotalGPUs, int64(replicas-oldReplicas))

	log.Printf("[Hosting] Model scaled: %s %d→%d replicas", model.Name, oldReplicas, replicas)
	return nil
}

// StopModel stops a deployed model.
func (m *HostingManager) StopModel(id string) error {
	return m.ScaleModel(id, 0)
}

// StartModel starts a stopped model.
func (m *HostingManager) StartModel(id string) error {
	m.mu.RLock()
	model, ok := m.models[id]
	m.mu.RUnlock()
	if !ok {
		return fmt.Errorf("model not found: %s", id)
	}
	replicas := model.MinReplicas
	if replicas == 0 {
		replicas = 1
	}
	return m.ScaleModel(id, replicas)
}

// DeleteModel removes a model deployment.
func (m *HostingManager) DeleteModel(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	model, ok := m.models[id]
	if !ok {
		return fmt.Errorf("model not found: %s", id)
	}
	if model.Status == StatusRunning {
		atomic.AddInt64(&m.stats.RunningModels, -1)
		atomic.AddInt64(&m.stats.TotalGPUs, -int64(model.Replicas))
	}
	delete(m.models, id)
	atomic.AddInt64(&m.stats.TotalModels, -1)
	log.Printf("[Hosting] Model deleted: %s", model.Name)
	return nil
}

// ── Statistics ──────────────────────────────────────────

// GetStats returns hosting statistics.
func (m *HostingManager) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"total_models":       atomic.LoadInt64(&m.stats.TotalModels),
		"running_models":     atomic.LoadInt64(&m.stats.RunningModels),
		"total_gpus":         atomic.LoadInt64(&m.stats.TotalGPUs),
		"total_requests":     atomic.LoadInt64(&m.stats.TotalRequests),
		"avg_gpu_utilization": m.stats.AvgGPUUtil,
		"total_cost_per_hour": m.stats.TotalCostPerHour,
	}
}

// Stop gracefully shuts down.
func (m *HostingManager) Stop() {
	close(m.stopCh)
	log.Printf("[Hosting] Stopped")
}
