package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/versioning"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

// ── Versions ─────────────────────────────────────────────────────────────────

// ListVersionsHandler GET /api/v1/versioning/versions
func ListVersionsHandler2(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	svc := versioning.GetService()
	types.WriteSuccess(w, "Versions retrieved", svc.ListVersions())
}

type createVersionRequest struct {
	ModelName   string            `json:"model_name"`
	Version     string            `json:"version"`
	Description string            `json:"description"`
	BaseModel   string            `json:"base_model"`
	Config      map[string]string `json:"config"`
}

// CreateVersionHandler POST /api/v1/versioning/versions
func CreateVersionHandler2(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req createVersionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.ModelName == "" || req.Version == "" {
		types.WriteError(w, http.StatusBadRequest, "Model name and version are required")
		return
	}
	if req.BaseModel == "" {
		req.BaseModel = "gpt-4o-mini"
	}
	if req.Config == nil {
		req.Config = make(map[string]string)
	}

	svc := versioning.GetService()
	v := svc.CreateVersion(req.ModelName, req.Version, req.Description, req.BaseModel, req.Config)
	types.WriteSuccess(w, "Version created", v)
}

// GetVersionHandler2 GET /api/v1/versioning/versions/get?id=X
func GetVersionHandler2(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	id := r.URL.Query().Get("id")
	if id == "" {
		types.WriteError(w, http.StatusBadRequest, "ID is required")
		return
	}

	svc := versioning.GetService()
	v := svc.GetVersion(id)
	if v == nil {
		types.WriteError(w, http.StatusNotFound, "Version not found")
		return
	}
	types.WriteSuccess(w, "Version retrieved", v)
}

// PromoteVersionHandler POST /api/v1/versioning/versions/promote
func PromoteVersionHandler(w http.ResponseWriter, r *http.Request) {
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
		types.WriteError(w, http.StatusBadRequest, "Version ID is required")
		return
	}

	svc := versioning.GetService()
	if err := svc.PromoteVersion(req.ID); err != nil {
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	types.WriteSuccess(w, "Version promoted", nil)
}

// ArchiveVersionHandler POST /api/v1/versioning/versions/archive
func ArchiveVersionHandler(w http.ResponseWriter, r *http.Request) {
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
		types.WriteError(w, http.StatusBadRequest, "Version ID is required")
		return
	}

	svc := versioning.GetService()
	if err := svc.ArchiveVersion(req.ID); err != nil {
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	types.WriteSuccess(w, "Version archived", nil)
}

// ── A/B Tests ────────────────────────────────────────────────────────────────

// ListABTestsHandler2 GET /api/v1/versioning/abtests
func ListABTestsHandler2(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	svc := versioning.GetService()
	types.WriteSuccess(w, "A/B tests retrieved", svc.ListABTests())
}

type createABTestRequest struct {
	ModelName    string `json:"model_name"`
	VersionA     string `json:"version_a"`
	VersionB     string `json:"version_b"`
	TrafficSplit int    `json:"traffic_split"`
}

// CreateABTestHandler2 POST /api/v1/versioning/abtests
func CreateABTestHandler2(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req createABTestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.VersionA == "" || req.VersionB == "" {
		types.WriteError(w, http.StatusBadRequest, "Version A and B are required")
		return
	}
	if req.TrafficSplit == 0 {
		req.TrafficSplit = 50
	}

	svc := versioning.GetService()
	test, err := svc.CreateABTest(req.ModelName, req.VersionA, req.VersionB, req.TrafficSplit)
	if err != nil {
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	types.WriteSuccess(w, "A/B test created", test)
}

// StopABTestHandler2 POST /api/v1/versioning/abtests/stop
func StopABTestHandler2(w http.ResponseWriter, r *http.Request) {
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
		types.WriteError(w, http.StatusBadRequest, "Test ID is required")
		return
	}

	svc := versioning.GetService()
	if err := svc.StopABTest(req.ID); err != nil {
		types.WriteError(w, http.StatusBadRequest, err.Error())
		return
	}
	types.WriteSuccess(w, "A/B test stopped", nil)
}

// ── Stats ────────────────────────────────────────────────────────────────────

// GetVersioningStatsHandler GET /api/v1/versioning/stats
func GetVersioningStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	svc := versioning.GetService()
	types.WriteSuccess(w, "Stats retrieved", svc.GetStats())
}
