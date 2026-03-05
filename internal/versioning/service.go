package versioning

import (
	"fmt"
	"math/rand"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ── Types ────────────────────────────────────────────────────────────────────

type VersionMetrics struct {
	Accuracy   float64 `json:"accuracy"`
	Latency    float64 `json:"latency"`
	Throughput float64 `json:"throughput"`
}

type ModelVersion struct {
	ID          string            `json:"id"`
	ModelName   string            `json:"model_name"`
	Version     string            `json:"version"`
	Description string            `json:"description"`
	BaseModel   string            `json:"base_model"`
	Status      string            `json:"status"` // draft, active, deployed, archived
	Config      map[string]string `json:"config"`
	Metrics     VersionMetrics    `json:"metrics"`
	CreatedAt   time.Time         `json:"created_at"`
	PromotedAt  *time.Time        `json:"promoted_at,omitempty"`
}

type ABTestResults struct {
	Requests     int     `json:"requests"`
	VersionAWins int     `json:"version_a_wins"`
	VersionBWins int     `json:"version_b_wins"`
	AvgLatencyA  float64 `json:"avg_latency_a"`
	AvgLatencyB  float64 `json:"avg_latency_b"`
}

type ABTest struct {
	ID           string        `json:"id"`
	ModelName    string        `json:"model_name"`
	VersionA     string        `json:"version_a"`
	VersionB     string        `json:"version_b"`
	Status       string        `json:"status"` // running, completed, stopped
	TrafficSplit int           `json:"traffic_split"`
	Results      ABTestResults `json:"results"`
	CreatedAt    time.Time     `json:"created_at"`
	CompletedAt  *time.Time    `json:"completed_at,omitempty"`
}

// ── Service ──────────────────────────────────────────────────────────────────

type Service struct {
	mu       sync.RWMutex
	versions map[string]*ModelVersion
	abtests  map[string]*ABTest
}

var (
	instance *Service
	once     sync.Once
)

func GetService() *Service {
	once.Do(func() {
		instance = &Service{
			versions: make(map[string]*ModelVersion),
			abtests:  make(map[string]*ABTest),
		}
	})
	return instance
}

// ── Versions ─────────────────────────────────────────────────────────────────

func (s *Service) CreateVersion(modelName, version, description, baseModel string, config map[string]string) *ModelVersion {
	s.mu.Lock()
	defer s.mu.Unlock()

	v := &ModelVersion{
		ID:          uuid.New().String(),
		ModelName:   modelName,
		Version:     version,
		Description: description,
		BaseModel:   baseModel,
		Status:      "draft",
		Config:      config,
		Metrics: VersionMetrics{
			Accuracy:   0.85 + rand.Float64()*0.12,
			Latency:    50 + rand.Float64()*200,
			Throughput: 100 + rand.Float64()*400,
		},
		CreatedAt: time.Now(),
	}
	s.versions[v.ID] = v
	return v
}

func (s *Service) ListVersions() []*ModelVersion {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*ModelVersion, 0, len(s.versions))
	for _, v := range s.versions {
		result = append(result, v)
	}
	return result
}

func (s *Service) GetVersion(id string) *ModelVersion {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.versions[id]
}

func (s *Service) PromoteVersion(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	v, ok := s.versions[id]
	if !ok {
		return fmt.Errorf("version %s not found", id)
	}
	if v.Status == "archived" {
		return fmt.Errorf("cannot promote archived version")
	}

	// Demote other deployed versions of the same model
	for _, other := range s.versions {
		if other.ModelName == v.ModelName && other.ID != id && other.Status == "deployed" {
			other.Status = "active"
		}
	}

	now := time.Now()
	v.Status = "deployed"
	v.PromotedAt = &now
	return nil
}

func (s *Service) ArchiveVersion(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	v, ok := s.versions[id]
	if !ok {
		return fmt.Errorf("version %s not found", id)
	}
	if v.Status == "deployed" {
		return fmt.Errorf("cannot archive deployed version; demote first")
	}
	v.Status = "archived"
	return nil
}

