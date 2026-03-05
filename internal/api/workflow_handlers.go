package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/workflow"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// ── List / Create Workflows ──────────────────────────────────────────────────

func ListWorkflowsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	svc := workflow.GetService()
	types.WriteSuccess(w, "Workflows retrieved", svc.ListWorkflows())
}

type createWorkflowRequest struct {
	Name        string              `json:"name"`
	Description string              `json:"description"`
	Nodes       []workflow.WorkflowNode `json:"nodes"`
	Edges       []workflow.WorkflowEdge `json:"edges"`
}

func CreateWorkflowHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req createWorkflowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Name == "" {
		types.WriteError(w, http.StatusBadRequest, "Name is required")
		return
	}
	if req.Nodes == nil {
		req.Nodes = []workflow.WorkflowNode{}
	}
	if req.Edges == nil {
		req.Edges = []workflow.WorkflowEdge{}
	}

	svc := workflow.GetService()
	wf := svc.CreateWorkflow(req.Name, req.Description, req.Nodes, req.Edges)
	types.WriteSuccess(w, "Workflow created", wf)
}

// ── Get Workflow ─────────────────────────────────────────────────────────────

func GetWorkflowHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	id := r.URL.Query().Get("id")
	if id == "" {
		types.WriteError(w, http.StatusBadRequest, "ID is required")
		return
	}
	svc := workflow.GetService()
	wf := svc.GetWorkflow(id)
	if wf == nil {
		types.WriteError(w, http.StatusNotFound, "Workflow not found")
		return
	}
	types.WriteSuccess(w, "Workflow retrieved", wf)
}

// ── Update Workflow ──────────────────────────────────────────────────────────

type updateWorkflowRequest struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	Description string              `json:"description"`
	Status      string              `json:"status"`
	Nodes       []workflow.WorkflowNode `json:"nodes"`
	Edges       []workflow.WorkflowEdge `json:"edges"`
}

func UpdateWorkflowHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req updateWorkflowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.ID == "" {
		types.WriteError(w, http.StatusBadRequest, "ID is required")
		return
	}

	svc := workflow.GetService()
	wf, err := svc.UpdateWorkflow(req.ID, req.Name, req.Description, req.Status, req.Nodes, req.Edges)
	if err != nil {
		types.WriteError(w, http.StatusNotFound, err.Error())
		return
	}
	types.WriteSuccess(w, "Workflow updated", wf)
}

// ── Delete Workflow ──────────────────────────────────────────────────────────

func DeleteWorkflowHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	id := r.URL.Query().Get("id")
	if id == "" {
		types.WriteError(w, http.StatusBadRequest, "ID is required")
		return
	}
	svc := workflow.GetService()
	if err := svc.DeleteWorkflow(id); err != nil {
		types.WriteError(w, http.StatusNotFound, err.Error())
		return
	}
	types.WriteSuccess(w, "Workflow deleted", nil)
}

// ── Execute Workflow ─────────────────────────────────────────────────────────

type executeWorkflowRequest struct {
	WorkflowID string `json:"workflow_id"`
}

func ExecuteWorkflowHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req executeWorkflowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.WorkflowID == "" {
		types.WriteError(w, http.StatusBadRequest, "Workflow ID is required")
		return
	}

	svc := workflow.GetService()
	run, err := svc.ExecuteWorkflow(req.WorkflowID)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	types.WriteSuccess(w, "Workflow execution started", run)
}

// ── List Runs ────────────────────────────────────────────────────────────────

func ListWorkflowRunsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	svc := workflow.GetService()
	types.WriteSuccess(w, "Runs retrieved", svc.ListRuns())
}

// ── Stats ────────────────────────────────────────────────────────────────────

func GetWorkflowStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	svc := workflow.GetService()
	types.WriteSuccess(w, "Stats retrieved", svc.GetStats())
}
