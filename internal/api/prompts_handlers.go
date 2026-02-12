package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/prompts"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// ListTemplatesHandler lists all prompt templates (Day 9)
func ListTemplatesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	manager := prompts.GetGlobalManager()
	if manager == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Template manager not initialized")
		return
	}

	templates := manager.ListTemplates()
	types.WriteSuccess(w, "Templates retrieved", templates)
}

// GetTemplateHandler retrieves a specific template
func GetTemplateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Get template ID from query
	templateID := r.URL.Query().Get("id")
	if templateID == "" {
		types.WriteError(w, http.StatusBadRequest, "template ID is required")
		return
	}

	manager := prompts.GetGlobalManager()
	if manager == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Template manager not initialized")
		return
	}

	template, err := manager.GetTemplate(templateID)
	if err != nil {
		types.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	types.WriteSuccess(w, "Template retrieved", template)
}

// RenderTemplateHandler renders a template with values
func RenderTemplateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		TemplateID string            `json:"template_id"`
		Values     map[string]string `json:"values"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.TemplateID == "" {
		types.WriteError(w, http.StatusBadRequest, "template_id is required")
		return
	}

	manager := prompts.GetGlobalManager()
	if manager == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Template manager not initialized")
		return
	}

	result, err := manager.RenderTemplate(req.TemplateID, req.Values)
	if err != nil {
		utils.Error("Template rendering failed", "error", err)
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	response := map[string]string{
		"rendered_prompt": result,
		"template_id":     req.TemplateID,
	}

	types.WriteSuccess(w, "Template rendered successfully", response)
}

// CreateTemplateHandler creates a new template
func CreateTemplateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var template prompts.Template
	if err := json.NewDecoder(r.Body).Decode(&template); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	manager := prompts.GetGlobalManager()
	if manager == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Template manager not initialized")
		return
	}

	if err := manager.RegisterTemplate(&template); err != nil {
		utils.Error("Template registration failed", "error", err)
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	types.WriteSuccess(w, "Template created successfully", map[string]string{
		"template_id": template.ID,
		"version":     template.Version,
	})
}

// ListVersionsHandler lists all versions of a template
func ListVersionsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	templateID := r.URL.Query().Get("id")
	if templateID == "" {
		types.WriteError(w, http.StatusBadRequest, "template ID is required")
		return
	}

	manager := prompts.GetGlobalManager()
	if manager == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Template manager not initialized")
		return
	}

	versions, err := manager.ListVersions(templateID)
	if err != nil {
		types.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	types.WriteSuccess(w, "Versions retrieved", versions)
}

// CreateABTestHandler creates an A/B test for a template
func CreateABTestHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		ID         string              `json:"id"`
		Name       string              `json:"name"`
		TemplateID string              `json:"template_id"`
		Variants   map[string]float64  `json:"variants"` // version -> weight
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.ID == "" || req.TemplateID == "" || len(req.Variants) < 2 {
		types.WriteError(w, http.StatusBadRequest, "id, template_id, and at least 2 variants are required")
		return
	}

	manager := prompts.GetGlobalManager()
	if manager == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Template manager not initialized")
		return
	}

	// Create weighted A/B test
	test, err := prompts.CreateWeightedABTest(req.ID, req.Name, req.TemplateID, req.Variants)
	if err != nil {
		utils.Error("A/B test creation failed", "error", err)
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Start the test
	if err := test.Start(); err != nil {
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	// Register with manager
	if err := manager.CreateABTest(test); err != nil {
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	types.WriteSuccess(w, "A/B test created and started", map[string]interface{}{
		"test_id":   req.ID,
		"variants":  len(req.Variants),
		"active":    true,
	})
}

// GetABTestResultsHandler retrieves A/B test results
func GetABTestResultsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	templateID := r.URL.Query().Get("template_id")
	if templateID == "" {
		types.WriteError(w, http.StatusBadRequest, "template_id is required")
		return
	}

	manager := prompts.GetGlobalManager()
	if manager == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Template manager not initialized")
		return
	}

	test, err := manager.GetABTest(templateID)
	if err != nil {
		types.WriteError(w, http.StatusNotFound, err.Error())
		return
	}

	results := test.GetResults()
	types.WriteSuccess(w, "A/B test results retrieved", results)
}

// StopABTestHandler stops an active A/B test
func StopABTestHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		TemplateID string `json:"template_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	manager := prompts.GetGlobalManager()
	if manager == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Template manager not initialized")
		return
	}

	if err := manager.StopABTest(req.TemplateID); err != nil {
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}

	types.WriteSuccess(w, "A/B test stopped", nil)
}

// SearchTemplatesHandler searches templates by category/tags
func SearchTemplatesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	category := r.URL.Query().Get("category")
	tagsParam := r.URL.Query().Get("tags")

	var tags []string
	if tagsParam != "" {
		json.Unmarshal([]byte(tagsParam), &tags)
	}

	manager := prompts.GetGlobalManager()
	if manager == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Template manager not initialized")
		return
	}

	results := manager.SearchTemplates(category, tags)
	types.WriteSuccess(w, "Search results", map[string]interface{}{
		"templates": results,
		"count":     len(results),
	})
}

// GetTemplateStatsHandler retrieves template statistics
func GetTemplateStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	manager := prompts.GetGlobalManager()
	if manager == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Template manager not initialized")
		return
	}

	stats := manager.GetStats()
	types.WriteSuccess(w, "Template stats retrieved", stats)
}
