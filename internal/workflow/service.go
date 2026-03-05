package workflow

import (
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ── Types ────────────────────────────────────────────────────────────────────

type NodePosition struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type WorkflowNode struct {
	ID       string            `json:"id"`
	Type     string            `json:"type"` // input, prompt, llm_call, condition, transform, output
	Label    string            `json:"label"`
	Position NodePosition      `json:"position"`
	Config   map[string]string `json:"config"`
}

type WorkflowEdge struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
}

type Workflow struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Description string         `json:"description"`
	Status      string         `json:"status"` // draft, active, archived
	Nodes       []WorkflowNode `json:"nodes"`
	Edges       []WorkflowEdge `json:"edges"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

type WorkflowRun struct {
	ID         string                 `json:"id"`
	WorkflowID string                `json:"workflow_id"`
	Status     string                 `json:"status"` // pending, running, completed, failed
	StartedAt  time.Time              `json:"started_at"`
	FinishedAt *time.Time             `json:"finished_at,omitempty"`
	DurationMs int64                  `json:"duration_ms"`
	Results    map[string]interface{} `json:"results"`
	Error      string                 `json:"error,omitempty"`
}

// ── Service ──────────────────────────────────────────────────────────────────

type Service struct {
	mu        sync.RWMutex
	workflows map[string]*Workflow
	runs      map[string]*WorkflowRun
}

var (
	instance *Service
	once     sync.Once
)

func GetService() *Service {
	once.Do(func() {
		instance = &Service{
			workflows: make(map[string]*Workflow),
			runs:      make(map[string]*WorkflowRun),
		}
		instance.seedData()
	})
	return instance
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

func (s *Service) CreateWorkflow(name, description string, nodes []WorkflowNode, edges []WorkflowEdge) *Workflow {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	w := &Workflow{
		ID:          uuid.New().String(),
		Name:        name,
		Description: description,
		Status:      "draft",
		Nodes:       nodes,
		Edges:       edges,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	s.workflows[w.ID] = w
	return w
}

func (s *Service) ListWorkflows() []*Workflow {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*Workflow, 0, len(s.workflows))
	for _, w := range s.workflows {
		result = append(result, w)
	}
	return result
}

func (s *Service) GetWorkflow(id string) *Workflow {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.workflows[id]
}

func (s *Service) UpdateWorkflow(id, name, description, status string, nodes []WorkflowNode, edges []WorkflowEdge) (*Workflow, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	w, ok := s.workflows[id]
	if !ok {
		return nil, fmt.Errorf("workflow %s not found", id)
	}
	if name != "" {
		w.Name = name
	}
	if description != "" {
		w.Description = description
	}
	if status != "" {
		w.Status = status
	}
	if nodes != nil {
		w.Nodes = nodes
	}
	if edges != nil {
		w.Edges = edges
	}
	w.UpdatedAt = time.Now()
	return w, nil
}

func (s *Service) DeleteWorkflow(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.workflows[id]; !ok {
		return fmt.Errorf("workflow %s not found", id)
	}
	delete(s.workflows, id)
	return nil
}

// ── Execution ────────────────────────────────────────────────────────────────

func (s *Service) ExecuteWorkflow(workflowID string) (*WorkflowRun, error) {
	s.mu.RLock()
	w, ok := s.workflows[workflowID]
	s.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("workflow %s not found", workflowID)
	}
	if w.Status == "archived" {
		return nil, fmt.Errorf("cannot execute archived workflow")
	}

	run := &WorkflowRun{
		ID:         uuid.New().String(),
		WorkflowID: workflowID,
		Status:     "pending",
		StartedAt:  time.Now(),
		Results:    make(map[string]interface{}),
	}

	s.mu.Lock()
	s.runs[run.ID] = run
	s.mu.Unlock()

	go s.simulateExecution(run.ID)

	return run, nil
}

func (s *Service) simulateExecution(runID string) {
	s.mu.Lock()
	run, ok := s.runs[runID]
	if !ok {
		s.mu.Unlock()
		return
	}
	run.Status = "running"
	s.mu.Unlock()

	// Simulate 2-4s execution
	delay := 2000 + rand.Intn(2000)
	time.Sleep(time.Duration(delay) * time.Millisecond)

	s.mu.Lock()
	defer s.mu.Unlock()

	run, ok = s.runs[runID]
	if !ok {
		return
	}

	now := time.Now()
	run.FinishedAt = &now
	run.DurationMs = int64(delay)

	// 90% success rate
	if rand.Intn(10) < 9 {
		run.Status = "completed"
		run.Results = map[string]interface{}{
			"nodes_executed": 3 + rand.Intn(5),
			"tokens_used":    150 + rand.Intn(500),
			"output":         "Workflow completed successfully. Generated response with high confidence.",
		}
	} else {
		run.Status = "failed"
		run.Error = "Timeout exceeded at LLM call node"
	}
}

func (s *Service) ListRuns() []*WorkflowRun {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*WorkflowRun, 0, len(s.runs))
	for _, r := range s.runs {
		result = append(result, r)
	}
	return result
}

// ── Stats ────────────────────────────────────────────────────────────────────

func (s *Service) GetStats() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	total := len(s.workflows)
	draft, active, archived := 0, 0, 0
	totalNodes := 0
	for _, w := range s.workflows {
		totalNodes += len(w.Nodes)
		switch w.Status {
		case "draft":
			draft++
		case "active":
			active++
		case "archived":
			archived++
		}
	}

	totalRuns := len(s.runs)
	completed, failed, running := 0, 0, 0
	for _, r := range s.runs {
		switch r.Status {
		case "completed":
			completed++
		case "failed":
			failed++
		case "running", "pending":
			running++
		}
	}

	successRate := 0.0
	if completed+failed > 0 {
		successRate = float64(completed) / float64(completed+failed) * 100
	}

	return map[string]interface{}{
		"total_workflows": total,
		"workflows_draft": draft,
		"workflows_active": active,
		"workflows_archived": archived,
		"total_nodes":     totalNodes,
		"total_runs":      totalRuns,
		"runs_completed":  completed,
		"runs_failed":     failed,
		"runs_running":    running,
		"success_rate":    successRate,
	}
}

// ── Seed Data ────────────────────────────────────────────────────────────────

func (s *Service) seedData() {
	// Workflow 1: Simple summarization pipeline
	w1 := &Workflow{
		ID:          uuid.New().String(),
		Name:        "Text Summarization Pipeline",
		Description: "Takes input text, summarizes it using an LLM, then formats the output.",
		Status:      "active",
		Nodes: []WorkflowNode{
			{ID: "n1", Type: "input", Label: "Text Input", Position: NodePosition{X: 50, Y: 200}, Config: map[string]string{"source": "user"}},
			{ID: "n2", Type: "prompt", Label: "Summarize Prompt", Position: NodePosition{X: 300, Y: 200}, Config: map[string]string{"template": "Summarize: {{input}}"}},
			{ID: "n3", Type: "llm_call", Label: "GPT-4o Call", Position: NodePosition{X: 550, Y: 200}, Config: map[string]string{"model": "gpt-4o", "temperature": "0.3"}},
			{ID: "n4", Type: "output", Label: "Summary Output", Position: NodePosition{X: 800, Y: 200}, Config: map[string]string{"format": "markdown"}},
		},
		Edges: []WorkflowEdge{
			{ID: "e1", Source: "n1", Target: "n2"},
			{ID: "e2", Source: "n2", Target: "n3"},
			{ID: "e3", Source: "n3", Target: "n4"},
		},
		CreatedAt: time.Now().Add(-48 * time.Hour),
		UpdatedAt: time.Now().Add(-24 * time.Hour),
	}
	s.workflows[w1.ID] = w1

	// Workflow 2: Content moderation with branching
	w2 := &Workflow{
		ID:          uuid.New().String(),
		Name:        "Content Moderation Flow",
		Description: "Classifies content, routes safe content to processing and flags unsafe content.",
		Status:      "active",
		Nodes: []WorkflowNode{
			{ID: "n1", Type: "input", Label: "User Content", Position: NodePosition{X: 50, Y: 250}, Config: map[string]string{"source": "api"}},
			{ID: "n2", Type: "llm_call", Label: "Classify Content", Position: NodePosition{X: 300, Y: 250}, Config: map[string]string{"model": "claude-sonnet", "temperature": "0"}},
			{ID: "n3", Type: "condition", Label: "Is Safe?", Position: NodePosition{X: 550, Y: 250}, Config: map[string]string{"condition": "classification == safe"}},
			{ID: "n4", Type: "transform", Label: "Process Content", Position: NodePosition{X: 800, Y: 150}, Config: map[string]string{"action": "enrich"}},
			{ID: "n5", Type: "output", Label: "Flag for Review", Position: NodePosition{X: 800, Y: 350}, Config: map[string]string{"action": "flag"}},
		},
		Edges: []WorkflowEdge{
			{ID: "e1", Source: "n1", Target: "n2"},
			{ID: "e2", Source: "n2", Target: "n3"},
			{ID: "e3", Source: "n3", Target: "n4"},
			{ID: "e4", Source: "n3", Target: "n5"},
		},
		CreatedAt: time.Now().Add(-72 * time.Hour),
		UpdatedAt: time.Now().Add(-12 * time.Hour),
	}
	s.workflows[w2.ID] = w2

	// Workflow 3: RAG-enhanced Q&A
	w3 := &Workflow{
		ID:          uuid.New().String(),
		Name:        "RAG Q&A Pipeline",
		Description: "Retrieves relevant documents, builds context, then generates an answer.",
		Status:      "draft",
		Nodes: []WorkflowNode{
			{ID: "n1", Type: "input", Label: "User Question", Position: NodePosition{X: 50, Y: 200}, Config: map[string]string{"source": "chat"}},
			{ID: "n2", Type: "transform", Label: "Embed Query", Position: NodePosition{X: 300, Y: 200}, Config: map[string]string{"action": "embed"}},
			{ID: "n3", Type: "transform", Label: "Vector Search", Position: NodePosition{X: 550, Y: 200}, Config: map[string]string{"action": "search", "top_k": "5"}},
			{ID: "n4", Type: "prompt", Label: "Build Context", Position: NodePosition{X: 300, Y: 400}, Config: map[string]string{"template": "Context: {{docs}}\nQuestion: {{query}}"}},
			{ID: "n5", Type: "llm_call", Label: "Generate Answer", Position: NodePosition{X: 550, Y: 400}, Config: map[string]string{"model": "gpt-4o", "temperature": "0.5"}},
			{ID: "n6", Type: "output", Label: "Answer", Position: NodePosition{X: 800, Y: 400}, Config: map[string]string{"format": "text"}},
		},
		Edges: []WorkflowEdge{
			{ID: "e1", Source: "n1", Target: "n2"},
			{ID: "e2", Source: "n2", Target: "n3"},
			{ID: "e3", Source: "n3", Target: "n4"},
			{ID: "e4", Source: "n1", Target: "n4"},
			{ID: "e5", Source: "n4", Target: "n5"},
			{ID: "e6", Source: "n5", Target: "n6"},
		},
		CreatedAt: time.Now().Add(-24 * time.Hour),
		UpdatedAt: time.Now().Add(-6 * time.Hour),
	}
	s.workflows[w3.ID] = w3

	// Seed some runs
	for i := 0; i < 8; i++ {
		wID := w1.ID
		if i%3 == 1 {
			wID = w2.ID
		} else if i%3 == 2 {
			wID = w3.ID
		}

		dur := int64(1500 + rand.Intn(3000))
		started := time.Now().Add(-time.Duration(i*30) * time.Minute)
		finished := started.Add(time.Duration(dur) * time.Millisecond)

		status := "completed"
		errMsg := ""
		results := map[string]interface{}{
			"nodes_executed": 3 + rand.Intn(4),
			"tokens_used":    100 + rand.Intn(600),
			"output":         "Generated output successfully.",
		}
		if i == 3 {
			status = "failed"
			errMsg = "LLM call timeout after 30s"
			results = nil
		}

		run := &WorkflowRun{
			ID:         uuid.New().String(),
			WorkflowID: wID,
			Status:     status,
			StartedAt:  started,
			FinishedAt: &finished,
			DurationMs: dur,
			Results:    results,
			Error:      errMsg,
		}
		s.runs[run.ID] = run
	}
}
