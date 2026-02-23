'use client';

import React, { useState, useEffect } from 'react';
import { quotaAPI } from '@/lib/api';

interface QuotaUsage {
  id: number;
  user_id: number;
  type: string;
  period: string;
  period_start: string;
  period_end: string;
  current_usage: number;
  quota_limit: number;
  is_over_limit: boolean;
  overage_amount: number;
}

interface AlertConfiguration {
  email_enabled: boolean;
  webhook_enabled: boolean;
  webhook_url: string;
  slack_enabled: boolean;
  slack_webhook_url: string;
  threshold_warning: number;
  threshold_critical: number;
  threshold_exceeded: number;
}

interface RateLimitEvent {
  id: number;
  user_id: number;
  quota_type: string;
  request_path: string;
  current_usage: number;
  quota_limit: number;
  blocked: boolean;
  message: string;
  created_at: string;
}

export default function QuotaManagementPage() {
  const [quotaUsage, setQuotaUsage] = useState<QuotaUsage[]>([]);
  const [alertConfig, setAlertConfig] = useState<AlertConfiguration>({
    email_enabled: true,
    webhook_enabled: false,
    webhook_url: '',
    slack_enabled: false,
    slack_webhook_url: '',
    threshold_warning: 80,
    threshold_critical: 90,
    threshold_exceeded: 100,
  });
  const [rateLimitEvents, setRateLimitEvents] = useState<RateLimitEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch quota usage
      const usageResponse = await quotaAPI.getMyUsage();
      if (usageResponse.data) {
        setQuotaUsage(usageResponse.data.usage || []);
      }

      // Fetch alert configuration
      const alertResponse = await quotaAPI.getAlertConfig();
      if (alertResponse.data) {
        setAlertConfig(alertResponse.data);
      }

      // Fetch rate limit events
      const eventsResponse = await quotaAPI.getRateLimitEvents(20);
      if (eventsResponse.data) {
        setRateLimitEvents(eventsResponse.data.events || []);
      }
    } catch (error) {
      console.error('Failed to fetch quota data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAlertConfig = async () => {
    try {
      await quotaAPI.updateAlertConfig(alertConfig);
      alert('Alert configuration updated successfully!');
    } catch (error) {
      console.error('Failed to update alert configuration:', error);
      alert('Failed to update alert configuration');
    }
  };

  const getUsagePercentage = (usage: QuotaUsage) => {
    if (usage.quota_limit === 0) return 0;
    return Math.min(100, (usage.current_usage / usage.quota_limit) * 100);
  };

  const getProgressBarColor = (percentage: number) => {
    if (percentage >= 100) return 'bg-red-600';
    if (percentage >= 90) return 'bg-orange-600';
    if (percentage >= 80) return 'bg-yellow-600';
    return 'bg-green-600';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-600">Loading quota data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Quota Management</h1>

        {/* Current Quota Usage */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">📊 Current Usage</h2>

          {quotaUsage.length === 0 ? (
            <p className="text-gray-500">No quota usage data available.</p>
          ) : (
            <div className="space-y-6">
              {quotaUsage.map((usage) => {
                const percentage = getUsagePercentage(usage);
                const progressColor = getProgressBarColor(percentage);

                return (
                  <div key={usage.id} className="border-b border-gray-200 pb-6 last:border-0">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 capitalize">
                          {usage.type} Quota ({usage.period})
                        </h3>
                        <p className="text-sm text-gray-500">
                          Period: {new Date(usage.period_start).toLocaleDateString()} -{' '}
                          {new Date(usage.period_end).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">
                          {usage.current_usage.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-500">
                          of {usage.quota_limit.toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                      <div
                        className={`h-full ${progressColor} transition-all duration-500 flex items-center justify-center text-white text-xs font-semibold`}
                        style={{ width: `${percentage}%` }}
                      >
                        {percentage.toFixed(1)}%
                      </div>
                    </div>

                    {usage.is_over_limit && (
                      <div className="mt-2 bg-red-50 border border-red-200 rounded-md p-3">
                        <p className="text-red-700 text-sm">
                          ⚠️ <strong>Quota Exceeded!</strong> You have exceeded your limit by{' '}
                          {usage.overage_amount.toLocaleString()}.
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Alert Configuration */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">🔔 Alert Configuration</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Email Alerts */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">📧 Email Alerts</h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertConfig.email_enabled}
                    onChange={(e) =>
                      setAlertConfig({ ...alertConfig, email_enabled: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              <p className="text-sm text-gray-500">
                Receive email notifications when quota thresholds are reached.
              </p>
            </div>

            {/* Webhook Alerts */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">🔗 Webhook Alerts</h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertConfig.webhook_enabled}
                    onChange={(e) =>
                      setAlertConfig({ ...alertConfig, webhook_enabled: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              {alertConfig.webhook_enabled && (
                <input
                  type="url"
                  placeholder="https://example.com/webhook"
                  value={alertConfig.webhook_url}
                  onChange={(e) => setAlertConfig({ ...alertConfig, webhook_url: e.target.value })}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              )}
            </div>

            {/* Slack Alerts */}
            <div className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">💬 Slack Alerts</h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertConfig.slack_enabled}
                    onChange={(e) =>
                      setAlertConfig({ ...alertConfig, slack_enabled: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              {alertConfig.slack_enabled && (
                <input
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={alertConfig.slack_webhook_url}
                  onChange={(e) =>
                    setAlertConfig({ ...alertConfig, slack_webhook_url: e.target.value })
                  }
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              )}
            </div>

            {/* Threshold Settings */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3">⚙️ Alert Thresholds</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Warning ({alertConfig.threshold_warning}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={alertConfig.threshold_warning}
                    onChange={(e) =>
                      setAlertConfig({ ...alertConfig, threshold_warning: parseInt(e.target.value) })
                    }
                    className="w-full h-2 bg-yellow-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Critical ({alertConfig.threshold_critical}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={alertConfig.threshold_critical}
                    onChange={(e) =>
                      setAlertConfig({ ...alertConfig, threshold_critical: parseInt(e.target.value) })
                    }
                    className="w-full h-2 bg-orange-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Exceeded ({alertConfig.threshold_exceeded}%)</label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={alertConfig.threshold_exceeded}
                    onChange={(e) =>
                      setAlertConfig({ ...alertConfig, threshold_exceeded: parseInt(e.target.value) })
                    }
                    className="w-full h-2 bg-red-200 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={handleSaveAlertConfig}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
            >
              Save Alert Configuration
            </button>
          </div>
        </div>

        {/* Rate Limit Events */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">🚦 Recent Rate Limit Events</h2>

          {rateLimitEvents.length === 0 ? (
            <p className="text-gray-500">No rate limit events recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Path
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Message
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rateLimitEvents.map((event) => (
                    <tr key={event.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(event.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                        {event.quota_type}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {event.request_path || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {event.current_usage} / {event.quota_limit}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            event.blocked
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {event.blocked ? '🚫 Blocked' : '✅ Allowed'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{event.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
