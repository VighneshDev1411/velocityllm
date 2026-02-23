package api

import (
	"net/http"
	"runtime"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/auth"
	"github.com/VighneshDev1411/velocityllm/internal/database"
	"github.com/VighneshDev1411/velocityllm/internal/billing"
	"github.com/VighneshDev1411/velocityllm/internal/loadtest"
	"github.com/VighneshDev1411/velocityllm/internal/quota"
	"github.com/VighneshDev1411/velocityllm/internal/webhooks"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
)

var serverStartTime = time.Now()

// ============================================
// ADMIN DASHBOARD ENDPOINTS (Day 25)
// ============================================

// AdminSystemHealthHandler returns comprehensive system health data
func AdminSystemHealthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	health := map[string]interface{}{
		"status":    "healthy",
		"uptime_seconds": int(time.Since(serverStartTime).Seconds()),
		"uptime_human":   time.Since(serverStartTime).String(),
		"go_version":     runtime.Version(),
		"goroutines":     runtime.NumGoroutine(),
		"memory": map[string]interface{}{
			"alloc_mb":       float64(memStats.Alloc) / 1024 / 1024,
			"total_alloc_mb": float64(memStats.TotalAlloc) / 1024 / 1024,
			"sys_mb":         float64(memStats.Sys) / 1024 / 1024,
			"gc_cycles":      memStats.NumGC,
		},
		"cpu_cores": runtime.NumCPU(),
		"timestamp": time.Now(),
	}

	// Check database
	db := database.GetDB()
	sqlDB, err := db.DB()
	if err == nil {
		dbStats := sqlDB.Stats()
		health["database"] = map[string]interface{}{
			"status":           "connected",
			"open_connections": dbStats.OpenConnections,
			"in_use":           dbStats.InUse,
			"idle":             dbStats.Idle,
			"max_open":         dbStats.MaxOpenConnections,
		}
	} else {
		health["database"] = map[string]interface{}{"status": "error", "error": err.Error()}
	}

	types.WriteSuccess(w, "System health retrieved", health)
}

// AdminDashboardOverviewHandler returns aggregated admin dashboard data
func AdminDashboardOverviewHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	db := database.GetDB()

	// User stats
	var totalUsers int64
	var activeUsers int64
	db.Model(&auth.User{}).Count(&totalUsers)
	db.Model(&auth.User{}).Where("is_active = ?", true).Count(&activeUsers)

	// Subscription distribution
	type TierCount struct {
		Tier  string `json:"tier"`
		Count int64  `json:"count"`
	}
	var tierCounts []TierCount
	db.Model(&billing.Subscription{}).
		Select("tier, COUNT(*) as count").
		Where("status = ?", "active").
		Group("tier").
		Scan(&tierCounts)

	// Quota stats
	var overLimitUsers int64
	db.Model(&quota.QuotaUsage{}).Where("is_over_limit = ?", true).Count(&overLimitUsers)

	var rateLimitEvents int64
	db.Model(&quota.RateLimitEvent{}).
		Where("created_at > ?", time.Now().Add(-24*time.Hour)).
		Count(&rateLimitEvents)

	// Webhook stats
	var totalWebhooks int64
	var activeWebhooks int64
	db.Model(&webhooks.WebhookEndpoint{}).Count(&totalWebhooks)
	db.Model(&webhooks.WebhookEndpoint{}).Where("active = ?", true).Count(&activeWebhooks)

	// Load test stats
	var totalTests int64
	var runningTests int64
	db.Model(&loadtest.LoadTestRun{}).Count(&totalTests)
	db.Model(&loadtest.LoadTestRun{}).Where("status = ?", "running").Count(&runningTests)

	// API key stats
	var totalKeys int64
	var activeKeys int64
	db.Model(&auth.APIKey{}).Count(&totalKeys)
	db.Model(&auth.APIKey{}).Where("is_active = ? AND (expires_at IS NULL OR expires_at > ?)", true, time.Now()).Count(&activeKeys)

	// Recent activity
	var recentActivity []auth.ActivityLog
	db.Order("created_at DESC").Limit(10).Find(&recentActivity)

	overview := map[string]interface{}{
		"users": map[string]interface{}{
			"total":   totalUsers,
			"active":  activeUsers,
			"tiers":   tierCounts,
		},
		"quotas": map[string]interface{}{
			"over_limit_users":     overLimitUsers,
			"rate_limit_events_24h": rateLimitEvents,
		},
		"webhooks": map[string]interface{}{
			"total":  totalWebhooks,
			"active": activeWebhooks,
		},
		"load_tests": map[string]interface{}{
			"total":   totalTests,
			"running": runningTests,
		},
		"api_keys": map[string]interface{}{
			"total":  totalKeys,
			"active": activeKeys,
		},
		"recent_activity": recentActivity,
	}

	types.WriteSuccess(w, "Admin dashboard overview", overview)
}

// AdminRecentEventsHandler returns recent system events
func AdminRecentEventsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	db := database.GetDB()

	var events []webhooks.EventLog
	db.Order("created_at DESC").Limit(50).Find(&events)

	types.WriteSuccess(w, "Recent events retrieved", map[string]interface{}{
		"events": events,
	})
}

// AdminDatabaseStatsHandler returns database table statistics
func AdminDatabaseStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	db := database.GetDB()

	type TableStat struct {
		Table string `json:"table"`
		Count int64  `json:"count"`
	}

	tables := []struct {
		Name  string
		Model interface{}
	}{
		{"users", &auth.User{}},
		{"api_keys", &auth.APIKey{}},
		{"subscriptions", &billing.Subscription{}},
		{"user_quotas", &quota.UserQuota{}},
		{"quota_usage", &quota.QuotaUsage{}},
		{"rate_limit_events", &quota.RateLimitEvent{}},
		{"webhook_endpoints", &webhooks.WebhookEndpoint{}},
		{"webhook_deliveries", &webhooks.WebhookDelivery{}},
		{"event_logs", &webhooks.EventLog{}},
		{"load_test_configs", &loadtest.LoadTestConfig{}},
		{"load_test_runs", &loadtest.LoadTestRun{}},
	}

	var stats []TableStat
	for _, t := range tables {
		var count int64
		db.Model(t.Model).Count(&count)
		stats = append(stats, TableStat{Table: t.Name, Count: count})
	}

	types.WriteSuccess(w, "Database stats retrieved", map[string]interface{}{
		"tables": stats,
	})
}
