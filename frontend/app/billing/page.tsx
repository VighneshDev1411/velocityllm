'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { billingAPI } from '@/lib/api';
import {
  CreditCard, TrendingUp, DollarSign, Calendar, Download,
  Check, AlertTriangle, Zap, Crown, Shield
} from 'lucide-react';

interface Subscription {
  id: string;
  tier: string;
  status: string;
  billing_cycle_start: string;
  billing_cycle_end: string;
}

interface TierLimits {
  requests_per_month: number;
  tokens_per_month: number;
  max_api_keys: number;
  support_level: string;
  price_per_month: number;
}

interface UsageStats {
  total_requests: number;
  total_tokens: number;
  total_cost: number;
  by_model: Array<{
    model: string;
    tokens: number;
    requests: number;
    cost: number;
  }>;
}

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  period_start: string;
  period_end: string;
  created_at: string;
  paid_at: string | null;
}

const TIER_INFO = {
  free: {
    name: 'Free',
    color: 'text-gray-700',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    icon: Shield,
    features: ['1K requests/month', '100K tokens/month', '2 API keys', 'Community support'],
  },
  pro: {
    name: 'Pro',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: Zap,
    features: ['50K requests/month', '5M tokens/month', '10 API keys', 'Email support'],
  },
  enterprise: {
    name: 'Enterprise',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    icon: Crown,
    features: ['Unlimited requests', 'Unlimited tokens', 'Unlimited API keys', 'Priority support'],
  },
};

