package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/cache"
	"github.com/VighneshDev1411/velocityllm/internal/cluster"
	"github.com/VighneshDev1411/velocityllm/internal/database"
)

// readyTime records when the server finished initialisation.
var readyTime time.Time

// MarkReady is called from main.go once all components are initialised.
func MarkReady() { readyTime = time.Now() }

// LivenessHandler answers Kubernetes / load-balancer liveness probes.
// Returns 200 as long as the Go process is alive.
// GET /health/live
func LivenessHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "alive",
		"timestamp": time.Now().UTC(),
	})
}

// ReadinessHandler answers Kubernetes / load-balancer readiness probes.
// Returns 200 only when all dependencies are reachable AND the node is not
// draining (i.e. it is safe to send new traffic here).
// GET /health/ready
func ReadinessHandler(w http.ResponseWriter, r *http.Request) {
	issues := []string{}
	status := http.StatusOK

	// Check database
	if err := database.HealthCheck(); err != nil {
		issues = append(issues, "database: "+err.Error())
		status = http.StatusServiceUnavailable
	}

	// Check Redis
	if err := cache.HealthCheck(); err != nil {
		issues = append(issues, "redis: "+err.Error())
		status = http.StatusServiceUnavailable
	}

	// Check node drain state
	if reg := cluster.GetGlobalNodeRegistry(); reg != nil {
		info := reg.GetNodeInfo()
		if info.Status == "draining" || info.Status == "stopped" {
			issues = append(issues, "node is "+string(info.Status))
			status = http.StatusServiceUnavailable
		}
	}

	ready := status == http.StatusOK
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"ready":     ready,
		"timestamp": time.Now().UTC(),
		"issues":    issues,
	})
}

// StartupHandler answers Kubernetes startup probes.
// Returns 200 only after initialisation is complete (MarkReady has been called).
// GET /health/startup
func StartupHandler(w http.ResponseWriter, r *http.Request) {
	if readyTime.IsZero() {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"started":   false,
			"timestamp": time.Now().UTC(),
		})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"started":    true,
		"ready_at":   readyTime.UTC(),
		"startup_ms": time.Since(readyTime).Milliseconds(),
		"timestamp":  time.Now().UTC(),
	})
}
