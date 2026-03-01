package finetuning

import (
	"fmt"
	"math"
	"math/rand"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ── Types ────────────────────────────────────────────────────────────────────

type Example struct {
	Input  string `json:"input"`
	Output string `json:"output"`
}

type Dataset struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Format      string    `json:"format"` // jsonl, csv
	Examples    []Example `json:"examples"`
	Size        int       `json:"size"`
	CreatedAt   time.Time `json:"created_at"`
}

type JobConfig struct {
	Epochs       int     `json:"epochs"`
	LearningRate float64 `json:"learning_rate"`
	BatchSize    int     `json:"batch_size"`
}

type JobMetrics struct {
	TrainLoss float64 `json:"train_loss"`
	EvalLoss  float64 `json:"eval_loss"`
}

type FineTuningJob struct {
	ID            string      `json:"id"`
	DatasetID     string      `json:"dataset_id"`
	BaseModel     string      `json:"base_model"`
	Status        string      `json:"status"` // pending, training, completed, failed, cancelled
	Config        JobConfig   `json:"config"`
	Progress      int         `json:"progress"` // 0-100
	CreatedAt     time.Time   `json:"created_at"`
	StartedAt     *time.Time  `json:"started_at,omitempty"`
	CompletedAt   *time.Time  `json:"completed_at,omitempty"`
	ResultModelID string      `json:"result_model_id,omitempty"`
	Metrics       *JobMetrics `json:"metrics,omitempty"`
}

type FineTunedModel struct {
	ID        string    `json:"id"`
	JobID     string    `json:"job_id"`
	BaseModel string    `json:"base_model"`
	Name      string    `json:"name"`
	Status    string    `json:"status"` // ready, deploying
	CreatedAt time.Time `json:"created_at"`
}

// ── Service ──────────────────────────────────────────────────────────────────

type Service struct {
	mu       sync.RWMutex
	datasets map[string]*Dataset
	jobs     map[string]*FineTuningJob
	models   map[string]*FineTunedModel
}

var (
	instance *Service
	once     sync.Once
)

func GetService() *Service {
	once.Do(func() {
		instance = &Service{
			datasets: make(map[string]*Dataset),
			jobs:     make(map[string]*FineTuningJob),
			models:   make(map[string]*FineTunedModel),
		}
	})
	return instance
}

// ── Datasets ─────────────────────────────────────────────────────────────────

func (s *Service) CreateDataset(name, description, format string, examples []Example) *Dataset {
	s.mu.Lock()
	defer s.mu.Unlock()

	ds := &Dataset{
		ID:          uuid.New().String(),
		Name:        name,
		Description: description,
		Format:      format,
		Examples:    examples,
		Size:        len(examples),
		CreatedAt:   time.Now(),
	}
	s.datasets[ds.ID] = ds
	return ds
}

func (s *Service) ListDatasets() []*Dataset {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*Dataset, 0, len(s.datasets))
	for _, ds := range s.datasets {
		result = append(result, ds)
	}
	return result
}

func (s *Service) GetDataset(id string) *Dataset {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.datasets[id]
}

func (s *Service) DeleteDataset(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.datasets[id]; !ok {
		return false
	}
	delete(s.datasets, id)
	return true
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

func (s *Service) CreateJob(datasetID, baseModel string, config JobConfig) (*FineTuningJob, error) {
	s.mu.Lock()
	if _, ok := s.datasets[datasetID]; !ok {
		s.mu.Unlock()
		return nil, fmt.Errorf("dataset %s not found", datasetID)
	}

	job := &FineTuningJob{
		ID:        uuid.New().String(),
		DatasetID: datasetID,
		BaseModel: baseModel,
		Status:    "pending",
		Config:    config,
		Progress:  0,
		CreatedAt: time.Now(),
	}
	s.jobs[job.ID] = job
	s.mu.Unlock()

	// Simulate training in background
	go s.simulateTraining(job.ID)

	return job, nil
}

func (s *Service) ListJobs() []*FineTuningJob {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*FineTuningJob, 0, len(s.jobs))
	for _, j := range s.jobs {
		result = append(result, j)
	}
	return result
}

