'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsAPI } from '@/lib/api';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  BarChart3, Clock, DollarSign, AlertCircle, Zap, Timer,
  RefreshCw, Download, FileJson, ChevronLeft, ChevronRight,
  Check, Minus, Filter
} from 'lucide-react';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Grid from '@mui/material/Grid';
import { StatCard } from '@/components/StatCard';
import { PageHeader } from '@/components/PageHeader';

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------

function useAnalyticsSummary() {
  return useQuery({
    queryKey: ['analytics-summary'],
    queryFn: async () => {
      const r = await analyticsAPI.getAnalyticsSummary();
      return r.data?.data;
    },
    refetchInterval: 10000,
  });
}

function useTimeSeries(period: string) {
  return useQuery({
    queryKey: ['analytics-timeseries', period],
    queryFn: async () => {
      const r = await analyticsAPI.getTimeSeries(period);
      return r.data?.data;
    },
    refetchInterval: 30000,
  });
}

function useRequestLog(params: { model?: string; status?: string; limit: number; offset: number }) {
  return useQuery({
    queryKey: ['analytics-request-log', params],
    queryFn: async () => {
      const r = await analyticsAPI.getRequestLog({
        model: params.model || undefined,
        status: params.status || undefined,
        limit: params.limit,
        offset: params.offset,
      });
      return r.data?.data;
    },
    refetchInterval: 15000,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHART_BLUE = '#3b82f6';
const CHART_GREEN = '#10b981';
const CHART_PURPLE = '#8b5cf6';
const CHART_YELLOW = '#f59e0b';
const CHART_RED = '#ef4444';

function formatNumber(num: number): string {
  if (num == null) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatCost(cost: number): string {
  if (cost == null) return '$0.0000';
  return `$${cost.toFixed(4)}`;
}

function formatUptime(seconds: number): string {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function truncate(str: string, len: number): string {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '...' : str;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PercentileBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: '#4b5563' }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#111827' }}>{value}ms</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 8,
          borderRadius: 4,
          backgroundColor: '#f3f4f6',
          '& .MuiLinearProgress-bar': {
            borderRadius: 4,
            backgroundColor: color,
            transition: 'width 0.5s ease',
          },
        }}
      />
    </Box>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    completed: { bg: '#dcfce7', fg: '#15803d' },
    cache_hit: { bg: '#dbeafe', fg: '#1d4ed8' },
    error: { bg: '#fee2e2', fg: '#b91c1c' },
  };
  const colors = map[status] || { bg: '#f3f4f6', fg: '#4b5563' };
  return (
    <Chip
      label={status || 'unknown'}
      size="small"
      sx={{
        fontSize: '0.6875rem',
        fontWeight: 500,
        height: 22,
        backgroundColor: colors.bg,
        color: colors.fg,
      }}
    />
  );
}

function ProviderBadge({ provider }: { provider: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    openai: { bg: '#dcfce7', fg: '#15803d' },
    anthropic: { bg: '#ffedd5', fg: '#c2410c' },
    google: { bg: '#dbeafe', fg: '#1d4ed8' },
    cohere: { bg: '#f3e8ff', fg: '#7e22ce' },
    local: { bg: '#f3f4f6', fg: '#4b5563' },
  };
  const colors = map[(provider || '').toLowerCase()] || { bg: '#f3f4f6', fg: '#4b5563' };
  return (
    <Chip
      label={provider || '-'}
      size="small"
      sx={{
        fontSize: '0.6875rem',
        fontWeight: 500,
        height: 22,
        backgroundColor: colors.bg,
        color: colors.fg,
      }}
    />
  );
}

function ChartPlaceholder() {
  return (
    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box sx={{ textAlign: 'center' }}>
        <CircularProgress size={24} sx={{ color: '#60a5fa' }} />
        <Typography sx={{ mt: 1, fontSize: '0.75rem', color: '#9ca3af' }}>Loading chart...</Typography>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('24h');
  const [logModel, setLogModel] = useState('');
  const [logStatus, setLogStatus] = useState('');
  const [logOffset, setLogOffset] = useState(0);
  const logLimit = 20;

  const { data: summary, isLoading: summaryLoading, error: summaryError, refetch: refetchSummary } = useAnalyticsSummary();
  const { data: timeSeries, isLoading: tsLoading } = useTimeSeries(period);
  const { data: logData, isLoading: logLoading } = useRequestLog({
    model: logModel, status: logStatus, limit: logLimit, offset: logOffset,
  });

  // Derived
  const latency = summary?.latency || {};
  const throughput = summary?.throughput || {};
  const cost = summary?.cost || {};
  const errors = summary?.errors || {};
  const models: any[] = summary?.models || [];
  const requestLog: any[] = logData?.requests || [];
  const pagination = logData?.pagination || { limit: logLimit, offset: 0, total: 0 };

  // Model names for the filter dropdown
  const modelNames = models.map((m: any) => m.model_name || m.model).filter(Boolean);

  // CSV export
  const exportCSV = () => {
    const headers = ['Timestamp', 'Model', 'Provider', 'Prompt', 'Latency (ms)', 'Cost ($)', 'Tokens', 'Status', 'Cache Hit'];
    const rows = requestLog.map((r: any) => [
      r.timestamp, r.model, r.provider, `"${(r.prompt || '').replace(/"/g, '""')}"`,
      r.latency_ms, r.cost, r.tokens, r.status, r.cache_hit,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `velocityllm-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // JSON summary export
  const exportSummary = () => {
    const payload = { exported_at: new Date().toISOString(), period, summary, timeSeries };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `velocityllm-summary-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ------ Loading state ------
  if (summaryLoading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={48} sx={{ color: '#2563eb' }} />
          <Typography sx={{ mt: 2, color: '#4b5563' }}>Loading analytics...</Typography>
        </Box>
      </Box>
    );
  }

  // ------ Error state ------
  if (summaryError) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Alert
          severity="error"
          icon={<AlertCircle style={{ width: 24, height: 24 }} />}
          sx={{ maxWidth: 400, borderRadius: '12px' }}
          action={
            <Button
              color="error"
              variant="contained"
              size="small"
              startIcon={<RefreshCw style={{ width: 16, height: 16 }} />}
              onClick={() => refetchSummary()}
              sx={{ textTransform: 'none', borderRadius: '8px' }}
            >
              Retry
            </Button>
          }
        >
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Connection Error</Typography>
          <Typography sx={{ fontSize: '0.875rem' }}>Failed to load analytics data. Make sure the backend is running.</Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* ---------------------------------------------------------------- */}
      {/* Header                                                           */}
      {/* ---------------------------------------------------------------- */}
      <PageHeader
        title="Analytics"
        subtitle="Deep-dive into request patterns, latency, costs, and model performance"
        action={
          <ToggleButtonGroup
            value={period}
            exclusive
            onChange={(_, val) => { if (val) setPeriod(val); }}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 500,
                px: 2,
                py: 0.75,
                border: '1px solid #e5e7eb',
                color: '#6b7280',
                '&.Mui-selected': {
                  backgroundColor: '#fff',
                  color: '#2563eb',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  '&:hover': { backgroundColor: '#f0f7ff' },
                },
                '&:hover': { backgroundColor: '#f9fafb' },
              },
            }}
          >
            {['1h', '6h', '24h', '7d'].map((r) => (
              <ToggleButton key={r} value={r}>{r}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        }
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* ---------------------------------------------------------------- */}
        {/* KPI Summary Row                                                  */}
        {/* ---------------------------------------------------------------- */}
        <Grid container spacing={2}>
          <Grid size={{ xs: 6, md: 4, lg: 2 }}>
            <StatCard icon={<BarChart3 style={{ width: 20, height: 20 }} />} label="Total Requests"
              value={formatNumber(throughput.total_requests || 0)} color="blue" />
          </Grid>
          <Grid size={{ xs: 6, md: 4, lg: 2 }}>
            <StatCard icon={<Clock style={{ width: 20, height: 20 }} />} label="Avg Latency"
              value={`${latency.mean_ms ?? 0}ms`} color="purple" />
          </Grid>
          <Grid size={{ xs: 6, md: 4, lg: 2 }}>
            <StatCard icon={<DollarSign style={{ width: 20, height: 20 }} />} label="Total Cost"
              value={formatCost(cost.total_cost || 0)} color="green" />
          </Grid>
          <Grid size={{ xs: 6, md: 4, lg: 2 }}>
            <StatCard icon={<AlertCircle style={{ width: 20, height: 20 }} />} label="Error Rate"
              value={`${errors.error_rate ?? 0}%`} color="red" />
          </Grid>
          <Grid size={{ xs: 6, md: 4, lg: 2 }}>
            <StatCard icon={<Zap style={{ width: 20, height: 20 }} />} label="Throughput"
              value={`${throughput.requests_per_second ?? 0} req/s`} color="yellow" />
          </Grid>
          <Grid size={{ xs: 6, md: 4, lg: 2 }}>
            <StatCard icon={<Timer style={{ width: 20, height: 20 }} />} label="Uptime"
              value={formatUptime(throughput.uptime_seconds || 0)} color="blue" />
          </Grid>
        </Grid>

        {/* ---------------------------------------------------------------- */}
        {/* Latency Analysis                                                 */}
        {/* ---------------------------------------------------------------- */}
        <Grid container spacing={3}>
          {/* Latency Percentiles Time Series */}
          <Grid size={{ xs: 12, lg: 6 }}>
            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Clock style={{ width: 16, height: 16, color: '#7c3aed' }} />
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                  Latency Percentiles Over Time
                </Typography>
              </Box>
              <Box sx={{ height: 256 }}>
                {tsLoading ? (
                  <ChartPlaceholder />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeSeries?.latency || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="time" tickFormatter={formatTime}
                        tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} unit="ms" />
                      <Tooltip labelFormatter={(l) => new Date(l as string).toLocaleString()}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                      <Legend iconType="line" wrapperStyle={{ fontSize: '11px' }} />
                      <Line type="monotone" dataKey="p50_ms" name="P50" stroke={CHART_GREEN} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="p90_ms" name="P90" stroke={CHART_YELLOW} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="p95_ms" name="P95" stroke={CHART_PURPLE} strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="p99_ms" name="P99" stroke={CHART_RED} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Latency Distribution */}
          <Grid size={{ xs: 12, lg: 6 }}>
            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <BarChart3 style={{ width: 16, height: 16, color: '#7c3aed' }} />
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                  Latency Distribution
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <PercentileBar label="P50 (Median)" value={latency.p50_ms || 0} max={latency.p99_ms || 100} color="#22c55e" />
                <PercentileBar label="P90" value={latency.p90_ms || 0} max={latency.p99_ms || 100} color="#eab308" />
                <PercentileBar label="P95" value={latency.p95_ms || 0} max={latency.p99_ms || 100} color="#8b5cf6" />
                <PercentileBar label="P99" value={latency.p99_ms || 0} max={latency.p99_ms || 100} color="#ef4444" />
              </Box>
              <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #f3f4f6' }}>
                <Grid container spacing={2}>
                  <Grid size={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>Min</Typography>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>{latency.min_ms ?? 0}ms</Typography>
                    </Box>
                  </Grid>
                  <Grid size={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>Mean</Typography>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>{latency.mean_ms ?? 0}ms</Typography>
                    </Box>
                  </Grid>
                  <Grid size={4}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>Max</Typography>
                      <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>{latency.max_ms ?? 0}ms</Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* ---------------------------------------------------------------- */}
        {/* Throughput & Cost Analysis                                        */}
        {/* ---------------------------------------------------------------- */}
        <Grid container spacing={3}>
          {/* Request Throughput */}
          <Grid size={{ xs: 12, lg: 6 }}>
            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Zap style={{ width: 16, height: 16, color: '#2563eb' }} />
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                  Request Throughput
                </Typography>
              </Box>
              <Box sx={{ height: 256 }}>
                {tsLoading ? (
                  <ChartPlaceholder />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeSeries?.requests || []}>
                      <defs>
                        <linearGradient id="throughputGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_BLUE} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_BLUE} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="time" tickFormatter={formatTime}
                        tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <Tooltip labelFormatter={(l) => new Date(l as string).toLocaleString()}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="requests" stroke={CHART_BLUE}
                        strokeWidth={2} fill="url(#throughputGradient)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Cumulative Cost */}
          <Grid size={{ xs: 12, lg: 6 }}>
            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <DollarSign style={{ width: 16, height: 16, color: '#059669' }} />
                <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                  Cumulative Cost
                </Typography>
              </Box>
              <Box sx={{ height: 256 }}>
                {tsLoading ? (
                  <ChartPlaceholder />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeSeries?.cost || []}>
                      <defs>
                        <linearGradient id="costGradientAnalytics" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_GREEN} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_GREEN} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="time" tickFormatter={formatTime}
                        tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => `$${v}`} />
                      <Tooltip labelFormatter={(l) => new Date(l as string).toLocaleString()}
                        formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="cost" stroke={CHART_GREEN}
                        strokeWidth={2} fill="url(#costGradientAnalytics)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* ---------------------------------------------------------------- */}
        {/* Model Comparison Table                                           */}
        {/* ---------------------------------------------------------------- */}
        <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <BarChart3 style={{ width: 16, height: 16, color: '#2563eb' }} />
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
              Model Comparison
            </Typography>
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { borderBottom: '1px solid #e5e7eb' } }}>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Model</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requests</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Success Rate</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Latency</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Cost</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Cost/Req</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Used</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {models.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 4, textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', border: 'none' }}>
                      No model data available
                    </TableCell>
                  </TableRow>
                )}
                {models.map((m: any, i: number) => {
                  const rate = parseFloat(m.success_rate || '0');
                  const rateColor = rate >= 99 ? { bg: '#dcfce7', fg: '#15803d' } : rate >= 95 ? { bg: '#fef9c3', fg: '#a16207' } : { bg: '#fee2e2', fg: '#b91c1c' };
                  return (
                    <TableRow
                      key={i}
                      sx={{
                        backgroundColor: i % 2 === 1 ? '#f9fafb' : 'transparent',
                        '&:hover': { backgroundColor: 'rgba(59,130,246,0.04)' },
                        '& td': { borderBottom: '1px solid #f3f4f6' },
                      }}
                    >
                      <TableCell sx={{ fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>{m.model_name || m.model}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.875rem', color: '#374151' }}>{formatNumber(m.request_count || m.requests || 0)}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={m.success_rate ?? `${rate.toFixed(1)}%`}
                          size="small"
                          sx={{
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            height: 22,
                            backgroundColor: rateColor.bg,
                            color: rateColor.fg,
                          }}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.875rem', color: '#374151' }}>{m.avg_latency_ms ?? 0}ms</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.875rem', color: '#374151' }}>{m.total_cost ?? '$0.0000'}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.875rem', color: '#374151' }}>{m.avg_cost_per_request ?? '$0.0000'}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.75rem', color: '#6b7280' }}>
                        {m.last_used ? formatTimestamp(m.last_used) : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Paper>

        {/* ---------------------------------------------------------------- */}
        {/* Request History Table                                             */}
        {/* ---------------------------------------------------------------- */}
        <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 1.5, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Filter style={{ width: 16, height: 16, color: '#6b7280' }} />
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                Request History
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Select
                value={logModel}
                onChange={(e) => { setLogModel(e.target.value); setLogOffset(0); }}
                displayEmpty
                size="small"
                sx={{
                  fontSize: '0.75rem',
                  minWidth: 140,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e5e7eb', borderRadius: '8px' },
                  '& .MuiSelect-select': { py: 0.75, px: 1.5 },
                }}
              >
                <MenuItem value="" sx={{ fontSize: '0.75rem' }}>All Models</MenuItem>
                {modelNames.map((n: string) => (
                  <MenuItem key={n} value={n} sx={{ fontSize: '0.75rem' }}>{n}</MenuItem>
                ))}
              </Select>
              <Select
                value={logStatus}
                onChange={(e) => { setLogStatus(e.target.value); setLogOffset(0); }}
                displayEmpty
                size="small"
                sx={{
                  fontSize: '0.75rem',
                  minWidth: 130,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e5e7eb', borderRadius: '8px' },
                  '& .MuiSelect-select': { py: 0.75, px: 1.5 },
                }}
              >
                <MenuItem value="" sx={{ fontSize: '0.75rem' }}>All Statuses</MenuItem>
                <MenuItem value="completed" sx={{ fontSize: '0.75rem' }}>Completed</MenuItem>
                <MenuItem value="cache_hit" sx={{ fontSize: '0.75rem' }}>Cache Hit</MenuItem>
                <MenuItem value="error" sx={{ fontSize: '0.75rem' }}>Error</MenuItem>
              </Select>
            </Box>
          </Box>

          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { borderBottom: '1px solid #e5e7eb' } }}>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Time</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Model</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Provider</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Prompt</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Latency</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Cost</TableCell>
                  <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Status</TableCell>
                  <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6b7280' }}>Cache</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logLoading && (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ py: 4, textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', border: 'none' }}>
                      Loading requests...
                    </TableCell>
                  </TableRow>
                )}
                {!logLoading && requestLog.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ py: 4, textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', border: 'none' }}>
                      No requests found
                    </TableCell>
                  </TableRow>
                )}
                {!logLoading && requestLog.map((r: any, i: number) => (
                  <TableRow
                    key={i}
                    sx={{
                      backgroundColor: i % 2 === 1 ? 'rgba(249,250,251,0.5)' : 'transparent',
                      '&:hover': { backgroundColor: 'rgba(59,130,246,0.03)' },
                      '& td': { borderBottom: '1px solid #f9fafb' },
                    }}
                  >
                    <TableCell sx={{ fontSize: '0.75rem', color: '#4b5563', whiteSpace: 'nowrap' }}>
                      {r.timestamp ? formatTimestamp(r.timestamp) : '-'}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 500, color: '#111827' }}>{r.model || '-'}</TableCell>
                    <TableCell>
                      <ProviderBadge provider={r.provider} />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: '#4b5563', maxWidth: 200 }} title={r.prompt}>
                      {truncate(r.prompt || '', 50)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem', color: '#374151' }}>{r.latency_ms ?? '-'}ms</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem', color: '#374151' }}>{r.cost != null ? formatCost(r.cost) : '-'}</TableCell>
                    <TableCell align="center">
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell align="center">
                      {r.cache_hit
                        ? <Check style={{ width: 16, height: 16, color: '#22c55e', margin: '0 auto' }} />
                        : <Minus style={{ width: 16, height: 16, color: '#d1d5db', margin: '0 auto' }} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>

          {/* Pagination */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, pt: 1.5, borderTop: '1px solid #f3f4f6' }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>
              Showing {pagination.total > 0 ? pagination.offset + 1 : 0}-{Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ChevronLeft style={{ width: 14, height: 14 }} />}
                onClick={() => setLogOffset(Math.max(0, logOffset - logLimit))}
                disabled={logOffset === 0}
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  textTransform: 'none',
                  borderColor: '#e5e7eb',
                  color: '#4b5563',
                  borderRadius: '8px',
                  px: 1.5,
                  py: 0.5,
                  '&:hover': { backgroundColor: '#f9fafb', borderColor: '#d1d5db' },
                  '&.Mui-disabled': { opacity: 0.4 },
                }}
              >
                Previous
              </Button>
              <Button
                variant="outlined"
                size="small"
                endIcon={<ChevronRight style={{ width: 14, height: 14 }} />}
                onClick={() => setLogOffset(logOffset + logLimit)}
                disabled={logOffset + logLimit >= pagination.total}
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  textTransform: 'none',
                  borderColor: '#e5e7eb',
                  color: '#4b5563',
                  borderRadius: '8px',
                  px: 1.5,
                  py: 0.5,
                  '&:hover': { backgroundColor: '#f9fafb', borderColor: '#d1d5db' },
                  '&.Mui-disabled': { opacity: 0.4 },
                }}
              >
                Next
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* ---------------------------------------------------------------- */}
        {/* Export Section                                                    */}
        {/* ---------------------------------------------------------------- */}
        <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3 }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', mb: 0.5 }}>Export Analytics</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: '#6b7280', mb: 2 }}>
            Download analytics data for offline analysis or reporting.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button
              variant="contained"
              startIcon={<Download style={{ width: 16, height: 16 }} />}
              onClick={exportCSV}
              sx={{
                fontSize: '0.875rem',
                fontWeight: 500,
                textTransform: 'none',
                borderRadius: '8px',
                backgroundColor: '#2563eb',
                '&:hover': { backgroundColor: '#1d4ed8' },
              }}
            >
              Export as CSV
            </Button>
            <Button
              variant="outlined"
              startIcon={<FileJson style={{ width: 16, height: 16 }} />}
              onClick={exportSummary}
              sx={{
                fontSize: '0.875rem',
                fontWeight: 500,
                textTransform: 'none',
                borderRadius: '8px',
                borderColor: '#e5e7eb',
                color: '#374151',
                '&:hover': { backgroundColor: '#f9fafb', borderColor: '#d1d5db' },
              }}
            >
              Export Summary
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
