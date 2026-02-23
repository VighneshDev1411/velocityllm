package billing

import (
	"encoding/json"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// RecordUsage records a usage event for billing
func (s *Service) RecordUsage(userID, apiKeyID, model string, tokens int) error {
	cost := CalculateCost(model, tokens)
	usage := &UsageRecord{
		UserID:    userID,
		APIKeyID:  apiKeyID,
		Model:     model,
		Tokens:    tokens,
		Cost:      cost,
		Timestamp: time.Now(),
	}
	return s.db.Create(usage).Error
}

// GetUsageStats returns usage statistics for a user in a given period
func (s *Service) GetUsageStats(userID string, start, end time.Time) (map[string]interface{}, error) {
	var totalTokens int64
	var totalCost float64
	var totalRequests int64

	s.db.Model(&UsageRecord{}).
		Where("user_id = ? AND timestamp >= ? AND timestamp <= ?", userID, start, end).
		Count(&totalRequests)

	s.db.Model(&UsageRecord{}).
		Where("user_id = ? AND timestamp >= ? AND timestamp <= ?", userID, start, end).
		Select("COALESCE(SUM(tokens), 0)").Scan(&totalTokens)

	s.db.Model(&UsageRecord{}).
		Where("user_id = ? AND timestamp >= ? AND timestamp <= ?", userID, start, end).
		Select("COALESCE(SUM(cost), 0)").Scan(&totalCost)

	// Usage by model
	type ModelUsage struct {
		Model    string  `json:"model"`
		Tokens   int64   `json:"tokens"`
		Requests int64   `json:"requests"`
		Cost     float64 `json:"cost"`
	}
	var byModel []ModelUsage
	s.db.Model(&UsageRecord{}).
		Select("model, SUM(tokens) as tokens, COUNT(*) as requests, SUM(cost) as cost").
		Where("user_id = ? AND timestamp >= ? AND timestamp <= ?", userID, start, end).
		Group("model").
		Scan(&byModel)

	return map[string]interface{}{
		"total_requests": totalRequests,
		"total_tokens":   totalTokens,
		"total_cost":     totalCost,
		"by_model":       byModel,
		"period_start":   start,
		"period_end":     end,
	}, nil
}

// GetSubscription returns a user's current subscription
func (s *Service) GetSubscription(userID string) (*Subscription, error) {
	var sub Subscription
	err := s.db.Where("user_id = ? AND status = ?", userID, "active").First(&sub).Error
	if err == gorm.ErrRecordNotFound {
		// Create default free subscription
		sub = Subscription{
			UserID:            userID,
			Tier:              TierFree,
			Status:            "active",
			BillingCycleStart: time.Now().Truncate(24 * time.Hour),
			BillingCycleEnd:   time.Now().AddDate(0, 1, 0).Truncate(24 * time.Hour),
		}
		if err := s.db.Create(&sub).Error; err != nil {
			return nil, err
		}
		return &sub, nil
	}
	return &sub, err
}

// UpdateSubscription updates a user's subscription tier
func (s *Service) UpdateSubscription(userID string, tier SubscriptionTier) error {
	sub, err := s.GetSubscription(userID)
	if err != nil {
		return err
	}

	// Update tier and reset billing cycle
	sub.Tier = tier
	sub.BillingCycleStart = time.Now().Truncate(24 * time.Hour)
	sub.BillingCycleEnd = time.Now().AddDate(0, 1, 0).Truncate(24 * time.Hour)

	return s.db.Save(sub).Error
}

// GenerateInvoice creates an invoice for a user's usage in the current billing cycle
func (s *Service) GenerateInvoice(userID string) (*Invoice, error) {
	sub, err := s.GetSubscription(userID)
	if err != nil {
		return nil, err
	}

	// Get usage for the billing period
	stats, err := s.GetUsageStats(userID, sub.BillingCycleStart, sub.BillingCycleEnd)
	if err != nil {
		return nil, err
	}

	totalCost := stats["total_cost"].(float64)
	tierLimits := GetTierLimits(sub.Tier)

	// Build invoice items
	type InvoiceItem struct {
		Description string  `json:"description"`
		Quantity    int64   `json:"quantity"`
		UnitPrice   float64 `json:"unit_price"`
		Amount      float64 `json:"amount"`
	}

	items := []InvoiceItem{
		{
			Description: fmt.Sprintf("%s Subscription", sub.Tier),
			Quantity:    1,
			UnitPrice:   tierLimits.PricePerMonth,
			Amount:      tierLimits.PricePerMonth,
		},
	}

	// Add usage overage charges if applicable
	if sub.Tier != TierEnterprise {
		totalTokens := stats["total_tokens"].(int64)
		if tierLimits.TokensPerMonth > 0 && totalTokens > int64(tierLimits.TokensPerMonth) {
			overageTokens := totalTokens - int64(tierLimits.TokensPerMonth)
			overageCost := float64(overageTokens) / 1000000.0 * 0.015 // $15 per 1M overage tokens
			items = append(items, InvoiceItem{
				Description: "Token Overage",
				Quantity:    overageTokens,
				UnitPrice:   0.015,
				Amount:      overageCost,
			})
			totalCost += overageCost
		}
	}

	itemsJSON, _ := json.Marshal(items)

	invoice := &Invoice{
		UserID:      userID,
		Amount:      totalCost + tierLimits.PricePerMonth,
		Currency:    "usd",
		Status:      "pending",
		PeriodStart: sub.BillingCycleStart,
		PeriodEnd:   sub.BillingCycleEnd,
		DueDate:     sub.BillingCycleEnd.AddDate(0, 0, 7), // 7 days after cycle end
		Items:       string(itemsJSON),
	}

	if err := s.db.Create(invoice).Error; err != nil {
		return nil, err
	}

	return invoice, nil
}

// ListInvoices returns all invoices for a user
func (s *Service) ListInvoices(userID string, limit int) ([]Invoice, error) {
	var invoices []Invoice
	if limit <= 0 {
		limit = 12
	}
	err := s.db.Where("user_id = ?", userID).Order("created_at DESC").Limit(limit).Find(&invoices).Error
	return invoices, err
}

// MarkInvoicePaid marks an invoice as paid
func (s *Service) MarkInvoicePaid(invoiceID string) error {
	now := time.Now()
	return s.db.Model(&Invoice{}).Where("id = ?", invoiceID).Updates(map[string]interface{}{
		"status":  "paid",
		"paid_at": now,
	}).Error
}

// DailyUsage represents usage data for a single day
type DailyUsage struct {
	Date     string  `json:"date"`
	Requests int64   `json:"requests"`
	Tokens   int64   `json:"tokens"`
	Cost     float64 `json:"cost"`
}

// GetDailyUsage returns per-day usage breakdown for a user in a given period
func (s *Service) GetDailyUsage(userID string, start, end time.Time) ([]DailyUsage, error) {
	var results []DailyUsage
	err := s.db.Model(&UsageRecord{}).
		Select("DATE(timestamp) as date, COUNT(*) as requests, COALESCE(SUM(tokens), 0) as tokens, COALESCE(SUM(cost), 0) as cost").
		Where("user_id = ? AND timestamp >= ? AND timestamp <= ?", userID, start, end).
		Group("DATE(timestamp)").
		Order("date ASC").
		Scan(&results).Error
	if err != nil {
		return nil, err
	}

	// Fill in missing days with zeros
	dayMap := make(map[string]DailyUsage)
	for _, r := range results {
		dayMap[r.Date] = r
	}

	var filled []DailyUsage
	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		key := d.Format("2006-01-02")
		if usage, ok := dayMap[key]; ok {
			filled = append(filled, usage)
		} else {
			filled = append(filled, DailyUsage{Date: key, Requests: 0, Tokens: 0, Cost: 0})
		}
	}

	return filled, nil
}