func (s *Service) GetJob(id string) *FineTuningJob {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.jobs[id]
}

func (s *Service) CancelJob(id string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	job, ok := s.jobs[id]
	if !ok {
		return false
	}
	if job.Status == "completed" || job.Status == "failed" || job.Status == "cancelled" {
		return false
	}
	job.Status = "cancelled"
	now := time.Now()
	job.CompletedAt = &now
	return true
}

// ── Models ───────────────────────────────────────────────────────────────────

func (s *Service) ListModels() []*FineTunedModel {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*FineTunedModel, 0, len(s.models))
	for _, m := range s.models {
		result = append(result, m)
	}
	return result
}

// ── Stats ────────────────────────────────────────────────────────────────────

func (s *Service) GetStats() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	totalJobs := len(s.jobs)
	completed := 0
	training := 0
	failed := 0
	cancelled := 0
	pending := 0

	for _, j := range s.jobs {
		switch j.Status {
		case "completed":
			completed++
		case "training":
			training++
		case "failed":
			failed++
		case "cancelled":
			cancelled++
		case "pending":
			pending++
		}
	}

	return map[string]interface{}{
		"total_datasets": len(s.datasets),
		"total_jobs":     totalJobs,
		"total_models":   len(s.models),
		"jobs_completed": completed,
		"jobs_training":  training,
		"jobs_failed":    failed,
		"jobs_cancelled": cancelled,
		"jobs_pending":   pending,
	}
}

// ── Training simulation ──────────────────────────────────────────────────────

func (s *Service) simulateTraining(jobID string) {
	// Small delay before starting
	time.Sleep(500 * time.Millisecond)

	s.mu.Lock()
	job, ok := s.jobs[jobID]
	if !ok {
		s.mu.Unlock()
		return
	}
	now := time.Now()
	job.Status = "training"
	job.StartedAt = &now
	epochs := job.Config.Epochs
	if epochs <= 0 {
		epochs = 3
	}
	s.mu.Unlock()

	totalSteps := epochs * 20 // 20 steps per epoch
	for step := 1; step <= totalSteps; step++ {
		time.Sleep(500 * time.Millisecond)

		s.mu.Lock()
		j := s.jobs[jobID]
		if j == nil || j.Status == "cancelled" {
			s.mu.Unlock()
			return
		}

		progress := int(float64(step) / float64(totalSteps) * 100)
		if progress > 100 {
			progress = 100
		}
		j.Progress = progress

		// Declining loss curve
		t := float64(step) / float64(totalSteps)
		trainLoss := 2.5*math.Exp(-3*t) + 0.1 + rand.Float64()*0.05
		evalLoss := trainLoss + 0.05 + rand.Float64()*0.03
		j.Metrics = &JobMetrics{
			TrainLoss: math.Round(trainLoss*1000) / 1000,
			EvalLoss:  math.Round(evalLoss*1000) / 1000,
		}
		s.mu.Unlock()
	}

	// Complete the job and create a model
	s.mu.Lock()
	defer s.mu.Unlock()

	job = s.jobs[jobID]
	if job == nil || job.Status == "cancelled" {
		return
	}

	now2 := time.Now()
	job.Status = "completed"
	job.Progress = 100
	job.CompletedAt = &now2

	model := &FineTunedModel{
		ID:        uuid.New().String(),
		JobID:     jobID,
		BaseModel: job.BaseModel,
		Name:      fmt.Sprintf("%s-ft-%s", job.BaseModel, jobID[:8]),
		Status:    "ready",
		CreatedAt: now2,
	}
	s.models[model.ID] = model
	job.ResultModelID = model.ID
}
