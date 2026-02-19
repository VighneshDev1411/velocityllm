package quota

import (
	"fmt"
	"time"

	"github.com/VighneshDev1411/velocityllm/internal/billing"

	"gorm.io/gorm"
)

type Service struct {
	db             *gorm.DB
	billingService *billing.Service
}

func NewService(db *gorm.DB, billingService *billing.Service) *Service {
	return &Service{
		db:             db,
		billingService: billingService,
	}
}

// CheckQuota verifies if user is within their quota limits
func (s *Service) CheckQuota(userID uint, quotaType QuotaType) (allowed bool, usage *QuotaUsage, err error) {
	// Get current period
	period := QuotaPeriodMonthly // Default to monthly
	periodStart, periodEnd := s.calculatePeriodBoundaries(period)

	// Get or create quota usage record
	usage = &QuotaUsage{}
	err = s.db.Where(
		"user_id = ? AND type = ? AND period = ? AND period_start = ?",
		userID, quotaType, period, periodStart,
	).FirstOrCreate(usage, &QuotaUsage{
		UserID:      userID,
		Type:        quotaType,
		Period:      period,
		PeriodStart: periodStart,
		PeriodEnd:   periodEnd,
	}).Error

	if err != nil {
		return false, nil, err
	}

	// Get applicable limit (custom quota or tier default)
	limit, err := s.getApplicableLimit(userID, quotaType, period)
	if err != nil {
		return false, nil, err
	}

	usage.QuotaLimit = limit

	// Check if over limit
	if usage.CurrentUsage >= limit {
		usage.IsOverLimit = true
		usage.OverageAmount = usage.CurrentUsage - limit

		// Log rate limit event
		s.logRateLimitEvent(userID, quotaType, usage.CurrentUsage, limit, true)

		return false, usage, nil
	}

	// Check soft limit and send alerts
	s.checkAndSendAlerts(userID, quotaType, usage.CurrentUsage, limit)

	return true, usage, nil
}

// IncrementUsage increments the quota usage for a user
func (s *Service) IncrementUsage(userID uint, quotaType QuotaType, amount int64) error {
	period := QuotaPeriodMonthly
	periodStart, periodEnd := s.calculatePeriodBoundaries(period)

	// Get or create usage record
	usage := &QuotaUsage{}
	err := s.db.Where(
		"user_id = ? AND type = ? AND period = ? AND period_start = ?",
		userID, quotaType, period, periodStart,
	).FirstOrCreate(usage, &QuotaUsage{
		UserID:      userID,
		Type:        quotaType,
		Period:      period,
		PeriodStart: periodStart,
		PeriodEnd:   periodEnd,
	}).Error

	if err != nil {
		return err
	}

	// Increment usage
	return s.db.Model(usage).Updates(map[string]interface{}{
		"current_usage":   gorm.Expr("current_usage + ?", amount),
		"last_checked_at": time.Now(),
	}).Error
}

// getApplicableLimit returns the effective limit for a user
// Priority: Custom quota > Tier default
func (s *Service) getApplicableLimit(userID uint, quotaType QuotaType, period QuotaPeriod) (int64, error) {
	// Check for custom quota
	var customQuota UserQuota
	err := s.db.Where(
		"user_id = ? AND type = ? AND period = ? AND enabled = ?",
		userID, quotaType, period, true,
	).First(&customQuota).Error

	if err == nil {
		return customQuota.Limit, nil
	}

	// Fallback to tier default
	sub, err := s.billingService.GetSubscription(fmt.Sprintf("%d", userID))
	if err != nil {
		// Default to free tier
		return s.getTierDefaultLimit(billing.TierFree, quotaType), nil
	}

	return s.getTierDefaultLimit(sub.Tier, quotaType), nil
}