// ── A/B Tests ────────────────────────────────────────────────────────────────

func (s *Service) CreateABTest(modelName, versionA, versionB string, trafficSplit int) (*ABTest, error) {
	s.mu.Lock()

	// Validate versions exist
	var foundA, foundB bool
	for _, v := range s.versions {
		if v.ID == versionA {
			foundA = true
		}
		if v.ID == versionB {
			foundB = true
		}
	}
	if !foundA || !foundB {
		s.mu.Unlock()
		return nil, fmt.Errorf("one or both versions not found")
	}

	if trafficSplit < 1 || trafficSplit > 99 {
		trafficSplit = 50
	}

	test := &ABTest{
		ID:           uuid.New().String(),
		ModelName:    modelName,
		VersionA:     versionA,
		VersionB:     versionB,
		Status:       "running",
		TrafficSplit: trafficSplit,
		Results:      ABTestResults{},
		CreatedAt:    time.Now(),
	}
	s.abtests[test.ID] = test
	s.mu.Unlock()

	go s.simulateABTest(test.ID)

	return test, nil
}

func (s *Service) ListABTests() []*ABTest {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*ABTest, 0, len(s.abtests))
	for _, t := range s.abtests {
		result = append(result, t)
	}
	return result
}

func (s *Service) GetABTest(id string) *ABTest {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.abtests[id]
}

func (s *Service) StopABTest(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	t, ok := s.abtests[id]
	if !ok {
		return fmt.Errorf("A/B test %s not found", id)
	}
	if t.Status != "running" {
		return fmt.Errorf("A/B test is not running")
	}
	now := time.Now()
	t.Status = "stopped"
	t.CompletedAt = &now
	return nil
}

// ── Stats ────────────────────────────────────────────────────────────────────

func (s *Service) GetStats() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	total := len(s.versions)
	draft, active, deployed, archived := 0, 0, 0, 0
	for _, v := range s.versions {
		switch v.Status {
		case "draft":
			draft++
		case "active":
			active++
		case "deployed":
			deployed++
		case "archived":
			archived++
		}
	}

	totalTests := len(s.abtests)
	running, completed, stopped := 0, 0, 0
	for _, t := range s.abtests {
		switch t.Status {
		case "running":
			running++
		case "completed":
			completed++
		case "stopped":
			stopped++
		}
	}

	return map[string]interface{}{
		"total_versions":    total,
		"versions_draft":    draft,
		"versions_active":   active,
		"versions_deployed": deployed,
		"versions_archived": archived,
		"total_abtests":     totalTests,
		"abtests_running":   running,
		"abtests_completed": completed,
		"abtests_stopped":   stopped,
	}
}

// ── A/B Test simulation ──────────────────────────────────────────────────────

func (s *Service) simulateABTest(testID string) {
	// Simulate traffic over 30 seconds (60 ticks x 500ms)
	for tick := 0; tick < 60; tick++ {
		time.Sleep(500 * time.Millisecond)

		s.mu.Lock()
		t, ok := s.abtests[testID]
		if !ok || t.Status != "running" {
			s.mu.Unlock()
			return
		}

		// Each tick: 5-15 requests
		batch := 5 + rand.Intn(11)
		t.Results.Requests += batch

		for i := 0; i < batch; i++ {
			if rand.Intn(100) < t.TrafficSplit {
				t.Results.VersionAWins++
			} else {
				t.Results.VersionBWins++
			}
		}

		// Running averages for latency
		t.Results.AvgLatencyA = 80 + rand.Float64()*40
		t.Results.AvgLatencyB = 90 + rand.Float64()*50
		s.mu.Unlock()
	}

	// Auto-complete
	s.mu.Lock()
	t, ok := s.abtests[testID]
	if ok && t.Status == "running" {
		now := time.Now()
		t.Status = "completed"
		t.CompletedAt = &now
	}
	s.mu.Unlock()
}
