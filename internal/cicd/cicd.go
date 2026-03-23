package cicd

import (
	"fmt"
	"log"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

// PipelineStatus represents a pipeline run status.
type PipelineStatus string

const (
	StatusSuccess  PipelineStatus = "success"
	StatusFailed   PipelineStatus = "failed"
	StatusRunning  PipelineStatus = "running"
	StatusPending  PipelineStatus = "pending"
	StatusCancelled PipelineStatus = "cancelled"
)

// StageStatus represents a pipeline stage status.
type StageStatus string

const (
	StageSuccess  StageStatus = "success"
	StageFailed   StageStatus = "failed"
	StageRunning  StageStatus = "running"
	StagePending  StageStatus = "pending"
	StageSkipped  StageStatus = "skipped"
)

// Pipeline defines a CI/CD pipeline configuration.
type Pipeline struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Branch      string   `json:"branch"`
	Trigger     string   `json:"trigger"` // push, pr, schedule, manual
	Stages      []Stage  `json:"stages"`
	Environment string   `json:"environment"` // staging, production
	CreatedAt   time.Time `json:"created_at"`
}

// Stage represents a pipeline stage.
type Stage struct {
	Name      string      `json:"name"`
	Status    StageStatus `json:"status"`
	Duration  string      `json:"duration"`
	Steps     []Step      `json:"steps"`
	StartedAt *time.Time  `json:"started_at,omitempty"`
	EndedAt   *time.Time  `json:"ended_at,omitempty"`
}

// Step represents an individual step within a stage.
type Step struct {
	Name     string      `json:"name"`
	Status   StageStatus `json:"status"`
	Command  string      `json:"command"`
	Duration string      `json:"duration"`
	Output   string      `json:"output,omitempty"`
}

// PipelineRun represents a single execution of a pipeline.
type PipelineRun struct {
	ID          string         `json:"id"`
	PipelineID  string         `json:"pipeline_id"`
	PipelineName string        `json:"pipeline_name"`
	Status      PipelineStatus `json:"status"`
	Branch      string         `json:"branch"`
	Commit      string         `json:"commit"`
	CommitMsg   string         `json:"commit_message"`
	Author      string         `json:"author"`
	Trigger     string         `json:"trigger"`
	Stages      []Stage        `json:"stages"`
	Duration    string         `json:"duration"`
	Environment string         `json:"environment"`
	StartedAt   time.Time      `json:"started_at"`
	FinishedAt  *time.Time     `json:"finished_at,omitempty"`
}

// DeploymentRecord tracks a deployment to an environment.
type DeploymentRecord struct {
	ID          string    `json:"id"`
	PipelineRun string    `json:"pipeline_run"`
	Environment string    `json:"environment"`
	Version     string    `json:"version"`
	Status      string    `json:"status"` // deployed, rolled_back, failed
	DeployedBy  string    `json:"deployed_by"`
	DeployedAt  time.Time `json:"deployed_at"`
}

// CICDStats tracks CI/CD metrics.
type CICDStats struct {
	TotalPipelines  int64   `json:"total_pipelines"`
	TotalRuns       int64   `json:"total_runs"`
	SuccessRuns     int64   `json:"success_runs"`
	FailedRuns      int64   `json:"failed_runs"`
	AvgDurationSec  float64 `json:"avg_duration_sec"`
	Deployments     int64   `json:"deployments"`
	RollbackCount   int64   `json:"rollback_count"`
	SuccessRate     float64 `json:"success_rate"`
}

// CICDManager manages CI/CD pipelines.
type CICDManager struct {
	mu          sync.RWMutex
	pipelines   []*Pipeline
	runs        []*PipelineRun
	deployments []*DeploymentRecord
	stats       *CICDStats
	stopCh      chan struct{}
}

var (
	globalCICD     *CICDManager
	globalCICDLock sync.RWMutex
)

func InitGlobalCICD() *CICDManager {
	mgr := &CICDManager{
		stats:  &CICDStats{},
		stopCh: make(chan struct{}),
	}
	mgr.seedDemoData()

	globalCICDLock.Lock()
	globalCICD = mgr
	globalCICDLock.Unlock()

	log.Printf("[CICD] Initialized: pipelines=%d runs=%d", len(mgr.pipelines), len(mgr.runs))
	return mgr
}

