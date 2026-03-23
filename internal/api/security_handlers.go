package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/security"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

func GetSecurityStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	s := security.GetGlobalSecurity()
	if s == nil { types.WriteError(w, http.StatusServiceUnavailable, "Security not initialized"); return }
	types.WriteSuccess(w, "Security stats retrieved", s.GetStats())
}

func GetSecurityScansHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	s := security.GetGlobalSecurity()
	if s == nil { types.WriteError(w, http.StatusServiceUnavailable, "Security not initialized"); return }
	scans := s.GetScans()
	types.WriteSuccess(w, "Scans retrieved", map[string]interface{}{"scans": scans, "count": len(scans)})
}

func GetVulnerabilitiesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	s := security.GetGlobalSecurity()
	if s == nil { types.WriteError(w, http.StatusServiceUnavailable, "Security not initialized"); return }
	vulns := s.GetVulnerabilities()
	types.WriteSuccess(w, "Vulnerabilities retrieved", map[string]interface{}{"vulnerabilities": vulns, "count": len(vulns)})
}

func GetSecretFindingsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	s := security.GetGlobalSecurity()
	if s == nil { types.WriteError(w, http.StatusServiceUnavailable, "Security not initialized"); return }
	secrets := s.GetSecrets()
	types.WriteSuccess(w, "Secret findings retrieved", map[string]interface{}{"secrets": secrets, "count": len(secrets)})
}

func GetComplianceChecksHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	s := security.GetGlobalSecurity()
	if s == nil { types.WriteError(w, http.StatusServiceUnavailable, "Security not initialized"); return }
	checks := s.GetCompliance()
	types.WriteSuccess(w, "Compliance checks retrieved", map[string]interface{}{"checks": checks, "count": len(checks)})
}

func GetWAFEventsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	s := security.GetGlobalSecurity()
	if s == nil { types.WriteError(w, http.StatusServiceUnavailable, "Security not initialized"); return }
	events := s.GetWAFEvents(50)
	types.WriteSuccess(w, "WAF events retrieved", map[string]interface{}{"events": events, "count": len(events)})
}

func GetSecurityPoliciesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	s := security.GetGlobalSecurity()
	if s == nil { types.WriteError(w, http.StatusServiceUnavailable, "Security not initialized"); return }
	policies := s.GetPolicies()
	types.WriteSuccess(w, "Policies retrieved", map[string]interface{}{"policies": policies, "count": len(policies)})
}

func ToggleSecurityPolicyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	s := security.GetGlobalSecurity()
	if s == nil { types.WriteError(w, http.StatusServiceUnavailable, "Security not initialized"); return }
	var req struct { Name string `json:"name"` }
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" { types.WriteError(w, http.StatusBadRequest, "name required"); return }
	if err := s.TogglePolicy(req.Name); err != nil { types.WriteError(w, http.StatusNotFound, err.Error()); return }
	types.WriteSuccess(w, "Policy toggled", map[string]string{"name": req.Name})
}

func RunSecurityScanHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	s := security.GetGlobalSecurity()
	if s == nil { types.WriteError(w, http.StatusServiceUnavailable, "Security not initialized"); return }
	var req struct { Type string `json:"type"` }
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Type == "" { types.WriteError(w, http.StatusBadRequest, "type required (vulnerability, dependency, sast, container, secret)"); return }
	scan := s.RunScan(req.Type)
	types.WriteSuccess(w, "Scan completed", scan)
}
