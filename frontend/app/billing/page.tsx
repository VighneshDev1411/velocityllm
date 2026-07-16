'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { billingAPI } from '@/lib/api';
import {
  CreditCard, TrendingUp, DollarSign, Calendar, Download,
  Check, AlertTriangle, Zap, Crown, Shield, BarChart3, PieChart as PieChartIcon,
  ArrowUpRight, ArrowDownRight, Wallet
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { useTheme } from '@mui/material/styles';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';

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

interface DailyUsage {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
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

// Styling metadata per tier — feature lists are derived from real API limits
const TIER_STYLE: Record<string, { name: string; color: string; bg: string; border: string; icon: typeof Shield }> = {
  free: { name: 'Free', color: 'text.primary', bg: 'background.default', border: 'divider', icon: Shield },
  pro: { name: 'Pro', color: 'primary.dark', bg: 'rgba(59,130,246,0.1)', border: '#bfdbfe', icon: Zap },
  enterprise: { name: 'Enterprise', color: '#4b8eff', bg: '#f5f3ff', border: '#ddd6fe', icon: Crown },
};

function buildTierFeatures(tierLimits: TierLimits | null): string[] {
  if (!tierLimits) return [];
  const fmt = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(0)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(0)}K` : String(n));
  return [
    tierLimits.requests_per_month >= 999_999_999 ? 'Unlimited requests' : `${fmt(tierLimits.requests_per_month)} requests/month`,
    tierLimits.tokens_per_month >= 999_999_999 ? 'Unlimited tokens' : `${fmt(tierLimits.tokens_per_month)} tokens/month`,
    tierLimits.max_api_keys >= 999 ? 'Unlimited API keys' : `${tierLimits.max_api_keys} API keys`,
    tierLimits.support_level ? `${tierLimits.support_level.charAt(0).toUpperCase() + tierLimits.support_level.slice(1)} support` : 'Community support',
  ];
}

const PIE_COLORS = ['#adc6ff', '#4b8eff', '#53e16f', '#ffb595', '#ef4444', '#67e8f9', '#adc6ff', '#f472b6'];

const headerSx = { fontWeight: 700, color: 'text.secondary', fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'var(--font-mono), "JetBrains Mono", monospace' } as const;

export default function BillingPage() {
  const theme = useTheme();
  const tooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: '8px', fontSize: '12px', color: theme.palette.text.primary };
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [limits, setLimits] = useState<TierLimits | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [usagePercentage, setUsagePercentage] = useState<{ requests: number; tokens: number } | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, usageRes, invoicesRes, historyRes] = await Promise.all([
        billingAPI.getSubscription(),
        billingAPI.getUsage(),
        billingAPI.listInvoices(),
        billingAPI.getUsageHistory(),
      ]);

      if (subRes.data?.data?.subscription) setSubscription(subRes.data.data.subscription);
      if (subRes.data?.data?.limits) setLimits(subRes.data.data.limits);
      if (usageRes.data?.data?.stats) setUsage(usageRes.data.data.stats);
      if (usageRes.data?.data?.usage_percentage) setUsagePercentage(usageRes.data.data.usage_percentage);
      if (invoicesRes.data?.data?.invoices) setInvoices(invoicesRes.data.data.invoices);
      if (historyRes.data?.data?.daily) setDailyUsage(historyRes.data.data.daily);
    } catch (err: any) {
      console.error('Failed to fetch billing data:', err);
      setError('Failed to load billing information');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpgrade = async (tier: string) => {
    try {
      setError('');
      await billingAPI.updateSubscription(tier);
      setSuccess(`Upgraded to ${(TIER_STYLE[tier] || { name: tier }).name}!`);
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
    } catch {
      setError('Failed to export usage data');
    }
  };

  // Cost projection: extrapolate current spend to end of billing cycle
  const costProjection = useMemo(() => {
    if (!subscription || !usage) return null;
    const cycleStart = new Date(subscription.billing_cycle_start).getTime();
    const cycleEnd = new Date(subscription.billing_cycle_end).getTime();
    const now = Date.now();
    const elapsed = now - cycleStart;
    const total = cycleEnd - cycleStart;
    if (elapsed <= 0 || total <= 0) return null;
    const ratio = total / elapsed;
    return {
      projected_cost: usage.total_cost * ratio,
      projected_requests: Math.round(usage.total_requests * ratio),
      projected_tokens: Math.round(usage.total_tokens * ratio),
      days_remaining: Math.max(0, Math.ceil((cycleEnd - now) / (1000 * 60 * 60 * 24))),
      progress: Math.min(100, (elapsed / total) * 100),
    };
  }, [subscription, usage]);

  // Usage alerts
  const alerts = useMemo(() => {
    const result: Array<{ severity: 'warning' | 'error'; message: string }> = [];
    if (!usagePercentage) return result;
    if (usagePercentage.requests >= 100) {
      result.push({ severity: 'error', message: 'You have exceeded your monthly request limit. Upgrade your plan to continue.' });
    } else if (usagePercentage.requests >= 90) {
      result.push({ severity: 'warning', message: `You've used ${usagePercentage.requests.toFixed(0)}% of your monthly request limit.` });
    } else if (usagePercentage.requests >= 75) {
      result.push({ severity: 'warning', message: `You've used ${usagePercentage.requests.toFixed(0)}% of your monthly request limit.` });
    }
    if (usagePercentage.tokens >= 100) {
      result.push({ severity: 'error', message: 'You have exceeded your monthly token limit. Upgrade your plan to continue.' });
    } else if (usagePercentage.tokens >= 90) {
      result.push({ severity: 'warning', message: `You've used ${usagePercentage.tokens.toFixed(0)}% of your monthly token limit.` });
    }
    return result;
  }, [usagePercentage]);

  // Chart data: format daily usage for display
  const chartData = useMemo(() => {
    return dailyUsage.map(d => ({
      ...d,
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    }));
  }, [dailyUsage]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const currentTier = subscription?.tier || 'free';
  const tierStyle = TIER_STYLE[currentTier] || TIER_STYLE.free;
  const tierFeatures = buildTierFeatures(limits);
  const TierIcon = tierStyle.icon;

  const progressColor = (pct: number) => pct >= 90 ? '#dc2626' : pct >= 75 ? '#d97706' : '#4b8eff';

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: '1200px', mx: 'auto' }}>
      <PageHeader
        title="Billing Dashboard"
        subtitle="Manage your subscription, track spending, and monitor usage"
      />

      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2, borderRadius: '10px' }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: '10px' }}>
          {success}
        </Alert>
      )}
      {!loading && alerts.map((alert, idx) => (
        <Alert key={idx} severity={alert.severity} icon={<AlertTriangle size={18} />} sx={{ mb: 2, borderRadius: '10px' }}>
          {alert.message}
        </Alert>
      ))}

      {loading ? (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 4, textAlign: 'center' }}>
          <CircularProgress size={28} />
          <Typography sx={{ mt: 1, color: 'text.disabled' }}>Loading billing data...</Typography>
        </Paper>
      ) : (
        <>
          {/* Current Plan Banner */}
          <Paper
            elevation={0}
            sx={{ mb: 3, p: 3, borderRadius: '8px', border: `2px solid ${tierStyle.border}`, bgcolor: tierStyle.bg }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 48, height: 48, borderRadius: '8px', bgcolor: tierStyle.bg, border: `1px solid ${tierStyle.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TierIcon size={24} color={tierStyle.color} />
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: tierStyle.color }}>
                    {tierStyle.name} Plan
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {subscription && `${formatDate(subscription.billing_cycle_start)} - ${formatDate(subscription.billing_cycle_end)}`}
                    {costProjection && ` (${costProjection.days_remaining} days left)`}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  {limits?.price_per_month === 0 ? 'Free' : formatCurrency(limits?.price_per_month || 0)}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>per month</Typography>
              </Box>
            </Box>
            {costProjection && (
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>Billing cycle progress</Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>{costProjection.progress.toFixed(0)}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={costProjection.progress}
                  sx={{ height: 6, borderRadius: 3, bgcolor: 'divider', '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: tierStyle.color } }}
                />
              </Box>
            )}
            {tierFeatures.length > 0 && (
              <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                {tierFeatures.map((feature, idx) => (
                  <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Check size={14} color="#16a34a" />
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{feature}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>

          {/* Stat Cards Row */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard label="Requests" value={(usage?.total_requests || 0).toLocaleString()} icon={<TrendingUp size={20} />} color="blue" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard label="Tokens Used" value={(usage?.total_tokens || 0).toLocaleString()} icon={<Zap size={20} />} color="purple" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard label="Current Spend" value={formatCurrency(usage?.total_cost || 0)} icon={<DollarSign size={20} />} color="green" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                label="Projected Cost"
                value={costProjection ? formatCurrency(costProjection.projected_cost) : '--'}
                icon={<ArrowUpRight size={20} />}
                color="orange"
              />
            </Grid>
          </Grid>

          {/* Usage Limits */}
          {limits && (limits.requests_per_month > 0 || limits.tokens_per_month > 0) && (
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              {limits.requests_per_month > 0 && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>Request Usage</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {(usage?.total_requests || 0).toLocaleString()} / {limits.requests_per_month.toLocaleString()}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(usagePercentage?.requests || 0, 100)}
                      sx={{
                        height: 10, borderRadius: 5, bgcolor: 'divider',
                        '& .MuiLinearProgress-bar': { borderRadius: 5, bgcolor: progressColor(usagePercentage?.requests || 0) },
                      }}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                      {(usagePercentage?.requests || 0).toFixed(1)}% used
                    </Typography>
                  </Paper>
                </Grid>
              )}
              {limits.tokens_per_month > 0 && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>Token Usage</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {(usage?.total_tokens || 0).toLocaleString()} / {limits.tokens_per_month.toLocaleString()}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(usagePercentage?.tokens || 0, 100)}
                      sx={{
                        height: 10, borderRadius: 5, bgcolor: 'divider',
                        '& .MuiLinearProgress-bar': { borderRadius: 5, bgcolor: progressColor(usagePercentage?.tokens || 0) },
                      }}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                      {(usagePercentage?.tokens || 0).toFixed(1)}% used
                    </Typography>
                  </Paper>
                </Grid>
              )}
            </Grid>
          )}

          {/* Charts Section */}
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, mb: 3 }}>
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              sx={{ mb: 2, '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.875rem' } }}
            >
              <Tab label="Cost Trend" icon={<DollarSign size={16} />} iconPosition="start" />
              <Tab label="Daily Requests" icon={<BarChart3 size={16} />} iconPosition="start" />
              <Tab label="Cost by Model" icon={<PieChartIcon size={16} />} iconPosition="start" />
            </Tabs>

            {activeTab === 0 && (
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                  Daily spending over the last 30 days
                </Typography>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4b8eff" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#4b8eff" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--mui-palette-divider)" />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--mui-palette-text-disabled)' }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 12, fill: 'var(--mui-palette-text-disabled)' }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                      />
                      <Area type="monotone" dataKey="cost" stroke="#4b8eff" strokeWidth={2} fill="url(#costGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Typography sx={{ color: 'text.disabled' }}>No usage data available yet</Typography>
                  </Box>
                )}
              </Box>
            )}

            {activeTab === 1 && (
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                  Daily API requests over the last 30 days
                </Typography>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--mui-palette-divider)" />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--mui-palette-text-disabled)' }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 12, fill: 'var(--mui-palette-text-disabled)' }} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number) => [value.toLocaleString(), 'Requests']}
                      />
                      <Bar dataKey="requests" fill="#4b8eff" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Typography sx={{ color: 'text.disabled' }}>No usage data available yet</Typography>
                  </Box>
                )}
              </Box>
            )}

            {activeTab === 2 && (
              <Box>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                  Cost distribution across models
                </Typography>
                {usage?.by_model && usage.by_model.length > 0 ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <ResponsiveContainer width={300} height={300}>
                      <PieChart>
                        <Pie
                          data={usage.by_model}
                          dataKey="cost"
                          nameKey="model"
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={120}
                          paddingAngle={2}
                        >
                          {usage.by_model.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {usage.by_model.map((m, idx) => (
                        <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>{m.model}</Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {formatCurrency(m.cost)} ({m.requests.toLocaleString()} reqs)
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Typography sx={{ color: 'text.disabled' }}>No model usage data available yet</Typography>
                  </Box>
                )}
              </Box>
            )}
          </Paper>

          {/* Usage by Model Table + Payment Method */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            {/* Usage by Model */}
            <Grid size={{ xs: 12, md: 8 }}>
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Usage by Model
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="outlined" size="small" startIcon={<Download size={14} />} onClick={() => handleExport('json')} sx={{ textTransform: 'none', borderRadius: '8px' }}>
                      JSON
                    </Button>
                    <Button variant="outlined" size="small" startIcon={<Download size={14} />} onClick={() => handleExport('csv')} sx={{ textTransform: 'none', borderRadius: '8px' }}>
                      CSV
                    </Button>
                  </Box>
                </Box>
                {usage?.by_model && usage.by_model.length > 0 ? (
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={headerSx}>Model</TableCell>
                        <TableCell align="right" sx={headerSx}>Requests</TableCell>
                        <TableCell align="right" sx={headerSx}>Tokens</TableCell>
                        <TableCell align="right" sx={headerSx}>Cost</TableCell>
                        <TableCell align="right" sx={headerSx}>Avg Cost/Req</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {usage.by_model.map((m, idx) => (
                        <TableRow key={idx} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                              <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>{m.model}</Typography>
                            </Box>
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'text.primary' }}>{m.requests.toLocaleString()}</TableCell>
                          <TableCell align="right" sx={{ color: 'text.primary' }}>{m.tokens.toLocaleString()}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 500, color: 'text.primary' }}>{formatCurrency(m.cost)}</TableCell>
                          <TableCell align="right" sx={{ color: 'text.secondary' }}>
                            {m.requests > 0 ? formatCurrency(m.cost / m.requests) : '--'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography sx={{ color: 'text.disabled' }}>No model usage data yet</Typography>
                  </Box>
                )}
              </Paper>
            </Grid>

            {/* Payment Method */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, height: '100%' }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 2 }}>
                  Payment Method
                </Typography>
                <Box
                  sx={{
                    p: 2.5, borderRadius: '8px',
                    background: 'linear-gradient(135deg, #1e3a5f 0%, #0a0f1e 100%)', color: 'white', mb: 2,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    minHeight: 120, gap: 1,
                  }}
                >
                  <CreditCard size={32} style={{ opacity: 0.5 }} />
                  <Typography variant="body2" sx={{ color: 'text.disabled', textAlign: 'center' }}>
                    No payment method on file
                  </Typography>
                </Box>
                <Button fullWidth variant="outlined" sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}>
                  Add Payment Method
                </Button>
              </Paper>
            </Grid>
          </Grid>

          {/* Upgrade Options */}
          {currentTier !== 'enterprise' && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 2 }}>
                Upgrade Your Plan
              </Typography>
              <Grid container spacing={3}>
                {Object.entries(TIER_STYLE).filter(([tier]) => tier !== currentTier && tier !== 'free').map(([tier, style]) => {
                  const Icon = style.icon;
                  return (
                    <Grid size={{ xs: 12, md: 6 }} key={tier}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 3, borderRadius: '8px', border: `2px solid ${style.border}`,
                          transition: 'box-shadow 0.2s', '&:hover': { boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                          <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: style.bg, border: `1px solid ${style.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon size={20} color={style.color} />
                          </Box>
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: style.color }}>{style.name}</Typography>
                            {limits && (
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                {limits.price_per_month > 0 ? `$${limits.price_per_month}/month` : 'Contact sales'}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        <Button
                          fullWidth variant="contained" onClick={() => handleUpgrade(tier)}
                          sx={{
                            textTransform: 'none', borderRadius: '8px', py: 1.25, fontWeight: 600,
                            bgcolor: tier === 'pro' ? '#4b8eff' : '#4b8eff',
                            '&:hover': { bgcolor: tier === 'pro' ? '#1d4ed8' : '#6d28d9' },
                          }}
                        >
                          Upgrade to {style.name}
                        </Button>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}

          {/* Invoices */}
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>Invoices</Typography>
              <Calendar size={20} color="var(--mui-palette-text-disabled)" />
            </Box>
            {invoices.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography sx={{ color: 'text.disabled' }}>No invoices yet</Typography>
                <Typography variant="body2" sx={{ color: 'text.disabled', mt: 0.5 }}>
                  Invoices will appear here at the end of each billing cycle
                </Typography>
              </Box>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={headerSx}>Period</TableCell>
                    <TableCell sx={headerSx}>Status</TableCell>
                    <TableCell align="right" sx={headerSx}>Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary' }}>
                          {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {invoice.status === 'paid' ? (
                          <Chip icon={<Check size={14} />} label={`Paid ${invoice.paid_at ? formatDate(invoice.paid_at) : ''}`} size="small"
                            sx={{ bgcolor: 'rgba(16,185,129,0.1)', color: '#16a34a', fontWeight: 500, fontSize: '0.75rem', '& .MuiChip-icon': { color: '#16a34a' } }} />
                        ) : (
                          <Chip label="Pending" size="small" sx={{ bgcolor: 'rgba(245,158,11,0.1)', color: '#d97706', fontWeight: 500, fontSize: '0.75rem' }} />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>{formatCurrency(invoice.amount)}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </>
      )}
    </Box>
  );
}
