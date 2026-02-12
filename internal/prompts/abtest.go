package prompts

import (
	"fmt"
	"math/rand"
	"sync"
	"time"
)

// ABTest represents an A/B test for prompt templates
type ABTest struct {
	ID          string
	Name        string
	TemplateID  string
	Variants    []*Variant
	Active      bool
	StartTime   time.Time
	EndTime     time.Time
	TotalTests  int64
	mu          sync.RWMutex
}

// Variant represents a test variant
type Variant struct {
	Name        string
	Version     string
	Weight      float64
	Stats       *VariantStats
}

// VariantStats tracks statistics for a variant
type VariantStats struct {
	Selections      int64
	Successes       int64
	Failures        int64
	AvgResponseTime time.Duration
	SuccessRate     float64
}

// NewABTest creates a new A/B test
func NewABTest(id, name, templateID string) *ABTest {
	return &ABTest{
		ID:         id,
		Name:       name,
		TemplateID: templateID,
		Variants:   make([]*Variant, 0),
		Active:     false,
		StartTime:  time.Now(),
	}
}

// AddVariant adds a variant to the test
func (ab *ABTest) AddVariant(v *Variant) error {
	ab.mu.Lock()
	defer ab.mu.Unlock()

	// Validate weight
	totalWeight := v.Weight
	for _, variant := range ab.Variants {
		totalWeight += variant.Weight
	}

	if totalWeight > 1.0 {
		return fmt.Errorf("total variant weight cannot exceed 1.0")
	}

	if v.Stats == nil {
		v.Stats = &VariantStats{}
	}

	ab.Variants = append(ab.Variants, v)
	return nil
}

// SelectVariant selects a variant based on weights
func (ab *ABTest) SelectVariant() *Variant {
	ab.mu.Lock()
	defer ab.mu.Unlock()

	ab.TotalTests++

	if len(ab.Variants) == 0 {
		return nil
	}

	// Weighted random selection
	r := rand.Float64()
	cumulative := 0.0

	for _, variant := range ab.Variants {
		cumulative += variant.Weight
		if r <= cumulative {
			variant.Stats.Selections++
			return variant
		}
	}

	// Fallback to first variant
	ab.Variants[0].Stats.Selections++
	return ab.Variants[0]
}

// RecordResult records the result of a variant test
func (ab *ABTest) RecordResult(variantName string, success bool, duration time.Duration) {
	ab.mu.Lock()
	defer ab.mu.Unlock()

	for _, variant := range ab.Variants {
		if variant.Name == variantName {
			if success {
				variant.Stats.Successes++
			} else {
				variant.Stats.Failures++
			}

			// Update average response time
			totalTests := variant.Stats.Successes + variant.Stats.Failures
			if totalTests == 1 {
				variant.Stats.AvgResponseTime = duration
			} else {
				variant.Stats.AvgResponseTime = (variant.Stats.AvgResponseTime*time.Duration(totalTests-1) + duration) / time.Duration(totalTests)
			}

			// Update success rate
			if totalTests > 0 {
				variant.Stats.SuccessRate = float64(variant.Stats.Successes) / float64(totalTests)
			}

			break
		}
	}
}

