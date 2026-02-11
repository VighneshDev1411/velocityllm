package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/router"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

// ExecuteChainHandler executes a model chain (Day 8)
func ExecuteChainHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Parse request
	var req struct {
		ChainName string `json:"chain_name"`
		Input     string `json:"input"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.ChainName == "" || req.Input == "" {
		types.WriteError(w, http.StatusBadRequest, "chain_name and input are required")
		return
	}

	// Get orchestrator
	orchestrator := getOrchestrator()
	if orchestrator == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Orchestrator not initialized")
		return
	}

	// Execute chain
	result, err := orchestrator.ExecuteChain(r.Context(), req.ChainName, req.Input)
	if err != nil {
		utils.Error("Chain execution failed", "error", err)
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	types.WriteSuccess(w, "Chain executed successfully", result)
}

// ExecuteParallelCompositionHandler executes models in parallel and composes results
func ExecuteParallelCompositionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Parse request
	var req struct {
		ModelIDs []string `json:"model_ids"`
		Input    string   `json:"input"`
		Strategy string   `json:"strategy"` // first_successful, best_score, majority_vote, etc.
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if len(req.ModelIDs) == 0 || req.Input == "" {
		types.WriteError(w, http.StatusBadRequest, "model_ids and input are required")
		return
	}

	if req.Strategy == "" {
		req.Strategy = "first_successful"
	}

	// Get orchestrator
	orchestrator := getOrchestrator()
	if orchestrator == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Orchestrator not initialized")
		return
	}

	// Execute parallel composition
	output, err := orchestrator.ExecuteParallelComposition(r.Context(), req.ModelIDs, req.Input, req.Strategy)
	if err != nil {
		utils.Error("Parallel composition failed", "error", err)
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	response := map[string]interface{}{
		"output":    output,
		"strategy":  req.Strategy,
		"models":    req.ModelIDs,
		"model_count": len(req.ModelIDs),
	}

	types.WriteSuccess(w, "Parallel composition completed", response)
}

// ConditionalRouteHandler routes based on conditions
func ConditionalRouteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Parse request
	var req struct {
		Input      string `json:"input"`
		Conditions []struct {
			Name      string   `json:"name"`
			Type      string   `json:"type"` // length, keyword, complexity
			ModelID   string   `json:"model_id"`
			MinLength int      `json:"min_length,omitempty"`
			MaxLength int      `json:"max_length,omitempty"`
			Keywords  []string `json:"keywords,omitempty"`
		} `json:"conditions"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Input == "" || len(req.Conditions) == 0 {
		types.WriteError(w, http.StatusBadRequest, "input and conditions are required")
		return
	}

	// Convert to router conditions
	conditions := make([]router.RouteCondition, 0, len(req.Conditions))
	for _, cond := range req.Conditions {
		switch cond.Type {
		case "length":
			conditions = append(conditions, router.LengthBasedCondition(
				cond.Name, cond.MinLength, cond.MaxLength, cond.ModelID))
		case "keyword":
			conditions = append(conditions, router.KeywordBasedCondition(
				cond.Name, cond.Keywords, cond.ModelID))
		case "complexity":
			conditions = append(conditions, router.ComplexityBasedCondition(
				cond.Name, cond.MinLength, cond.ModelID))
		}
	}

	// Get orchestrator
	orchestrator := getOrchestrator()
	if orchestrator == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Orchestrator not initialized")
		return
	}

	// Execute conditional routing
	output, err := orchestrator.ConditionalRoute(r.Context(), req.Input, conditions)
	if err != nil {
		utils.Error("Conditional routing failed", "error", err)
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	types.WriteSuccess(w, "Conditional routing completed", map[string]string{
		"output": output,
	})
}

// GetOrchestrationStatsHandler returns orchestration statistics
func GetOrchestrationStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	orchestrator := getOrchestrator()
	if orchestrator == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Orchestrator not initialized")
		return
	}

	stats := orchestrator.GetStats()
	types.WriteSuccess(w, "Orchestration stats retrieved", stats)
}

// GetCompositionStrategiesHandler lists available composition strategies
func GetCompositionStrategiesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	strategies := []map[string]string{
		{
			"name":        "first_successful",
			"description": "Returns the first successful result",
		},
		{
			"name":        "best_score",
			"description": "Returns the result with the highest score",
		},
		{
			"name":        "majority_vote",
			"description": "Returns the most common output",
		},
		{
			"name":        "concatenate",
			"description": "Concatenates all outputs",
		},
		{
			"name":        "average",
			"description": "Returns middle-length response",
		},
		{
			"name":        "weighted_average",
			"description": "Uses scores as weights",
		},
	}

	types.WriteSuccess(w, "Composition strategies retrieved", strategies)
}

// Global orchestrator instance
var globalOrchestrator *router.Orchestrator

// SetOrchestrator sets the global orchestrator
func SetOrchestrator(o *router.Orchestrator) {
	globalOrchestrator = o
}

// getOrchestrator returns the global orchestrator
func getOrchestrator() *router.Orchestrator {
	return globalOrchestrator
}
