'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsAPI } from '@/lib/api';
import dynamic from 'next/dynamic';
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
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Grid from '@mui/material/Grid';
import { StatCard } from '@/components/StatCard';
import { PageHeader } from '@/components/PageHeader';
import ChartLoadingFallback from '@/components/ChartLoadingFallback';

const AnalyticsCharts = dynamic(() => import('./AnalyticsCharts'), {
  ssr: false,
  loading: () => <ChartLoadingFallback />,
});

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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    completed: { bg: 'rgba(16,185,129,0.1)', fg: '#15803d' },
    cache_hit: { bg: 'rgba(173,198,255,0.15)', fg: '#adc6ff' },
    error: { bg: 'rgba(239,68,68,0.1)', fg: '#b91c1c' },
  };
  const colors = map[status] || { bg: 'action.hover', fg: 'text.secondary' };
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
    openai: { bg: 'rgba(16,185,129,0.1)', fg: '#15803d' },
    anthropic: { bg: '#ffedd5', fg: '#c2410c' },
    google: { bg: 'rgba(173,198,255,0.15)', fg: '#adc6ff' },
    cohere: { bg: '#f3e8ff', fg: '#7e22ce' },
    local: { bg: 'action.hover', fg: 'text.secondary' },
  };
  const colors = map[(provider || '').toLowerCase()] || { bg: 'action.hover', fg: 'text.secondary' };
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
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={48} sx={{ color: '#2563eb' }} />
          <Typography sx={{ mt: 2, color: 'text.secondary' }}>Loading analytics...</Typography>
        </Box>
      </Box>
    );
  }

  // ------ Error state ------
  if (summaryError) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Alert
          severity="error"
          icon={<AlertCircle style={{ width: 24, height: 24 }} />}
          sx={{ maxWidth: 400, borderRadius: '8px' }}
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
      {/* Header */}
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
                border: '1px solid', borderColor: 'divider',
                color: 'text.secondary',
                '&.Mui-selected': {
                  backgroundColor: 'background.paper',
                  color: '#2563eb',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  '&:hover': { backgroundColor: 'rgba(173,198,255,0.08)' },
                },
                '&:hover': { backgroundColor: 'background.default' },
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
        {/* KPI Summary Row */}
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

        {/* Charts (dynamically loaded) */}
        <AnalyticsCharts
          timeSeries={timeSeries}
          tsLoading={tsLoading}
          latency={latency}
        />

        {/* Model Comparison Table */}
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <BarChart3 style={{ width: 16, height: 16, color: '#2563eb' }} />
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>
              Model Comparison
            </Typography>
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { borderBottom: '1px solid', borderColor: 'divider' } }}>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Model</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Requests</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Success Rate</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Latency</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Cost</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg Cost/Req</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last Used</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {models.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 4, textAlign: 'center', color: 'text.disabled', fontSize: '0.875rem', border: 'none' }}>
                      No model data available
                    </TableCell>
                  </TableRow>
                )}
                {models.map((m: any, i: number) => {
                  const rate = parseFloat(m.success_rate || '0');
                  const rateColor = rate >= 99 ? { bg: 'rgba(16,185,129,0.1)', fg: '#15803d' } : rate >= 95 ? { bg: '#fef9c3', fg: '#a16207' } : { bg: 'rgba(239,68,68,0.1)', fg: '#b91c1c' };
                  return (
                    <TableRow
                      key={i}
                      sx={{
                        backgroundColor: i % 2 === 1 ? 'background.default' : 'transparent',
                        '&:hover': { backgroundColor: 'rgba(173,198,255,0.06)' },
                        '& td': { borderBottom: '1px solid', borderColor: 'divider' },
                      }}
                    >
                      <TableCell sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'text.primary' }}>{m.model_name || m.model}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.875rem', color: 'text.primary' }}>{formatNumber(m.request_count || m.requests || 0)}</TableCell>
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
                      <TableCell align="right" sx={{ fontSize: '0.875rem', color: 'text.primary' }}>{m.avg_latency_ms ?? 0}ms</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.875rem', color: 'text.primary' }}>{m.total_cost ?? '$0.0000'}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.875rem', color: 'text.primary' }}>{m.avg_cost_per_request ?? '$0.0000'}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {m.last_used ? formatTimestamp(m.last_used) : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Paper>

        {/* Request History Table */}
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 1.5, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Filter style={{ width: 16, height: 16, color: 'text.secondary' }} />
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>
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
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider', borderRadius: '8px' },
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
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider', borderRadius: '8px' },
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
                <TableRow sx={{ '& th': { borderBottom: '1px solid', borderColor: 'divider' } }}>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>Time</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>Model</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>Provider</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>Prompt</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>Latency</TableCell>
                  <TableCell align="right" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>Cost</TableCell>
                  <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>Status</TableCell>
                  <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 600, color: 'text.secondary' }}>Cache</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logLoading && (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ py: 4, textAlign: 'center', color: 'text.disabled', fontSize: '0.875rem', border: 'none' }}>
                      Loading requests...
                    </TableCell>
                  </TableRow>
                )}
                {!logLoading && requestLog.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ py: 4, textAlign: 'center', color: 'text.disabled', fontSize: '0.875rem', border: 'none' }}>
                      No requests found
                    </TableCell>
                  </TableRow>
                )}
                {!logLoading && requestLog.map((r: any, i: number) => (
                  <TableRow
                    key={i}
                    sx={{
                      backgroundColor: i % 2 === 1 ? 'rgba(255,255,255,0.03)' : 'transparent',
                      '&:hover': { backgroundColor: 'rgba(173,198,255,0.05)' },
                      '& td': { borderBottom: '1px solid var(--mui-palette-divider)' },
                    }}
                  >
                    <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
                      {r.timestamp ? formatTimestamp(r.timestamp) : '-'}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', fontWeight: 500, color: 'text.primary' }}>{r.model || '-'}</TableCell>
                    <TableCell>
                      <ProviderBadge provider={r.provider} />
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary', maxWidth: 200 }} title={r.prompt}>
                      {truncate(r.prompt || '', 50)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem', color: 'text.primary' }}>{r.latency_ms ?? '-'}ms</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.75rem', color: 'text.primary' }}>{r.cost != null ? formatCost(r.cost) : '-'}</TableCell>
                    <TableCell align="center">
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell align="center">
                      {r.cache_hit
                        ? <Check style={{ width: 16, height: 16, color: '#22c55e', margin: '0 auto' }} />
                        : <Minus style={{ width: 16, height: 16, color: 'text.disabled', margin: '0 auto' }} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>

          {/* Pagination */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
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
                  fontSize: '0.75rem', fontWeight: 500, textTransform: 'none',
                  borderColor: 'divider', color: 'text.secondary', borderRadius: '8px', px: 1.5, py: 0.5,
                  '&:hover': { backgroundColor: 'background.default', borderColor: 'divider' },
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
                  fontSize: '0.75rem', fontWeight: 500, textTransform: 'none',
                  borderColor: 'divider', color: 'text.secondary', borderRadius: '8px', px: 1.5, py: 0.5,
                  '&:hover': { backgroundColor: 'background.default', borderColor: 'divider' },
                  '&.Mui-disabled': { opacity: 0.4 },
                }}
              >
                Next
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* Export Section */}
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary', mb: 0.5 }}>Export Analytics</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 2 }}>
            Download analytics data for offline analysis or reporting.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Button
              variant="contained"
              startIcon={<Download style={{ width: 16, height: 16 }} />}
              onClick={exportCSV}
              sx={{
                fontSize: '0.875rem', fontWeight: 500, textTransform: 'none', borderRadius: '8px',
                backgroundColor: '#2563eb', '&:hover': { backgroundColor: '#1d4ed8' },
              }}
            >
              Export as CSV
            </Button>
            <Button
              variant="outlined"
              startIcon={<FileJson style={{ width: 16, height: 16 }} />}
              onClick={exportSummary}
              sx={{
                fontSize: '0.875rem', fontWeight: 500, textTransform: 'none', borderRadius: '8px',
                borderColor: 'divider', color: 'text.primary',
                '&:hover': { backgroundColor: 'background.default', borderColor: 'divider' },
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
