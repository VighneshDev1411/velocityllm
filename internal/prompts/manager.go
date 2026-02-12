package prompts

import (
	"fmt"
	"sync"
	"time"

	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// Manager manages prompt templates
type Manager struct {
	templates map[string]*Template
	versions  map[string][]*Template // templateID -> versions
	abTests   map[string]*ABTest
	mu        sync.RWMutex
	stats     *ManagerStats
}

// ManagerStats tracks manager statistics
type ManagerStats struct {
	TotalTemplates   int
	TotalVersions    int
	ActiveABTests    int
	TotalRenderings  int64
	SuccessfulRenders int64
	FailedRenders    int64
}

// NewManager creates a new template manager
func NewManager() *Manager {
	m := &Manager{
		templates: make(map[string]*Template),
		versions:  make(map[string][]*Template),
		abTests:   make(map[string]*ABTest),
		stats:     &ManagerStats{},
	}

	// Register default templates
	m.RegisterTemplate(CodeReviewTemplate())
	m.RegisterTemplate(SummarizationTemplate())
	m.RegisterTemplate(TranslationTemplate())

	return m
}

// RegisterTemplate registers a new template
func (m *Manager) RegisterTemplate(template *Template) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if template.ID == "" {
		return fmt.Errorf("template ID cannot be empty")
	}

	// Check if template already exists
	if existing, exists := m.templates[template.ID]; exists {
		// Create new version
		return m.createVersion(existing, template)
	}

	m.templates[template.ID] = template
	m.stats.TotalTemplates++
	utils.Info("Template registered", "id", template.ID, "name", template.Name)

	return nil
}

// createVersion creates a new version of a template
func (m *Manager) createVersion(existing, new *Template) error {
	// Increment version
	new.Version = incrementVersion(existing.Version)
	new.UpdatedAt = time.Now()

	// Store version
	if m.versions[existing.ID] == nil {
		m.versions[existing.ID] = []*Template{existing}
		m.stats.TotalVersions++
	}

	m.versions[existing.ID] = append(m.versions[existing.ID], new)
	m.templates[existing.ID] = new // Update current version
	m.stats.TotalVersions++

	utils.Info("Template version created", "id", existing.ID, "version", new.Version)
	return nil
}

// GetTemplate retrieves a template by ID
func (m *Manager) GetTemplate(id string) (*Template, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	template, exists := m.templates[id]
	if !exists {
		return nil, fmt.Errorf("template not found: %s", id)
	}

	return template, nil
}

// GetTemplateVersion retrieves a specific version of a template
func (m *Manager) GetTemplateVersion(id, version string) (*Template, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	versions, exists := m.versions[id]
	if !exists {
		return nil, fmt.Errorf("template not found: %s", id)
	}

	for _, t := range versions {
		if t.Version == version {
			return t, nil
		}
	}

	return nil, fmt.Errorf("version not found: %s", version)
}

// ListTemplates lists all templates
func (m *Manager) ListTemplates() []*Template {
	m.mu.RLock()
	defer m.mu.RUnlock()

	templates := make([]*Template, 0, len(m.templates))
	for _, t := range m.templates {
		templates = append(templates, t)
	}

	return templates
}

// ListVersions lists all versions of a template
func (m *Manager) ListVersions(id string) ([]*Template, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	versions, exists := m.versions[id]
	if !exists {
		return nil, fmt.Errorf("template not found: %s", id)
	}

	return versions, nil
}

// RenderTemplate renders a template with given values
func (m *Manager) RenderTemplate(id string, values map[string]string) (string, error) {
	startTime := time.Now()
	m.stats.TotalRenderings++

	// Check if A/B test is active
	if abTest, exists := m.abTests[id]; exists && abTest.Active {
		return m.renderWithABTest(abTest, values)
	}

	// Normal rendering
	template, err := m.GetTemplate(id)
	if err != nil {
		m.stats.FailedRenders++
		return "", err
	}

	result, err := template.Render(values)
	duration := time.Since(startTime)

	if err != nil {
		m.stats.FailedRenders++
		template.UpdateStats(false, duration)
		return "", err
	}

	m.stats.SuccessfulRenders++
	template.UpdateStats(true, duration)

	return result, nil
}

