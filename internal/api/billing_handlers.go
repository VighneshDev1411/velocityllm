package api

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/auth"
	"github.com/VighneshDev1411/velocityllm/internal/billing"
	"github.com/VighneshDev1411/velocityllm/pkg/types"
	"github.com/VighneshDev1411/velocityllm/pkg/utils"
)

var billingService *billing.Service

// InitBillingService initializes the global billing service
func InitBillingService(service *billing.Service) {
	billingService = service
}

// ============================================
// BILLING & USAGE TRACKING HANDLERS (Day 21)
// ============================================

// GetSubscriptionHandler returns the user's current subscription
func GetSubscriptionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	user := auth.GetUserFromContext(r.Context())
	if user == nil {
		types.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	sub, err := billingService.GetSubscription(user.ID)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	limits := billing.GetTierLimits(sub.Tier)

	types.WriteSuccess(w, "Subscription retrieved", map[string]interface{}{
		"subscription": sub,
		"limits":       limits,
	})
}

// UpdateSubscriptionHandler changes a user's subscription tier
func UpdateSubscriptionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	user := auth.GetUserFromContext(r.Context())
	if user == nil {
		types.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req struct {
		Tier string `json:"tier"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		types.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	validTiers := map[string]bool{"free": true, "pro": true, "enterprise": true}
	if !validTiers[req.Tier] {
		types.WriteError(w, http.StatusBadRequest, "Invalid tier. Must be: free, pro, or enterprise")
		return
	}

	if err := billingService.UpdateSubscription(user.ID, billing.SubscriptionTier(req.Tier)); err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.Info("Subscription updated", "user_id", user.ID, "tier", req.Tier)
	types.WriteSuccess(w, "Subscription updated", nil)
}

// GetUsageStatsHandler returns usage statistics for the current billing period
func GetUsageStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	user := auth.GetUserFromContext(r.Context())
	if user == nil {
		types.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	sub, err := billingService.GetSubscription(user.ID)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	stats, err := billingService.GetUsageStats(user.ID, sub.BillingCycleStart, sub.BillingCycleEnd)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Get usage percentage
	pct, err := billingService.GetUsagePercentage(user.ID)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	types.WriteSuccess(w, "Usage stats retrieved", map[string]interface{}{
		"stats":              stats,
		"usage_percentage":   pct,
		"billing_cycle_end":  sub.BillingCycleEnd,
	})
}

// GenerateInvoiceHandler creates an invoice for the current billing period
func GenerateInvoiceHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	user := auth.GetUserFromContext(r.Context())
	if user == nil {
		types.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	invoice, err := billingService.GenerateInvoice(user.ID)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	utils.Info("Invoice generated", "user_id", user.ID, "invoice_id", invoice.ID, "amount", invoice.Amount)
	types.WriteSuccess(w, "Invoice generated", invoice)
}

// ListInvoicesHandler returns all invoices for the user
func ListInvoicesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	user := auth.GetUserFromContext(r.Context())
	if user == nil {
		types.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	invoices, err := billingService.ListInvoices(user.ID, 12)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	types.WriteSuccess(w, "Invoices retrieved", map[string]interface{}{
		"invoices": invoices,
		"count":    len(invoices),
	})
}

// GetUsageHistoryHandler returns historical usage data with daily breakdown
func GetUsageHistoryHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	user := auth.GetUserFromContext(r.Context())
	if user == nil {
		types.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Get usage for last 30 days
	end := time.Now()
	start := end.AddDate(0, 0, -30)

	stats, err := billingService.GetUsageStats(user.ID, start, end)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	daily, err := billingService.GetDailyUsage(user.ID, start, end)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	types.WriteSuccess(w, "Usage history retrieved", map[string]interface{}{
		"summary": stats,
		"daily":   daily,
	})
}

// ExportUsageHandler exports usage data as CSV or JSON
func ExportUsageHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		types.WriteError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	user := auth.GetUserFromContext(r.Context())
	if user == nil {
		types.WriteError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}

	sub, err := billingService.GetSubscription(user.ID)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	stats, err := billingService.GetUsageStats(user.ID, sub.BillingCycleStart, sub.BillingCycleEnd)
	if err != nil {
		types.WriteError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if format == "csv" {
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", "attachment; filename=usage.csv")
		// Simple CSV output
		w.Write([]byte("metric,value\n"))
		w.Write([]byte("total_requests," + utils.ToString(stats["total_requests"]) + "\n"))
		w.Write([]byte("total_tokens," + utils.ToString(stats["total_tokens"]) + "\n"))
		w.Write([]byte("total_cost," + utils.ToString(stats["total_cost"]) + "\n"))
	} else {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", "attachment; filename=usage.json")
		json.NewEncoder(w).Encode(stats)
	}
}
