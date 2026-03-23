package api

import (
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/status"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

func GetStatusStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	s := status.GetGlobalStatus()
	if s == nil { types.WriteError(w, http.StatusServiceUnavailable, "Status not initialized"); return }
	types.WriteSuccess(w, "Status stats retrieved", s.GetStats())
}

func GetStatusComponentsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	s := status.GetGlobalStatus()
	if s == nil { types.WriteError(w, http.StatusServiceUnavailable, "Status not initialized"); return }
	components := s.GetComponents()
	types.WriteSuccess(w, "Components retrieved", map[string]interface{}{"components": components, "count": len(components)})
}

func GetStatusIncidentsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	s := status.GetGlobalStatus()
	if s == nil { types.WriteError(w, http.StatusServiceUnavailable, "Status not initialized"); return }
	incidents := s.GetIncidents()
	types.WriteSuccess(w, "Incidents retrieved", map[string]interface{}{"incidents": incidents, "count": len(incidents)})
}

func GetLaunchChecksHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	s := status.GetGlobalStatus()
	if s == nil { types.WriteError(w, http.StatusServiceUnavailable, "Status not initialized"); return }
	checks := s.GetLaunchChecks()
	types.WriteSuccess(w, "Launch checks retrieved", map[string]interface{}{"checks": checks, "count": len(checks)})
}
