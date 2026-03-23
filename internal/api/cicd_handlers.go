package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/cicd"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

func GetCICDStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := cicd.GetGlobalCICD()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "CI/CD not initialized"); return }
	types.WriteSuccess(w, "CI/CD stats retrieved", m.GetStats())
}

func GetPipelinesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := cicd.GetGlobalCICD()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "CI/CD not initialized"); return }
	pipes := m.GetPipelines()
	types.WriteSuccess(w, "Pipelines retrieved", map[string]interface{}{"pipelines": pipes, "count": len(pipes)})
}

func GetPipelineRunsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := cicd.GetGlobalCICD()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "CI/CD not initialized"); return }
	pipelineID := r.URL.Query().Get("pipeline_id")
	runs := m.GetRuns(pipelineID, 20)
	types.WriteSuccess(w, "Pipeline runs retrieved", map[string]interface{}{"runs": runs, "count": len(runs)})
}

func GetPipelineRunHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := cicd.GetGlobalCICD()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "CI/CD not initialized"); return }
	id := r.URL.Query().Get("id")
	if id == "" { types.WriteError(w, http.StatusBadRequest, "id required"); return }
	run := m.GetRun(id)
	if run == nil { types.WriteError(w, http.StatusNotFound, "Run not found"); return }
	types.WriteSuccess(w, "Run retrieved", run)
}

func GetCICDDeploymentsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := cicd.GetGlobalCICD()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "CI/CD not initialized"); return }
	deps := m.GetDeployments()
	types.WriteSuccess(w, "Deployments retrieved", map[string]interface{}{"deployments": deps, "count": len(deps)})
}

func TriggerPipelineHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := cicd.GetGlobalCICD()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "CI/CD not initialized"); return }
	var req struct {
		PipelineID string `json:"pipeline_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.PipelineID == "" {
		types.WriteError(w, http.StatusBadRequest, "pipeline_id required"); return
	}
	run, err := m.TriggerPipeline(req.PipelineID)
	if err != nil { types.WriteError(w, http.StatusNotFound, err.Error()); return }
	types.WriteSuccess(w, "Pipeline triggered", run)
}
