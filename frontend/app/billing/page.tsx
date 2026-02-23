'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { billingAPI } from '@/lib/api';
import {
  CreditCard, TrendingUp, DollarSign, Calendar, Download,
  Check, AlertTriangle, Zap, Crown, Shield
} from 'lucide-react';
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
import { PageHeader } from '@/components/PageHeader';

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
    color: '#374151',
    bg: '#f9fafb',
    border: '#e5e7eb',
    icon: Shield,
    features: ['1K requests/month', '100K tokens/month', '2 API keys', 'Community support'],
  },
  pro: {
    name: 'Pro',
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
    icon: Zap,
    features: ['50K requests/month', '5M tokens/month', '10 API keys', 'Email support'],
  },
  enterprise: {
    name: 'Enterprise',
    color: '#7c3aed',
    bg: '#f5f3ff',
    border: '#ddd6fe',
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
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: '1100px', mx: 'auto' }}>
      <PageHeader
        title="Billing & Usage"
        subtitle="Manage your subscription and track usage"
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

      {loading ? (
        <Paper
          elevation={0}
          sx={{
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            p: 4,
            textAlign: 'center',
          }}
        >
          <CircularProgress size={28} />
          <Typography sx={{ mt: 1, color: '#9ca3af' }}>Loading...</Typography>
        </Paper>
      ) : (
        <>
          {/* Current Plan */}
          <Paper
            elevation={0}
            sx={{
              mb: 4,
              p: 3,
              borderRadius: '12px',
              border: `2px solid ${tierInfo.border}`,
              bgcolor: tierInfo.bg,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    bgcolor: tierInfo.bg,
                    border: `1px solid ${tierInfo.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TierIcon size={24} color={tierInfo.color} />
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: tierInfo.color }}>
                    {tierInfo.name} Plan
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#4b5563' }}>
                    Billing cycle: {subscription && formatDate(subscription.billing_cycle_start)} - {subscription && formatDate(subscription.billing_cycle_end)}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#111827' }}>
                  {limits?.price_per_month === 0 ? 'Free' : formatCurrency(limits?.price_per_month || 0)}
                </Typography>
                <Typography variant="body2" sx={{ color: '#6b7280' }}>per month</Typography>
              </Box>
            </Box>

            <Grid container spacing={1.5}>
              {tierInfo.features.map((feature, idx) => (
                <Grid size={{ xs: 6, md: 3 }} key={idx}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Check size={16} color="#16a34a" />
                    <Typography variant="body2" sx={{ color: '#374151' }}>{feature}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* Usage Stats */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {/* Requests */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper
                elevation={0}
                sx={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  p: 3,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#6b7280' }}>
                    Requests
                  </Typography>
                  <TrendingUp size={20} color="#9ca3af" />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#111827', mb: 1 }}>
                  {usage?.total_requests.toLocaleString() || 0}
                </Typography>
                {limits && limits.requests_per_month > 0 && (
                  <>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(usagePercentage?.requests || 0, 100)}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: '#e5e7eb',
                        mb: 1,
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          bgcolor: '#2563eb',
                        },
                      }}
                    />
                    <Typography variant="caption" sx={{ color: '#6b7280' }}>
                      {(usagePercentage?.requests || 0).toFixed(1)}% of {limits.requests_per_month.toLocaleString()} limit
                    </Typography>
                  </>
                )}
              </Paper>
            </Grid>

            {/* Tokens */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper
                elevation={0}
                sx={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  p: 3,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#6b7280' }}>
                    Tokens
                  </Typography>
                  <Zap size={20} color="#9ca3af" />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#111827', mb: 1 }}>
                  {usage?.total_tokens.toLocaleString() || 0}
                </Typography>
                {limits && limits.tokens_per_month > 0 && (
                  <>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(usagePercentage?.tokens || 0, 100)}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: '#e5e7eb',
                        mb: 1,
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          bgcolor: '#9333ea',
                        },
                      }}
                    />
                    <Typography variant="caption" sx={{ color: '#6b7280' }}>
                      {(usagePercentage?.tokens || 0).toFixed(1)}% of {limits.tokens_per_month.toLocaleString()} limit
                    </Typography>
                  </>
                )}
              </Paper>
            </Grid>

            {/* Total Cost */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper
                elevation={0}
                sx={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  p: 3,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, color: '#6b7280' }}>
                    Total Cost
                  </Typography>
                  <DollarSign size={20} color="#9ca3af" />
                </Box>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#111827', mb: 1 }}>
                  {formatCurrency(usage?.total_cost || 0)}
                </Typography>
                <Typography variant="caption" sx={{ color: '#6b7280' }}>
                  This billing cycle
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          {/* Upgrade Options */}
          {currentTier !== 'enterprise' && (
            <Box sx={{ mb: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                Upgrade Your Plan
              </Typography>
              <Grid container spacing={3}>
                {Object.entries(TIER_INFO).filter(([tier]) => tier !== currentTier && tier !== 'free').map(([tier, info]) => {
                  const Icon = info.icon;
                  return (
                    <Grid size={{ xs: 12, md: 6 }} key={tier}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 3,
                          borderRadius: '12px',
                          border: `2px solid ${info.border}`,
                          transition: 'box-shadow 0.2s',
                          '&:hover': { boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: '10px',
                              bgcolor: info.bg,
                              border: `1px solid ${info.border}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Icon size={20} color={info.color} />
                          </Box>
                          <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: info.color }}>
                              {info.name}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#4b5563' }}>
                              {tier === 'pro' ? '$49/month' : '$499/month'}
                            </Typography>
                          </Box>
                        </Box>
                        <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {info.features.map((feature, idx) => (
                            <Box component="li" key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Check size={16} color="#16a34a" />
                              <Typography variant="body2" sx={{ color: '#374151' }}>{feature}</Typography>
                            </Box>
                          ))}
                        </Box>
                        <Button
                          fullWidth
                          variant="contained"
                          onClick={() => handleUpgrade(tier)}
                          sx={{
                            textTransform: 'none',
                            borderRadius: '8px',
                            py: 1.25,
                            fontWeight: 600,
                            bgcolor: tier === 'pro' ? '#2563eb' : '#7c3aed',
                            '&:hover': { bgcolor: tier === 'pro' ? '#1d4ed8' : '#6d28d9' },
                          }}
                        >
                          Upgrade to {info.name}
                        </Button>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          )}

          {/* Usage by Model */}
          {usage?.by_model && usage.by_model.length > 0 && (
            <Paper
              elevation={0}
              sx={{
                mb: 4,
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                p: 3,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#111827' }}>
                  Usage by Model
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Download size={14} />}
                    onClick={() => handleExport('json')}
                    sx={{ textTransform: 'none', borderRadius: '8px' }}
                  >
                    JSON
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<Download size={14} />}
                    onClick={() => handleExport('csv')}
                    sx={{ textTransform: 'none', borderRadius: '8px' }}
                  >
                    CSV
                  </Button>
                </Box>
              </Box>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Model
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Requests
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Tokens
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Cost
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usage.by_model.map((m, idx) => (
                    <TableRow key={idx} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell sx={{ fontWeight: 500, color: '#111827' }}>{m.model}</TableCell>
                      <TableCell align="right" sx={{ color: '#374151' }}>{m.requests.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={{ color: '#374151' }}>{m.tokens.toLocaleString()}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 500, color: '#111827' }}>{formatCurrency(m.cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}

          {/* Invoices */}
          <Paper
            elevation={0}
            sx={{
              border: '1px solid #e5e7eb',
              borderRadius: '12px',
              p: 3,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, color: '#111827' }}>
                Invoices
              </Typography>
              <Calendar size={20} color="#9ca3af" />
            </Box>
            {invoices.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography sx={{ color: '#9ca3af' }}>No invoices yet</Typography>
                <Typography variant="body2" sx={{ color: '#9ca3af', mt: 0.5 }}>
                  Invoices will appear here at the end of each billing cycle
                </Typography>
              </Box>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Period
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Status
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Amount
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: '#111827' }}>
                          {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {invoice.status === 'paid' ? (
                          <Chip
                            icon={<Check size={14} />}
                            label={`Paid on ${invoice.paid_at && formatDate(invoice.paid_at)}`}
                            size="small"
                            sx={{
                              bgcolor: '#ecfdf5',
                              color: '#16a34a',
                              fontWeight: 500,
                              fontSize: '0.75rem',
                              '& .MuiChip-icon': { color: '#16a34a' },
                            }}
                          />
                        ) : (
                          <Chip
                            label="Pending"
                            size="small"
                            sx={{
                              bgcolor: '#fffbeb',
                              color: '#d97706',
                              fontWeight: 500,
                              fontSize: '0.75rem',
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 700, color: '#111827' }}>
                          {formatCurrency(invoice.amount)}
                        </Typography>
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
