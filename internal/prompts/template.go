package prompts

import (
	"fmt"
	"strings"
	"time"
)

// Template represents a prompt template with variables
type Template struct {
	ID          string
	Name        string
	Description string
	Content     string
	Variables   []Variable
	Version     string
	CreatedAt   time.Time
	UpdatedAt   time.Time
	Category    string
	Tags        []string
	Stats       *TemplateStats
}

// Variable represents a template variable
type Variable struct {
	Name         string
	Type         VariableType
	Required     bool
	DefaultValue string
	Description  string
	Validation   ValidationFunc
}

// VariableType defines the type of a variable
type VariableType string

const (
	VarTypeString  VariableType = "string"
	VarTypeNumber  VariableType = "number"
	VarTypeBoolean VariableType = "boolean"
	VarTypeList    VariableType = "list"
)

// ValidationFunc validates a variable value
type ValidationFunc func(value string) error

// TemplateStats tracks template usage statistics
type TemplateStats struct {
	UsageCount      int64
	SuccessCount    int64
	FailureCount    int64
	AvgResponseTime time.Duration
	LastUsed        time.Time
}

// Render renders the template with given values
func (t *Template) Render(values map[string]string) (string, error) {
	result := t.Content

	// Validate required variables
	for _, variable := range t.Variables {
		value, exists := values[variable.Name]

		if variable.Required && !exists {
			return "", fmt.Errorf("required variable missing: %s", variable.Name)
		}

		if !exists {
			value = variable.DefaultValue
		}

		// Validate if validation function exists
		if variable.Validation != nil {
			if err := variable.Validation(value); err != nil {
				return "", fmt.Errorf("validation failed for %s: %w", variable.Name, err)
			}
		}

		// Replace variable in template
		placeholder := fmt.Sprintf("{{%s}}", variable.Name)
		result = strings.ReplaceAll(result, placeholder, value)
	}

	return result, nil
}

// AddVariable adds a variable to the template
func (t *Template) AddVariable(v Variable) {
	t.Variables = append(t.Variables, v)
}

// UpdateStats updates template statistics
func (t *Template) UpdateStats(success bool, duration time.Duration) {
	if t.Stats == nil {
		t.Stats = &TemplateStats{}
	}

	t.Stats.UsageCount++
	if success {
		t.Stats.SuccessCount++
	} else {
		t.Stats.FailureCount++
	}

	// Update average response time
	if t.Stats.UsageCount == 1 {
		t.Stats.AvgResponseTime = duration
	} else {
		t.Stats.AvgResponseTime = (t.Stats.AvgResponseTime*time.Duration(t.Stats.UsageCount-1) + duration) / time.Duration(t.Stats.UsageCount)
	}

	t.Stats.LastUsed = time.Now()
}

// Common validation functions

// NotEmptyValidation ensures the value is not empty
func NotEmptyValidation(value string) error {
	if strings.TrimSpace(value) == "" {
		return fmt.Errorf("value cannot be empty")
	}
	return nil
}

// LengthValidation ensures value length is within range
func LengthValidation(min, max int) ValidationFunc {
	return func(value string) error {
		length := len(value)
		if length < min {
			return fmt.Errorf("value too short (min: %d)", min)
		}
		if max > 0 && length > max {
			return fmt.Errorf("value too long (max: %d)", max)
		}
		return nil
	}
}

// OneOfValidation ensures value is one of allowed values
func OneOfValidation(allowed []string) ValidationFunc {
	return func(value string) error {
		for _, v := range allowed {
			if value == v {
				return nil
			}
		}
		return fmt.Errorf("value must be one of: %v", allowed)
	}
}

// NumericValidation ensures value is a number within range
func NumericValidation(min, max float64) ValidationFunc {
	return func(value string) error {
		var num float64
		_, err := fmt.Sscanf(value, "%f", &num)
		if err != nil {
			return fmt.Errorf("value must be numeric")
		}
		if num < min || num > max {
			return fmt.Errorf("value must be between %f and %f", min, max)
		}
		return nil
	}
}

// Example templates

// CodeReviewTemplate creates a code review template
func CodeReviewTemplate() *Template {
	return &Template{
		ID:          "code-review",
		Name:        "Code Review",
		Description: "Template for reviewing code",
		Content: `Review the following {{language}} code:

{{code}}

Focus on:
- Code quality
- Best practices
- Potential bugs
- Performance issues
- Security concerns

Provide detailed feedback with specific suggestions.`,
		Variables: []Variable{
			{
				Name:        "language",
				Type:        VarTypeString,
				Required:    true,
				Description: "Programming language",
				Validation:  NotEmptyValidation,
			},
			{
				Name:        "code",
				Type:        VarTypeString,
				Required:    true,
				Description: "Code to review",
				Validation:  LengthValidation(10, 10000),
			},
		},
		Version:   "1.0.0",
		Category:  "development",
		Tags:      []string{"code", "review", "quality"},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// SummarizationTemplate creates a summarization template
func SummarizationTemplate() *Template {
	return &Template{
		ID:          "summarize",
		Name:        "Text Summarization",
		Description: "Template for summarizing text",
		Content: `Summarize the following text in {{length}} sentences:

{{text}}

Focus on the main points and key takeaways.`,
		Variables: []Variable{
			{
				Name:         "text",
				Type:         VarTypeString,
				Required:     true,
				Description:  "Text to summarize",
				Validation:   LengthValidation(50, 50000),
			},
			{
				Name:         "length",
				Type:         VarTypeNumber,
				Required:     false,
				DefaultValue: "3",
				Description:  "Number of sentences",
				Validation:   NumericValidation(1, 10),
			},
		},
		Version:   "1.0.0",
		Category:  "text-processing",
		Tags:      []string{"summary", "condensation"},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// TranslationTemplate creates a translation template
func TranslationTemplate() *Template {
	return &Template{
		ID:          "translate",
		Name:        "Translation",
		Description: "Template for translating text",
		Content: `Translate the following text from {{source_lang}} to {{target_lang}}:

{{text}}

Maintain the original tone and meaning.`,
		Variables: []Variable{
			{
				Name:        "text",
				Type:        VarTypeString,
				Required:    true,
				Description: "Text to translate",
				Validation:  NotEmptyValidation,
			},
			{
				Name:         "source_lang",
				Type:         VarTypeString,
				Required:     false,
				DefaultValue: "English",
				Description:  "Source language",
			},
			{
				Name:        "target_lang",
				Type:        VarTypeString,
				Required:    true,
				Description: "Target language",
				Validation:  NotEmptyValidation,
			},
		},
		Version:   "1.0.0",
		Category:  "translation",
		Tags:      []string{"translate", "language"},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}
