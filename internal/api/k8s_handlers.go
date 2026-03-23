package api

import (
	"encoding/json"
	"net/http"

	"github.com/VighneshDev1411/velocityllm/internal/k8s"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

func GetK8sStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := k8s.GetGlobalK8s()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "K8s not initialized"); return }
	types.WriteSuccess(w, "K8s stats retrieved", m.GetStats())
}

func GetK8sNodesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := k8s.GetGlobalK8s()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "K8s not initialized"); return }
	nodes := m.GetNodes()
	types.WriteSuccess(w, "Nodes retrieved", map[string]interface{}{"nodes": nodes, "count": len(nodes)})
}

func GetK8sNamespacesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := k8s.GetGlobalK8s()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "K8s not initialized"); return }
	ns := m.GetNamespaces()
	types.WriteSuccess(w, "Namespaces retrieved", map[string]interface{}{"namespaces": ns, "count": len(ns)})
}

func GetK8sDeploymentsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := k8s.GetGlobalK8s()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "K8s not initialized"); return }
	ns := r.URL.Query().Get("namespace")
	deps := m.GetDeployments(ns)
	types.WriteSuccess(w, "Deployments retrieved", map[string]interface{}{"deployments": deps, "count": len(deps)})
}

func GetK8sPodsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := k8s.GetGlobalK8s()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "K8s not initialized"); return }
	ns := r.URL.Query().Get("namespace")
	pods := m.GetPods(ns)
	types.WriteSuccess(w, "Pods retrieved", map[string]interface{}{"pods": pods, "count": len(pods)})
}

func GetK8sServicesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := k8s.GetGlobalK8s()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "K8s not initialized"); return }
	ns := r.URL.Query().Get("namespace")
	svcs := m.GetServices(ns)
	types.WriteSuccess(w, "Services retrieved", map[string]interface{}{"services": svcs, "count": len(svcs)})
}

func GetK8sHPAsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := k8s.GetGlobalK8s()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "K8s not initialized"); return }
	ns := r.URL.Query().Get("namespace")
	hpas := m.GetHPAs(ns)
	types.WriteSuccess(w, "HPAs retrieved", map[string]interface{}{"hpas": hpas, "count": len(hpas)})
}

func GetK8sEventsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := k8s.GetGlobalK8s()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "K8s not initialized"); return }
	events := m.GetEvents()
	types.WriteSuccess(w, "Events retrieved", map[string]interface{}{"events": events, "count": len(events)})
}

func ScaleK8sDeploymentHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := k8s.GetGlobalK8s()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "K8s not initialized"); return }
	var req struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace"`
		Replicas  int    `json:"replicas"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" { types.WriteError(w, http.StatusBadRequest, "name required"); return }
	if req.Namespace == "" { req.Namespace = "velocityllm" }
	if err := m.ScaleDeployment(req.Name, req.Namespace, req.Replicas); err != nil { types.WriteError(w, http.StatusNotFound, err.Error()); return }
	types.WriteSuccess(w, "Deployment scaled", map[string]interface{}{"name": req.Name, "namespace": req.Namespace, "replicas": req.Replicas})
}

func RestartK8sDeploymentHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed"); return }
	m := k8s.GetGlobalK8s()
	if m == nil { types.WriteError(w, http.StatusServiceUnavailable, "K8s not initialized"); return }
	var req struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Name == "" { types.WriteError(w, http.StatusBadRequest, "name required"); return }
	if req.Namespace == "" { req.Namespace = "velocityllm" }
	if err := m.RestartDeployment(req.Name, req.Namespace); err != nil { types.WriteError(w, http.StatusNotFound, err.Error()); return }
	types.WriteSuccess(w, "Deployment restarted", map[string]string{"name": req.Name, "namespace": req.Namespace})
}
