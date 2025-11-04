package router

import (
	"regexp"
	"strings"
)

// ComplexityAnalyzer analyzes prompt complexity
type ComplexityAnalyzer struct {
	technicalTerms []string
	codePatterns   []*regexp.Regexp
}

// NewComplexityAnalyzer creates a new complexity analyzer
func NewComplexityAnalyzer() *ComplexityAnalyzer {
	return &ComplexityAnalyzer{
		technicalTerms: []string{
			"algorithm", "quantum", "neural", "machine learning", "deep learning",
			"blockchain", "cryptography", "distributed", "architecture", "optimization",
			"differential", "integration", "theorem", "hypothesis", "statistical",
			"molecular", "biological", "chemical", "physics", "mathematics",
			"programming", "database", "API", "microservices", "kubernetes",
			"tensor", "matrix", "vector", "eigenvalue", "topology",
		},
		codePatterns: []*regexp.Regexp{
			regexp.MustCompile(`function\s+\w+\s*\(`),
			regexp.MustCompile(`def\s+\w+\s*\(`),
			regexp.MustCompile(`class\s+\w+`),
			regexp.MustCompile(`import\s+\w+`),
			regexp.MustCompile(`\w+\s*=\s*\w+\s*\(`),
			regexp.MustCompile(`if\s+\w+\s*[=<>!]+`),
			regexp.MustCompile(`for\s+\w+\s+in\s+`),
			regexp.MustCompile(`while\s+\w+\s*[=<>!]+`),
		},
	}
}

// Analyze analyzes a prompt and returns complexity information
func (ca *ComplexityAnalyzer) Analyze(prompt string) *PromptAnalysis {
	tokenCount := ca.estimateTokenCount(prompt)
	complexity := ca.determineComplexity(prompt, tokenCount)
	hasCode := ca.containsCode(prompt)
	hasTechnical := ca.containsTechnicalTerms(prompt)

	return &PromptAnalysis{
		TokenCount:   tokenCount,
		Complexity:   complexity,
		HasCode:      hasCode,
		HasTechnical: hasTechnical,
	}
}

// estimateTokenCount estimates the number of tokens in a prompt
func (ca *ComplexityAnalyzer) estimateTokenCount(prompt string) int {
	// Rough estimation: 1 token ≈ 4 characters (for English)
	return len(prompt) / 4
}

// determineComplexity determines the complexity level of a prompt
func (ca *ComplexityAnalyzer) determineComplexity(prompt string, tokenCount int) ComplexityLevel {
	prompt = strings.ToLower(prompt)

	// Score based on various factors
	score := 0

	// Factor 1: Token count
	if tokenCount < 20 {
		score += 0 // Very short, likely simple
	} else if tokenCount < 100 {
		score += 1 // Medium length
	} else {
		score += 2 // Long, likely complex
	}

	// Factor 2: Technical terms
	technicalCount := 0
	for _, term := range ca.technicalTerms {
		if strings.Contains(prompt, term) {
			technicalCount++
		}
	}

	if technicalCount > 0 {
		score += 1
	}
	if technicalCount > 2 {
		score += 1
	}

	// Factor 3: Code presence
	if ca.containsCode(prompt) {
		score += 1
	}

	// Factor 4: Question complexity indicators
	complexIndicators := []string{
		"explain in detail",
		"comprehensive",
		"analyze",
		"compare and contrast",
		"evaluate",
		"discuss the implications",
		"step by step",
		"in-depth",
	}

	for _, indicator := range complexIndicators {
		if strings.Contains(prompt, indicator) {
			score += 1
			break
		}
	}

	// Factor 5: Multiple questions
	questionMarks := strings.Count(prompt, "?")
	if questionMarks > 1 {
		score += 1
	}

	// Determine final complexity based on score
	if score <= 2 {
		return ComplexityLow
	} else if score <= 4 {
		return ComplexityMedium
	} else {
		return ComplexityHigh
	}
}

// containsCode checks if the prompt contains code
func (ca *ComplexityAnalyzer) containsCode(prompt string) bool {
	for _, pattern := range ca.codePatterns {
		if pattern.MatchString(prompt) {
			return true
		}
	}

	// Check for code blocks
	if strings.Contains(prompt, "```") {
		return true
	}

	// Check for common programming symbols in sequence
	codeLikePatterns := []string{
		"(){}", "[]", "=>", "->", "==", "!=", "<=", ">=",
	}

	count := 0
	for _, pattern := range codeLikePatterns {
		if strings.Contains(prompt, pattern) {
			count++
		}
	}

	return count >= 2 // At least 2 code-like patterns
}

// containsTechnicalTerms checks if the prompt contains technical terms
func (ca *ComplexityAnalyzer) containsTechnicalTerms(prompt string) bool {
	promptLower := strings.ToLower(prompt)

	for _, term := range ca.technicalTerms {
		if strings.Contains(promptLower, term) {
			return true
		}
	}

	return false
}

// GetRecommendedModelType returns recommended model type based on complexity
func (ca *ComplexityAnalyzer) GetRecommendedModelType(analysis *PromptAnalysis) string {
	switch analysis.Complexity {
	case ComplexityLow:
		return "fast" // Use fast, cheap models
	case ComplexityMedium:
		return "balanced" // Use balanced models
	case ComplexityHigh:
		return "premium" // Use best quality models
	default:
		return "balanced"
	}
}