// renderWithABTest renders using A/B test variant
func (m *Manager) renderWithABTest(abTest *ABTest, values map[string]string) (string, error) {
	startTime := time.Now()

	// Select variant
	variant := abTest.SelectVariant()

	template, err := m.GetTemplateVersion(abTest.TemplateID, variant.Version)
	if err != nil {
		m.stats.FailedRenders++
		return "", err
	}

	result, err := template.Render(values)
	duration := time.Since(startTime)

	// Record result
	abTest.RecordResult(variant.Name, err == nil, duration)

	if err != nil {
		m.stats.FailedRenders++
		return "", err
	}

	m.stats.SuccessfulRenders++
	return result, nil
}

// CreateABTest creates an A/B test for a template
func (m *Manager) CreateABTest(test *ABTest) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if test.TemplateID == "" {
		return fmt.Errorf("template ID cannot be empty")
	}

	// Validate variants exist
	for _, variant := range test.Variants {
		_, err := m.GetTemplateVersion(test.TemplateID, variant.Version)
		if err != nil {
			return fmt.Errorf("variant version not found: %s", variant.Version)
		}
	}

	m.abTests[test.TemplateID] = test
	m.stats.ActiveABTests++

	utils.Info("A/B test created", "template", test.TemplateID, "variants", len(test.Variants))
	return nil
}

// GetABTest retrieves an A/B test
func (m *Manager) GetABTest(templateID string) (*ABTest, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	test, exists := m.abTests[templateID]
	if !exists {
		return nil, fmt.Errorf("A/B test not found for template: %s", templateID)
	}

	return test, nil
}

// StopABTest stops an A/B test
func (m *Manager) StopABTest(templateID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	test, exists := m.abTests[templateID]
	if !exists {
		return fmt.Errorf("A/B test not found for template: %s", templateID)
	}

	test.Active = false
	m.stats.ActiveABTests--

	utils.Info("A/B test stopped", "template", templateID)
	return nil
}

// GetStats returns manager statistics
func (m *Manager) GetStats() *ManagerStats {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return &ManagerStats{
		TotalTemplates:    m.stats.TotalTemplates,
		TotalVersions:     m.stats.TotalVersions,
		ActiveABTests:     m.stats.ActiveABTests,
		TotalRenderings:   m.stats.TotalRenderings,
		SuccessfulRenders: m.stats.SuccessfulRenders,
		FailedRenders:     m.stats.FailedRenders,
	}
}

// SearchTemplates searches templates by category or tag
func (m *Manager) SearchTemplates(category string, tags []string) []*Template {
	m.mu.RLock()
	defer m.mu.RUnlock()

	results := make([]*Template, 0)

	for _, template := range m.templates {
		// Filter by category
		if category != "" && template.Category != category {
			continue
		}

		// Filter by tags
		if len(tags) > 0 {
			hasAllTags := true
			for _, tag := range tags {
				found := false
				for _, tTag := range template.Tags {
					if tTag == tag {
						found = true
						break
					}
				}
				if !found {
					hasAllTags = false
					break
				}
			}
			if !hasAllTags {
				continue
			}
		}

		results = append(results, template)
	}

	return results
}

// Helper functions

func incrementVersion(version string) string {
	// Simple version increment: 1.0.0 -> 1.0.1
	var major, minor, patch int
	fmt.Sscanf(version, "%d.%d.%d", &major, &minor, &patch)
	patch++
	return fmt.Sprintf("%d.%d.%d", major, minor, patch)
}

// Global manager instance
var globalManager *Manager
var managerOnce sync.Once

// InitGlobalManager initializes the global template manager
func InitGlobalManager() *Manager {
	managerOnce.Do(func() {
		globalManager = NewManager()
		utils.Info("Prompt template manager initialized")
	})
	return globalManager
}

// GetGlobalManager returns the global template manager
func GetGlobalManager() *Manager {
	return globalManager
}