// getTierDefaultLimit returns default limits for a tier
func (s *Service) getTierDefaultLimit(tier billing.SubscriptionTier, quotaType QuotaType) int64 {
	limits := map[billing.SubscriptionTier]map[QuotaType]int64{
		billing.TierFree: {
			QuotaTypeRequests: 1000,      // 1K requests/month
			QuotaTypeTokens:   100000,    // 100K tokens/month
			QuotaTypeCost:     500,       // $5.00/month (in cents)
		},
		billing.TierPro: {
			QuotaTypeRequests: 50000,     // 50K requests/month
			QuotaTypeTokens:   5000000,   // 5M tokens/month
			QuotaTypeCost:     10000,     // $100.00/month (in cents)
		},
		billing.TierEnterprise: {
			QuotaTypeRequests: 999999999, // Unlimited
			QuotaTypeTokens:   999999999, // Unlimited
			QuotaTypeCost:     999999999, // Unlimited
		},
	}

	if tierLimits, ok := limits[tier]; ok {
		if limit, ok := tierLimits[quotaType]; ok {
			return limit
		}
	}

	// Default to free tier
	return limits[billing.TierFree][quotaType]
}

// SetCustomQuota creates or updates a custom quota for a user
func (s *Service) SetCustomQuota(userID, adminID uint, quotaType QuotaType, period QuotaPeriod, limit int64, reason string) error {
	quota := &UserQuota{
		UserID:    userID,
		Type:      quotaType,
		Period:    period,
		Limit:     limit,
		SoftLimit: int64(float64(limit) * 0.8),  // 80% warning
		HardLimit: int64(float64(limit) * 1.2),  // 120% hard stop (with grace)
		Enabled:   true,
		Reason:    reason,
		CreatedBy: adminID,
	}

	// Upsert
	return s.db.Where(
		"user_id = ? AND type = ? AND period = ?",
		userID, quotaType, period,
	).Assign(quota).FirstOrCreate(quota).Error
}

// GetUserQuotas returns all custom quotas for a user
func (s *Service) GetUserQuotas(userID uint) ([]UserQuota, error) {
	var quotas []UserQuota
	err := s.db.Where("user_id = ?", userID).Find(&quotas).Error
	return quotas, err
}

// GetQuotaUsage returns current usage for a user
func (s *Service) GetQuotaUsage(userID uint) ([]QuotaUsage, error) {
	var usage []QuotaUsage
	err := s.db.Where("user_id = ?", userID).
		Order("period_start DESC").
		Limit(10).
		Find(&usage).Error
	return usage, err
}

// checkAndSendAlerts checks usage thresholds and sends alerts
func (s *Service) checkAndSendAlerts(userID uint, quotaType QuotaType, currentUsage, limit int64) {
	if limit == 0 {
		return
	}

	percentage := int((float64(currentUsage) / float64(limit)) * 100)

	// Get alert configuration
	var config AlertConfiguration
	err := s.db.Where("user_id = ?", userID).FirstOrCreate(&config, &AlertConfiguration{
		UserID:            userID,
		EmailEnabled:      true,
		ThresholdWarning:  80,
		ThresholdCritical: 90,
		ThresholdExceeded: 100,
	}).Error

	if err != nil {
		return
	}

	// Determine which threshold was crossed
	var threshold int
	var message string

	switch {
	case percentage >= config.ThresholdExceeded:
		threshold = config.ThresholdExceeded
		message = fmt.Sprintf("Quota exceeded! You have used %d%% (%d/%d) of your %s quota.", percentage, currentUsage, limit, quotaType)
	case percentage >= config.ThresholdCritical:
		threshold = config.ThresholdCritical
		message = fmt.Sprintf("Critical: You have used %d%% (%d/%d) of your %s quota.", percentage, currentUsage, limit, quotaType)
	case percentage >= config.ThresholdWarning:
		threshold = config.ThresholdWarning
		message = fmt.Sprintf("Warning: You have used %d%% (%d/%d) of your %s quota.", percentage, currentUsage, limit, quotaType)
	default:
		return // No alert needed
	}

	// Check if alert already sent for this threshold
	var existingAlert UsageAlert
	err = s.db.Where(
		"user_id = ? AND quota_type = ? AND threshold = ? AND sent = ? AND created_at > ?",
		userID, quotaType, threshold, true, time.Now().Add(-24*time.Hour),
	).First(&existingAlert).Error

	if err == nil {
		return // Alert already sent in last 24h
	}

	// Create alert
	alert := &UsageAlert{
		UserID:       userID,
		Type:         AlertTypeEmail, // Default to email
		QuotaType:    quotaType,
		Threshold:    threshold,
		Message:      message,
		CurrentUsage: currentUsage,
		QuotaLimit:   limit,
		Sent:         false,
	}

	if err := s.db.Create(alert).Error; err != nil {
		return
	}

	// Send alert (async)
	go s.sendAlert(alert, &config)
}

