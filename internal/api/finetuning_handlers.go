package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/finetuning"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// ── Datasets ─────────────────────────────────────────────────────────────────

// ListDatasetsHandler GET /api/v1/finetuning/datasets
func ListDatasetsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	svc := finetuning.GetService()
	types.WriteSuccess(w, "Datasets retrieved", svc.ListDatasets())
}

type createDatasetRequest struct {
	Name        string              `json:"name"`
	Description string              `json:"description"`
	Format      string              `json:"format"`
	Examples    []finetuning.Example `json:"examples"`
}

// CreateDatasetHandler POST /api/v1/finetuning/datasets
func CreateDatasetHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req createDatasetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Name == "" {
		types.WriteError(w, http.StatusBadRequest, "Name is required")
		return
	}
	if req.Format == "" {
		req.Format = "jsonl"
	}

	svc := finetuning.GetService()
	ds := svc.CreateDataset(req.Name, req.Description, req.Format, req.Examples)
	types.WriteSuccess(w, "Dataset created", ds)
}

// GetDatasetHandler GET /api/v1/finetuning/datasets/get?id=X
func GetDatasetHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	id := r.URL.Query().Get("id")
	if id == "" {
		types.WriteError(w, http.StatusBadRequest, "ID is required")
		return
	}

	svc := finetuning.GetService()
	ds := svc.GetDataset(id)
	if ds == nil {
		types.WriteError(w, http.StatusNotFound, "Dataset not found")
		return
	}
	types.WriteSuccess(w, "Dataset retrieved", ds)
}

// DeleteDatasetHandler DELETE /api/v1/finetuning/datasets/delete?id=X
func DeleteDatasetHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	id := r.URL.Query().Get("id")
	if id == "" {
		types.WriteError(w, http.StatusBadRequest, "ID is required")
		return
	}

	svc := finetuning.GetService()
	if !svc.DeleteDataset(id) {
		types.WriteError(w, http.StatusNotFound, "Dataset not found")
		return
	}
	types.WriteSuccess(w, "Dataset deleted", nil)
}

// ── Jobs ─────────────────────────────────────────────────────────────────────

// ListJobsHandler GET /api/v1/finetuning/jobs
func ListJobsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	svc := finetuning.GetService()
	types.WriteSuccess(w, "Jobs retrieved", svc.ListJobs())
}

type createJobRequest struct {
	DatasetID    string  `json:"dataset_id"`
	BaseModel    string  `json:"base_model"`
	Epochs       int     `json:"epochs"`
	LearningRate float64 `json:"learning_rate"`
	BatchSize    int     `json:"batch_size"`
}

// CreateJobHandler POST /api/v1/finetuning/jobs
func CreateJobHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req createJobRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.DatasetID == "" {
		types.WriteError(w, http.StatusBadRequest, "Dataset ID is required")
		return
	}
	if req.BaseModel == "" {
		req.BaseModel = "gpt-4o-mini"
	}
	if req.Epochs <= 0 {
		req.Epochs = 3
	}
	if req.LearningRate <= 0 {
		req.LearningRate = 0.0001
	}
	if req.BatchSize <= 0 {
		req.BatchSize = 4
	}

	svc := finetuning.GetService()
	job, err := svc.CreateJob(req.DatasetID, req.BaseModel, finetuning.JobConfig{
		Epochs:       req.Epochs,
		LearningRate: req.LearningRate,
		BatchSize:    req.BatchSize,
	})
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	types.WriteSuccess(w, "Job created", job)
}

// CancelJobHandler POST /api/v1/finetuning/jobs/cancel
func CancelJobHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.ID == "" {
		types.WriteError(w, http.StatusBadRequest, "Job ID is required")
		return
	}

	svc := finetuning.GetService()
	if !svc.CancelJob(req.ID) {
		types.WriteError(w, http.StatusBadRequest, "Job not found or already finished")
		return
	}
	types.WriteSuccess(w, "Job cancelled", nil)
}

// ── Models ───────────────────────────────────────────────────────────────────

// ListFineTunedModelsHandler GET /api/v1/finetuning/models
func ListFineTunedModelsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	svc := finetuning.GetService()
	types.WriteSuccess(w, "Models retrieved", svc.ListModels())
}

// ── Stats ────────────────────────────────────────────────────────────────────

// GetFineTuningStatsHandler GET /api/v1/finetuning/stats
func GetFineTuningStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	svc := finetuning.GetService()
	types.WriteSuccess(w, "Stats retrieved", svc.GetStats())
}
