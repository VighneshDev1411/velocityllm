package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/hosting"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// GetHostingStatsHandler returns hosting statistics (Day 54)
func GetHostingStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	m := hosting.GetGlobalHosting()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Hosting not initialized")
		return
	}
	types.WriteSuccess(w, "Hosting stats retrieved", m.GetStats())
}

// GetHostedModelsHandler returns all hosted models (Day 54)
func GetHostedModelsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	m := hosting.GetGlobalHosting()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Hosting not initialized")
		return
	}
	models := m.GetModels()
	types.WriteSuccess(w, "Hosted models retrieved", map[string]interface{}{
		"models": models,
		"count":  len(models),
	})
}

// GetHostedModelHandler returns a single hosted model (Day 54)
func GetHostedModelHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	m := hosting.GetGlobalHosting()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Hosting not initialized")
		return
	}
	id := r.URL.Query().Get("id")
	if id == "" {
		types.WriteError(w, http.StatusBadRequest, "id parameter required")
		return
	}
	model := m.GetModel(id)
	if model == nil {
		types.WriteError(w, http.StatusNotFound, "Model not found")
		return
	}
	types.WriteSuccess(w, "Model retrieved", model)
}

// DeployModelHandler deploys a new custom model (Day 54)
func DeployModelHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	m := hosting.GetGlobalHosting()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Hosting not initialized")
		return
	}
	var req hosting.DeployRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" || req.ModelPath == "" {
		types.WriteError(w, http.StatusBadRequest, "name and model_path required")
		return
	}
	if req.Framework == "" {
		req.Framework = "pytorch"
	}
	if req.ModelSource == "" {
		req.ModelSource = "huggingface"
	}
	if req.GPU == "" {
		req.GPU = hosting.GPUT4
	}
	if req.MaxBatchSize == 0 {
		req.MaxBatchSize = 16
	}
	if req.MaxSequenceLen == 0 {
		req.MaxSequenceLen = 4096
	}
	model := m.DeployModel(req)
	types.WriteSuccess(w, "Model deployed", model)
}

// ScaleModelHandler adjusts model replicas (Day 54)
func ScaleModelHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	m := hosting.GetGlobalHosting()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Hosting not initialized")
		return
	}
	var req struct {
		ID       string `json:"id"`
		Replicas int    `json:"replicas"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
		types.WriteError(w, http.StatusBadRequest, "id required")
		return
	}
	if err := m.ScaleModel(req.ID, req.Replicas); err != nil {
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	types.WriteSuccess(w, "Model scaled", map[string]interface{}{
		"id":       req.ID,
		"replicas": req.Replicas,
	})
}

// StopModelHandler stops a model (Day 54)
func StopHostedModelHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	m := hosting.GetGlobalHosting()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Hosting not initialized")
		return
	}
	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
		types.WriteError(w, http.StatusBadRequest, "id required")
		return
	}
	if err := m.StopModel(req.ID); err != nil {
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	types.WriteSuccess(w, "Model stopped", map[string]string{"id": req.ID})
}

// StartModelHandler starts a stopped model (Day 54)
func StartHostedModelHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	m := hosting.GetGlobalHosting()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Hosting not initialized")
		return
	}
	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
		types.WriteError(w, http.StatusBadRequest, "id required")
		return
	}
	if err := m.StartModel(req.ID); err != nil {
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	types.WriteSuccess(w, "Model started", map[string]string{"id": req.ID})
}

// DeleteModelHandler deletes a model deployment (Day 54)
func DeleteHostedModelHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	m := hosting.GetGlobalHosting()
	if m == nil {
		types.WriteError(w, http.StatusServiceUnavailable, "Hosting not initialized")
		return
	}
	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" {
		types.WriteError(w, http.StatusBadRequest, "id required")
		return
	}
	if err := m.DeleteModel(req.ID); err != nil {
		types.WriteError(w, http.StatusNotFound, err.Error())
		return
	}
	types.WriteSuccess(w, "Model deleted", map[string]string{"id": req.ID})
}