// sendAlert sends the actual alert notification
func (s *Service) sendAlert(alert *UsageAlert, config *AlertConfiguration) {
	var err error

	// Send email
	if config.EmailEnabled {
		// TODO: Integrate with email service
		// For now, just mark as sent
		fmt.Printf("📧 Email alert sent to user %d: %s\n", alert.UserID, alert.Message)
	}

	// Send webhook
	if config.WebhookEnabled && config.WebhookURL != "" {
		// TODO: Integrate with webhook service
		fmt.Printf("🔔 Webhook sent to %s\n", config.WebhookURL)
	}

	// Send Slack
	if config.SlackEnabled && config.SlackWebhookURL != "" {
		// TODO: Integrate with Slack
		fmt.Printf("💬 Slack alert sent: %s\n", alert.Message)
	}

	// Update alert status
	now := time.Now()
	s.db.Model(alert).Updates(map[string]interface{}{
		"sent":    true,
		"sent_at": &now,
		"error":   err,
	})
}

// logRateLimitEvent logs when a request is blocked due to quota
func (s *Service) logRateLimitEvent(userID uint, quotaType QuotaType, currentUsage, limit int64, blocked bool) {
	event := &RateLimitEvent{
		UserID:       userID,
		QuotaType:    quotaType,
		CurrentUsage: currentUsage,
		QuotaLimit:   limit,
		Blocked:      blocked,
		Message:      fmt.Sprintf("Quota exceeded: %d/%d", currentUsage, limit),
	}

	s.db.Create(event)
}

// GetRateLimitEvents returns recent rate limit events for a user
func (s *Service) GetRateLimitEvents(userID uint, limit int) ([]RateLimitEvent, error) {
	var events []RateLimitEvent
	err := s.db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(limit).
		Find(&events).Error
	return events, err
}

// calculatePeriodBoundaries returns start and end times for a quota period
func (s *Service) calculatePeriodBoundaries(period QuotaPeriod) (start, end time.Time) {
	now := time.Now()

	switch period {
	case QuotaPeriodHourly:
		start = now.Truncate(time.Hour)
		end = start.Add(time.Hour)
	case QuotaPeriodDaily:
		start = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		end = start.AddDate(0, 0, 1)
	case QuotaPeriodWeekly:
		// Start of week (Sunday)
		weekday := int(now.Weekday())
		start = time.Date(now.Year(), now.Month(), now.Day()-weekday, 0, 0, 0, 0, now.Location())
		end = start.AddDate(0, 0, 7)
	case QuotaPeriodMonthly:
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		end = start.AddDate(0, 1, 0)
	default:
		start = time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		end = start.AddDate(0, 1, 0)
	}

	return start, end
}

// ResetQuotaUsage resets usage for a new period (called by cron)
func (s *Service) ResetQuotaUsage() error {
	// This would be called by a cron job to clean up old usage records
	// and create new ones for the new period
	return s.db.Where("period_end < ?", time.Now()).Delete(&QuotaUsage{}).Error
}

// GetAlertConfiguration returns alert preferences for a user
func (s *Service) GetAlertConfiguration(userID uint) (*AlertConfiguration, error) {
	var config AlertConfiguration
	err := s.db.Where("user_id = ?", userID).FirstOrCreate(&config, &AlertConfiguration{
		UserID:            userID,
		EmailEnabled:      true,
		ThresholdWarning:  80,
		ThresholdCritical: 90,
		ThresholdExceeded: 100,
	}).Error
	return &config, err
}

// UpdateAlertConfiguration updates alert preferences
func (s *Service) UpdateAlertConfiguration(userID uint, config *AlertConfiguration) error {
	config.UserID = userID
	return s.db.Where("user_id = ?", userID).
		Assign(config).
		FirstOrCreate(&AlertConfiguration{}).Error
}

// ============================================
// GLOBAL SERVICE SINGLETON
// ============================================

var globalService *Service

func InitGlobalService(db *gorm.DB, billingService *billing.Service) {
	globalService = NewService(db, billingService)
}

// GetGlobalService returns the global quota service
func GetGlobalService() *Service {
	return globalService
}