func GetGlobalCICD() *CICDManager {
	globalCICDLock.RLock()
	defer globalCICDLock.RUnlock()
	return globalCICD
}

func (m *CICDManager) seedDemoData() {
	now := time.Now()

	// Pipeline definitions
	m.pipelines = []*Pipeline{
		{
			ID: "pipe-1", Name: "Backend CI/CD", Branch: "main", Trigger: "push", Environment: "production",
			Stages: []Stage{
				{Name: "Lint & Format", Steps: []Step{{Name: "golangci-lint", Command: "golangci-lint run ./..."}, {Name: "go fmt", Command: "gofmt -l ."}}},
				{Name: "Test", Steps: []Step{{Name: "Unit Tests", Command: "go test -race -cover ./..."}, {Name: "Integration Tests", Command: "go test -tags=integration ./..."}}},
				{Name: "Build", Steps: []Step{{Name: "Build Binary", Command: "go build -o bin/server cmd/server/main.go"}, {Name: "Build Docker", Command: "docker build -t velocityllm/api:latest ."}}},
				{Name: "Security Scan", Steps: []Step{{Name: "Trivy Scan", Command: "trivy image velocityllm/api:latest"}, {Name: "gosec", Command: "gosec ./..."}}},
				{Name: "Deploy", Steps: []Step{{Name: "Push Image", Command: "docker push velocityllm/api:$TAG"}, {Name: "kubectl apply", Command: "kubectl rollout restart deployment/velocityllm-api"}}},
			},
			CreatedAt: now.Add(-30 * 24 * time.Hour),
		},
		{
			ID: "pipe-2", Name: "Frontend CI/CD", Branch: "main", Trigger: "push", Environment: "production",
			Stages: []Stage{
				{Name: "Lint", Steps: []Step{{Name: "ESLint", Command: "npx eslint ."}, {Name: "TypeScript", Command: "npx tsc --noEmit"}}},
				{Name: "Test", Steps: []Step{{Name: "Jest", Command: "npx jest --coverage"}}},
				{Name: "Build", Steps: []Step{{Name: "Next.js Build", Command: "npx next build"}, {Name: "Build Docker", Command: "docker build -t velocityllm/frontend:latest ."}}},
				{Name: "Deploy", Steps: []Step{{Name: "Push Image", Command: "docker push velocityllm/frontend:$TAG"}, {Name: "kubectl apply", Command: "kubectl rollout restart deployment/velocityllm-frontend"}}},
			},
			CreatedAt: now.Add(-30 * 24 * time.Hour),
		},
		{
			ID: "pipe-3", Name: "Staging Deploy", Branch: "develop", Trigger: "push", Environment: "staging",
			Stages: []Stage{
				{Name: "Test", Steps: []Step{{Name: "Run Tests", Command: "make test"}}},
				{Name: "Build", Steps: []Step{{Name: "Build All", Command: "make build"}}},
				{Name: "Deploy Staging", Steps: []Step{{Name: "Deploy", Command: "kubectl apply -f k8s/staging/"}}},
			},
			CreatedAt: now.Add(-25 * 24 * time.Hour),
		},
		{
			ID: "pipe-4", Name: "Nightly Security Scan", Branch: "main", Trigger: "schedule", Environment: "production",
			Stages: []Stage{
				{Name: "Dependency Audit", Steps: []Step{{Name: "npm audit", Command: "npm audit --production"}, {Name: "go vuln", Command: "govulncheck ./..."}}},
				{Name: "Container Scan", Steps: []Step{{Name: "Trivy", Command: "trivy image --severity HIGH,CRITICAL velocityllm/api:latest"}}},
				{Name: "SAST", Steps: []Step{{Name: "Semgrep", Command: "semgrep --config=auto ."}}},
			},
			CreatedAt: now.Add(-20 * 24 * time.Hour),
		},
	}

	// Pipeline runs
	authors := []string{"Vignesh D.", "Sarah Chen", "Alex Kumar", "Maria Lopez"}
	commits := []string{"feat: add geo-routing", "fix: cache invalidation bug", "refactor: queue handler", "feat: CDN integration", "chore: update deps", "fix: auth token expiry", "feat: model hosting", "docs: update API docs"}
	commitHashes := []string{"a1b2c3d", "e4f5g6h", "i7j8k9l", "m0n1o2p", "q3r4s5t", "u6v7w8x", "y9z0a1b", "c2d3e4f"}

	for i := 0; i < 15; i++ {
		pipe := m.pipelines[rand.Intn(len(m.pipelines))]
		startTime := now.Add(-time.Duration(i*6+rand.Intn(6)) * time.Hour)
		durSec := rand.Intn(300) + 60
		endTime := startTime.Add(time.Duration(durSec) * time.Second)
		status := StatusSuccess
		if rand.Float64() < 0.15 {
			status = StatusFailed
		}

		stages := make([]Stage, len(pipe.Stages))
		for j, s := range pipe.Stages {
			stageStatus := StageSuccess
			if status == StatusFailed && j == len(pipe.Stages)-1 {
				stageStatus = StageFailed
			}
			stageDur := rand.Intn(60) + 5
			stageStart := startTime.Add(time.Duration(j*stageDur) * time.Second)
			stageEnd := stageStart.Add(time.Duration(stageDur) * time.Second)
			steps := make([]Step, len(s.Steps))
			for k, st := range s.Steps {
				steps[k] = Step{Name: st.Name, Status: StageStatus(stageStatus), Command: st.Command, Duration: fmt.Sprintf("%ds", rand.Intn(30)+2)}
			}
			stages[j] = Stage{Name: s.Name, Status: stageStatus, Duration: fmt.Sprintf("%ds", stageDur), Steps: steps, StartedAt: &stageStart, EndedAt: &stageEnd}
		}

		m.runs = append(m.runs, &PipelineRun{
			ID: fmt.Sprintf("run-%d", i+1), PipelineID: pipe.ID, PipelineName: pipe.Name,
			Status: status, Branch: pipe.Branch, Commit: commitHashes[i%len(commitHashes)],
			CommitMsg: commits[i%len(commits)], Author: authors[i%len(authors)],
			Trigger: pipe.Trigger, Stages: stages, Duration: fmt.Sprintf("%dm %ds", durSec/60, durSec%60),
			Environment: pipe.Environment, StartedAt: startTime, FinishedAt: &endTime,
		})
	}

	// Deployment records
	for i := 0; i < 8; i++ {
		deployTime := now.Add(-time.Duration(i*12+rand.Intn(12)) * time.Hour)
		status := "deployed"
		if rand.Float64() < 0.1 {
			status = "rolled_back"
		}
		m.deployments = append(m.deployments, &DeploymentRecord{
			ID: fmt.Sprintf("deploy-%d", i+1), PipelineRun: fmt.Sprintf("run-%d", i+1),
			Environment: []string{"production", "staging"}[rand.Intn(2)],
			Version: fmt.Sprintf("v1.%d.%d", rand.Intn(3), i), Status: status,
			DeployedBy: authors[i%len(authors)], DeployedAt: deployTime,
		})
	}

	// Stats
	var successCount int64
	for _, r := range m.runs {
		if r.Status == StatusSuccess {
			successCount++
		}
	}
	m.stats.TotalPipelines = int64(len(m.pipelines))
	m.stats.TotalRuns = int64(len(m.runs))
	m.stats.SuccessRuns = successCount
	m.stats.FailedRuns = int64(len(m.runs)) - successCount
	m.stats.Deployments = int64(len(m.deployments))
	m.stats.AvgDurationSec = 185.0
	if m.stats.TotalRuns > 0 {
		m.stats.SuccessRate = float64(m.stats.SuccessRuns) / float64(m.stats.TotalRuns) * 100
	}
}