// CheckUsageLimits checks if a user has exceeded their tier limits
func (s *Service) CheckUsageLimits(userID string) (bool, string, error) {
	sub, err := s.GetSubscription(userID)
	if err != nil {
		return true, "", err
	}

	if sub.Tier == TierEnterprise {
		return true, "", nil // unlimited
	}

	limits := GetTierLimits(sub.Tier)
	stats, err := s.GetUsageStats(userID, sub.BillingCycleStart, sub.BillingCycleEnd)
	if err != nil {
		return true, "", err
	}

	totalRequests := stats["total_requests"].(int64)
	totalTokens := stats["total_tokens"].(int64)

	if limits.RequestsPerMonth > 0 && totalRequests >= int64(limits.RequestsPerMonth) {
		return false, "Monthly request limit exceeded", nil
	}

	if limits.TokensPerMonth > 0 && totalTokens >= int64(limits.TokensPerMonth) {
		return false, "Monthly token limit exceeded", nil
	}

	return true, "", nil
}

// GetUsagePercentage returns the percentage of tier limits used
func (s *Service) GetUsagePercentage(userID string) (map[string]float64, error) {
	sub, err := s.GetSubscription(userID)
	if err != nil {
		return nil, err
	}

	if sub.Tier == TierEnterprise {
		return map[string]float64{"requests": 0, "tokens": 0}, nil // unlimited
	}

	limits := GetTierLimits(sub.Tier)
	stats, err := s.GetUsageStats(userID, sub.BillingCycleStart, sub.BillingCycleEnd)
	if err != nil {
		return nil, err
	}

	totalRequests := stats["total_requests"].(int64)
	totalTokens := stats["total_tokens"].(int64)

	requestsPct := 0.0
	if limits.RequestsPerMonth > 0 {
		requestsPct = float64(totalRequests) / float64(limits.RequestsPerMonth) * 100
	}

	tokensPct := 0.0
	if limits.TokensPerMonth > 0 {
		tokensPct = float64(totalTokens) / float64(limits.TokensPerMonth) * 100
	}

	return map[string]float64{
		"requests": requestsPct,
		"tokens":   tokensPct,
	}, nil
}
