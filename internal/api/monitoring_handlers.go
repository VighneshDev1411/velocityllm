package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/monitoring"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

func GetMonitoringStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := monitoring.GetGlobalMonitoring()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "Monitoring not initialized"); return }
	types.WriteSuccess(w, "Monitoring stats retrieved", m.GetStats())
}

func GetMonitoringMetricsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := monitoring.GetGlobalMonitoring()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "Monitoring not initialized"); return }
	metrics := m.GetMetrics()
	types.WriteSuccess(w, "Metrics retrieved", map[string]interface{}{"metrics": metrics, "count": len(metrics)})
}

func GetMonitoringAlertsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := monitoring.GetGlobalMonitoring()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "Monitoring not initialized"); return }
	types.WriteSuccess(w, "Alerts retrieved", map[string]interface{}{"alerts": m.GetAlerts(), "rules": m.GetAlertRules()})
}

func ResolveAlertHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := monitoring.GetGlobalMonitoring()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "Monitoring not initialized"); return }
	var req struct { ID string `json:"id"` }
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" { types.WriteError(w, http.StatusBadRequest, "id required"); return }
	if err := m.ResolveAlert(req.ID); err != nil { types.WriteError(w, http.StatusNotFound, err.Error()); return }
	types.WriteSuccess(w, "Alert resolved", map[string]string{"id": req.ID})
}

func ToggleAlertRuleHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := monitoring.GetGlobalMonitoring()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "Monitoring not initialized"); return }
	var req struct { ID string `json:"id"` }
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ID == "" { types.WriteError(w, http.StatusBadRequest, "id required"); return }
	if err := m.ToggleAlertRule(req.ID); err != nil { types.WriteError(w, http.StatusNotFound, err.Error()); return }
	types.WriteSuccess(w, "Alert rule toggled", map[string]string{"id": req.ID})
}

func GetMonitoringLogsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := monitoring.GetGlobalMonitoring()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "Monitoring not initialized"); return }
	logs := m.GetLogs(50)
	types.WriteSuccess(w, "Logs retrieved", map[string]interface{}{"logs": logs, "count": len(logs)})
}

func GetMonitoringTracesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := monitoring.GetGlobalMonitoring()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "Monitoring not initialized"); return }
	traces := m.GetTraces()
	types.WriteSuccess(w, "Traces retrieved", map[string]interface{}{"traces": traces, "count": len(traces)})
}

func GetMonitoringSLOsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := monitoring.GetGlobalMonitoring()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "Monitoring not initialized"); return }
	slos := m.GetSLOs()
	types.WriteSuccess(w, "SLOs retrieved", map[string]interface{}{"slos": slos, "count": len(slos)})
}