// ── Getters ─────────────────────────────────────────────

func (m *CICDManager) GetPipelines() []*Pipeline {
	m.mu.RLock(); defer m.mu.RUnlock()
	r := make([]*Pipeline, len(m.pipelines)); copy(r, m.pipelines); return r
}

func (m *CICDManager) GetRuns(pipelineID string, limit int) []*PipelineRun {
	m.mu.RLock(); defer m.mu.RUnlock()
	var r []*PipelineRun
	for i := len(m.runs) - 1; i >= 0; i-- {
		run := m.runs[i]
		if pipelineID == "" || run.PipelineID == pipelineID {
			r = append(r, run)
			if limit > 0 && len(r) >= limit { break }
		}
	}
	return r
}

func (m *CICDManager) GetRun(id string) *PipelineRun {
	m.mu.RLock(); defer m.mu.RUnlock()
	for _, r := range m.runs {
		if r.ID == id { return r }
	}
	return nil
}

func (m *CICDManager) GetDeployments() []*DeploymentRecord {
	m.mu.RLock(); defer m.mu.RUnlock()
	r := make([]*DeploymentRecord, len(m.deployments)); copy(r, m.deployments); return r
}

// ── Operations ──────────────────────────────────────────

func (m *CICDManager) TriggerPipeline(pipelineID string) (*PipelineRun, error) {
	m.mu.Lock(); defer m.mu.Unlock()

	var pipe *Pipeline
	for _, p := range m.pipelines {
		if p.ID == pipelineID { pipe = p; break }
	}
	if pipe == nil {
		return nil, fmt.Errorf("pipeline not found: %s", pipelineID)
	}

	now := time.Now()
	stages := make([]Stage, len(pipe.Stages))
	for i, s := range pipe.Stages {
		steps := make([]Step, len(s.Steps))
		for j, st := range s.Steps {
			steps[j] = Step{Name: st.Name, Status: StageSuccess, Command: st.Command, Duration: fmt.Sprintf("%ds", rand.Intn(30)+5)}
		}
		stageStart := now.Add(time.Duration(i*15) * time.Second)
		stageEnd := stageStart.Add(15 * time.Second)
		stages[i] = Stage{Name: s.Name, Status: StageSuccess, Duration: "15s", Steps: steps, StartedAt: &stageStart, EndedAt: &stageEnd}
	}

	durSec := len(pipe.Stages) * 15
	endTime := now.Add(time.Duration(durSec) * time.Second)
	run := &PipelineRun{
		ID: fmt.Sprintf("run-%d", time.Now().UnixMilli()), PipelineID: pipe.ID, PipelineName: pipe.Name,
		Status: StatusSuccess, Branch: pipe.Branch, Commit: randHash(),
		CommitMsg: "manual trigger", Author: "Vignesh D.", Trigger: "manual",
		Stages: stages, Duration: fmt.Sprintf("%dm %ds", durSec/60, durSec%60),
		Environment: pipe.Environment, StartedAt: now, FinishedAt: &endTime,
	}

	m.runs = append(m.runs, run)
	atomic.AddInt64(&m.stats.TotalRuns, 1)
	atomic.AddInt64(&m.stats.SuccessRuns, 1)

	log.Printf("[CICD] Pipeline triggered: %s (%s)", pipe.Name, run.ID)
	return run, nil
}

func randHash() string {
	const hex = "0123456789abcdef"
	b := make([]byte, 7)
	for i := range b { b[i] = hex[rand.Intn(len(hex))] }
	return string(b)
}

// ── Stats ───────────────────────────────────────────────

func (m *CICDManager) GetStats() map[string]interface{} {
	return map[string]interface{}{
		"total_pipelines":  atomic.LoadInt64(&m.stats.TotalPipelines),
		"total_runs":       atomic.LoadInt64(&m.stats.TotalRuns),
		"success_runs":     atomic.LoadInt64(&m.stats.SuccessRuns),
		"failed_runs":      atomic.LoadInt64(&m.stats.FailedRuns),
		"success_rate":     fmt.Sprintf("%.1f%%", m.stats.SuccessRate),
		"success_rate_num": m.stats.SuccessRate,
		"avg_duration":     fmt.Sprintf("%.0fs", m.stats.AvgDurationSec),
		"deployments":      atomic.LoadInt64(&m.stats.Deployments),
		"rollback_count":   atomic.LoadInt64(&m.stats.RollbackCount),
	}
}

func (m *CICDManager) Stop() {
	close(m.stopCh)
	log.Printf("[CICD] Stopped")
}