// GetResults returns test results
func (ab *ABTest) GetResults() *ABTestResults {
	ab.mu.RLock()
	defer ab.mu.RUnlock()

	results := &ABTestResults{
		ID:         ab.ID,
		Name:       ab.Name,
		TemplateID: ab.TemplateID,
		Active:     ab.Active,
		StartTime:  ab.StartTime,
		EndTime:    ab.EndTime,
		TotalTests: ab.TotalTests,
		Variants:   make([]*VariantResult, 0, len(ab.Variants)),
	}

	var bestVariant *VariantResult
	var worstVariant *VariantResult

	for _, variant := range ab.Variants {
		vr := &VariantResult{
			Name:            variant.Name,
			Version:         variant.Version,
			Weight:          variant.Weight,
			Selections:      variant.Stats.Selections,
			Successes:       variant.Stats.Successes,
			Failures:        variant.Stats.Failures,
			SuccessRate:     variant.Stats.SuccessRate,
			AvgResponseTime: variant.Stats.AvgResponseTime.Milliseconds(),
		}

		results.Variants = append(results.Variants, vr)

		// Track best and worst
		if bestVariant == nil || vr.SuccessRate > bestVariant.SuccessRate {
			bestVariant = vr
		}
		if worstVariant == nil || vr.SuccessRate < worstVariant.SuccessRate {
			worstVariant = vr
		}
	}

	if bestVariant != nil {
		results.BestVariant = bestVariant.Name
		results.BestSuccessRate = bestVariant.SuccessRate
	}
	if worstVariant != nil {
		results.WorstVariant = worstVariant.Name
	}

	return results
}

// Start activates the A/B test
func (ab *ABTest) Start() error {
	ab.mu.Lock()
	defer ab.mu.Unlock()

	if len(ab.Variants) < 2 {
		return fmt.Errorf("at least 2 variants required for A/B test")
	}

	ab.Active = true
	ab.StartTime = time.Now()
	return nil
}

// Stop deactivates the A/B test
func (ab *ABTest) Stop() {
	ab.mu.Lock()
	defer ab.mu.Unlock()

	ab.Active = false
	ab.EndTime = time.Now()
}

// ABTestResults represents the results of an A/B test
type ABTestResults struct {
	ID              string
	Name            string
	TemplateID      string
	Active          bool
	StartTime       time.Time
	EndTime         time.Time
	TotalTests      int64
	Variants        []*VariantResult
	BestVariant     string
	BestSuccessRate float64
	WorstVariant    string
}

// VariantResult represents results for a single variant
type VariantResult struct {
	Name            string
	Version         string
	Weight          float64
	Selections      int64
	Successes       int64
	Failures        int64
	SuccessRate     float64
	AvgResponseTime int64 // milliseconds
}

// CreateSimpleABTest creates a simple 50/50 A/B test
func CreateSimpleABTest(id, name, templateID, versionA, versionB string) *ABTest {
	test := NewABTest(id, name, templateID)

	test.AddVariant(&Variant{
		Name:    "A",
		Version: versionA,
		Weight:  0.5,
		Stats:   &VariantStats{},
	})

	test.AddVariant(&Variant{
		Name:    "B",
		Version: versionB,
		Weight:  0.5,
		Stats:   &VariantStats{},
	})

	return test
}

// CreateWeightedABTest creates a weighted A/B test
func CreateWeightedABTest(id, name, templateID string, variants map[string]float64) (*ABTest, error) {
	test := NewABTest(id, name, templateID)

	var totalWeight float64
	for version, weight := range variants {
		totalWeight += weight
		if totalWeight > 1.0 {
			return nil, fmt.Errorf("total weight exceeds 1.0")
		}

		name := fmt.Sprintf("V%s", version)
		err := test.AddVariant(&Variant{
			Name:    name,
			Version: version,
			Weight:  weight,
			Stats:   &VariantStats{},
		})
		if err != nil {
			return nil, err
		}
	}

	if totalWeight < 0.99 {
		return nil, fmt.Errorf("total weight should sum to 1.0 (got %.2f)", totalWeight)
	}

	return test, nil
}

// CreateMultivariateTest creates a test with multiple variants
func CreateMultivariateTest(id, name, templateID string, versions []string) (*ABTest, error) {
	if len(versions) < 2 {
		return nil, fmt.Errorf("at least 2 versions required")
	}

	test := NewABTest(id, name, templateID)
	weight := 1.0 / float64(len(versions))

	for i, version := range versions {
		variantName := fmt.Sprintf("Variant%d", i+1)
		err := test.AddVariant(&Variant{
			Name:    variantName,
			Version: version,
			Weight:  weight,
			Stats:   &VariantStats{},
		})
		if err != nil {
			return nil, err
		}
	}

	return test, nil
}