export default function BillingPage() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [limits, setLimits] = useState<TierLimits | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [usagePercentage, setUsagePercentage] = useState<{ requests: number; tokens: number } | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, usageRes, invoicesRes] = await Promise.all([
        billingAPI.getSubscription(),
        billingAPI.getUsage(),
        billingAPI.listInvoices(),
      ]);

      if (subRes.data?.data?.subscription) {
        setSubscription(subRes.data.data.subscription);
      }
      if (subRes.data?.data?.limits) {
        setLimits(subRes.data.data.limits);
      }
      if (usageRes.data?.data?.stats) {
        setUsage(usageRes.data.data.stats);
      }
      if (usageRes.data?.data?.usage_percentage) {
        setUsagePercentage(usageRes.data.data.usage_percentage);
      }
      if (invoicesRes.data?.data?.invoices) {
        setInvoices(invoicesRes.data.data.invoices);
      }
    } catch (err: any) {
      console.error('Failed to fetch billing data:', err);
      setError('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpgrade = async (tier: string) => {
    try {
      setError('');
      await billingAPI.updateSubscription(tier);
      setSuccess(`Upgraded to ${TIER_INFO[tier as keyof typeof TIER_INFO].name}!`);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update subscription');
    }
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const res = await billingAPI.exportUsage(format);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: format === 'csv' ? 'text/csv' : 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `usage.${format}`;
      a.click();
    } catch (err) {
      setError('Failed to export usage data');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const currentTier = subscription?.tier || 'free';
  const tierInfo = TIER_INFO[currentTier as keyof typeof TIER_INFO];
  const TierIcon = tierInfo.icon;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-blue-600" />
            Billing & Usage
          </h1>
          <p className="text-gray-500 mt-1">Manage your subscription and track usage</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl border p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <>
            {/* Current Plan */}
            <div className={`mb-8 p-6 rounded-xl border-2 ${tierInfo.border} ${tierInfo.bg}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${tierInfo.bg} border ${tierInfo.border} flex items-center justify-center`}>
                    <TierIcon className={`w-6 h-6 ${tierInfo.color}`} />
                  </div>
                  <div>
                    <h2 className={`text-2xl font-bold ${tierInfo.color}`}>{tierInfo.name} Plan</h2>
                    <p className="text-sm text-gray-600">
                      Billing cycle: {subscription && formatDate(subscription.billing_cycle_start)} - {subscription && formatDate(subscription.billing_cycle_end)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900">
                    {limits?.price_per_month === 0 ? 'Free' : formatCurrency(limits?.price_per_month || 0)}
                  </div>
                  <div className="text-sm text-gray-500">per month</div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {tierInfo.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                    <Check className="w-4 h-4 text-green-600" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            {/* Usage Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-gray-500">Requests</div>
                  <TrendingUp className="w-5 h-5 text-gray-400" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {usage?.total_requests.toLocaleString() || 0}
                </div>
                {limits && limits.requests_per_month > 0 && (
                  <>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min((usagePercentage?.requests || 0), 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500">
                      {((usagePercentage?.requests || 0)).toFixed(1)}% of {limits.requests_per_month.toLocaleString()} limit
                    </div>
                  </>
                )}
              </div>

              <div className="bg-white rounded-xl border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-gray-500">Tokens</div>
                  <Zap className="w-5 h-5 text-gray-400" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {usage?.total_tokens.toLocaleString() || 0}
                </div>
                {limits && limits.tokens_per_month > 0 && (
                  <>
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min((usagePercentage?.tokens || 0), 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500">
                      {((usagePercentage?.tokens || 0)).toFixed(1)}% of {limits.tokens_per_month.toLocaleString()} limit
                    </div>
                  </>
                )}
              </div>

              <div className="bg-white rounded-xl border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-sm font-medium text-gray-500">Total Cost</div>
                  <DollarSign className="w-5 h-5 text-gray-400" />
                </div>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {formatCurrency(usage?.total_cost || 0)}
                </div>
                <div className="text-xs text-gray-500">This billing cycle</div>
              </div>
            </div>

            {/* Upgrade Options */}
            {currentTier !== 'enterprise' && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Upgrade Your Plan</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Object.entries(TIER_INFO).filter(([tier]) => tier !== currentTier && tier !== 'free').map(([tier, info]) => {
                    const Icon = info.icon;
                    return (
                      <div key={tier} className={`p-6 rounded-xl border-2 ${info.border} bg-white hover:shadow-lg transition`}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-10 h-10 rounded-lg ${info.bg} border ${info.border} flex items-center justify-center`}>
                            <Icon className={`w-5 h-5 ${info.color}`} />
                          </div>
                          <div>
                            <h4 className={`text-xl font-bold ${info.color}`}>{info.name}</h4>
                            <p className="text-sm text-gray-600">{tier === 'pro' ? '$49/month' : '$499/month'}</p>
                          </div>
                        </div>
                        <ul className="space-y-2 mb-4">
                          {info.features.map((feature, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                              <Check className="w-4 h-4 text-green-600" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                        <button
                          onClick={() => handleUpgrade(tier)}
                          className={`w-full px-4 py-2.5 rounded-lg font-medium transition ${
                            tier === 'pro'
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-purple-600 text-white hover:bg-purple-700'
                          }`}
                        >
                          Upgrade to {info.name}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Usage by Model */}
            {usage?.by_model && usage.by_model.length > 0 && (
              <div className="mb-8 bg-white rounded-xl border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Usage by Model</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleExport('json')}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition"
                    >
                      <Download className="w-4 h-4" />
                      JSON
                    </button>
                    <button
                      onClick={() => handleExport('csv')}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition"
                    >
                      <Download className="w-4 h-4" />
                      CSV
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                        <th className="pb-3">Model</th>
                        <th className="pb-3 text-right">Requests</th>
                        <th className="pb-3 text-right">Tokens</th>
                        <th className="pb-3 text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {usage.by_model.map((m, idx) => (
                        <tr key={idx} className="text-sm">
                          <td className="py-3 font-medium text-gray-900">{m.model}</td>
                          <td className="py-3 text-right text-gray-700">{m.requests.toLocaleString()}</td>
                          <td className="py-3 text-right text-gray-700">{m.tokens.toLocaleString()}</td>
                          <td className="py-3 text-right font-medium text-gray-900">{formatCurrency(m.cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Invoices */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Invoices</h3>
                <Calendar className="w-5 h-5 text-gray-400" />
              </div>
              {invoices.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p>No invoices yet</p>
                  <p className="text-sm mt-1">Invoices will appear here at the end of each billing cycle</p>
                </div>
              ) : (
                <div className="divide-y">
                  {invoices.map((invoice) => (
                    <div key={invoice.id} className="py-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                        </div>
                        <div className="text-sm text-gray-500">
                          {invoice.status === 'paid' ? (
                            <span className="text-green-600">Paid on {invoice.paid_at && formatDate(invoice.paid_at)}</span>
                          ) : (
                            <span className="text-amber-600">Pending</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-gray-900">{formatCurrency(invoice.amount)}</div>
                        {invoice.status === 'paid' && (
                          <Check className="w-5 h-5 text-green-600 inline" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
