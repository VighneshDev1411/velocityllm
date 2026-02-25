'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import {
  Activity, Zap, Server, TrendingUp, AlertCircle, DollarSign,
  Clock, BarChart3, RefreshCw
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { useTheme } from '@mui/material/styles';
import { useDashboardOverview, useTimeSeries, useModelComparison, useCostBreakdown } from '@/hooks/useAnalytics';
import { StatCard } from '@/components/StatCard';
import { PageHeader } from '@/components/PageHeader';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function Dashboard() {
  const theme = useTheme();
  const tooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: '8px', fontSize: '12px', color: theme.palette.text.primary };
  const [timeRange, setTimeRange] = useState('24h');

  const { data: overview, isLoading: overviewLoading, error: overviewError } = useDashboardOverview();
  const { data: timeSeries, isLoading: tsLoading } = useTimeSeries(timeRange);
  const { data: modelData } = useModelComparison();
  const { data: costData } = useCostBreakdown();

  if (overviewLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress size={40} />
        <Typography sx={{ mt: 2, color: 'text.secondary' }}>Loading dashboard...</Typography>
      </Box>
    );
  }

  if (overviewError) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', p: 3 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => window.location.reload()} startIcon={<RefreshCw className="w-4 h-4" />}>
              Retry
            </Button>
          }
          sx={{ maxWidth: 500 }}
        >
          Failed to fetch dashboard data. Make sure the backend is running.
        </Alert>
      </Box>
    );
  }

  const ov = overview?.overview || {};
  const latency = overview?.latency || {};
  const workers = overview?.workers || {};

  const formatNumber = (num: number) => {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCost = (cost: number) => {
    if (!cost && cost !== 0) return '$0.00';
    return `$${cost.toFixed(4)}`;
  };

  const formatTime = (timeStr: string) => {
    const d = new Date(timeStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const hasData = Number(ov.total_requests || 0) > 0;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* No data banner */}
      {!hasData && (
        <Alert
          icon={<Zap className="w-5 h-5" />}
          severity="info"
          sx={{ mb: 3, borderRadius: '10px' }}
        >
          <strong>No requests yet.</strong> Send prompts via the Playground or run{' '}
          <code style={{ backgroundColor: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>
            ./scripts/demo-load.sh --quick
          </code>{' '}
          to populate dashboards with real data.
        </Alert>
      )}

      {/* Header */}
      <PageHeader
        title="Dashboard"
        subtitle="Real-time system monitoring & analytics"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: overview?.status === 'healthy' ? '#10b981' : '#f59e0b',
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
                }}
              />
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 500, color: 'text.secondary', textTransform: 'capitalize' }}>
                {overview?.status || 'unknown'}
              </Typography>
            </Box>
            <ToggleButtonGroup
              value={timeRange}
              exclusive
              onChange={(_, val) => val && setTimeRange(val)}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  px: 1.5, py: 0.5, fontSize: '0.75rem', fontWeight: 600,
                  border: '1px solid', borderColor: 'divider', textTransform: 'none',
                  '&.Mui-selected': { backgroundColor: 'background.paper', color: '#3b82f6', boxShadow: '0 1px 2px rgb(0 0 0 / 0.05)' },
                },
              }}
            >
              {['1h', '6h', '24h', '7d'].map((range) => (
                <ToggleButton key={range} value={range}>{range}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        }
      />

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={<Activity className="w-5 h-5" />}
            label="Total Requests"
            value={formatNumber(ov.total_requests || 0)}
            subtext={`${ov.requests_per_second || '0.00'} req/s`}
            color="blue"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={<DollarSign className="w-5 h-5" />}
            label="Total Cost"
            value={formatCost(ov.total_cost || 0)}
            subtext={`Avg ${formatCost(ov.avg_cost_per_request || 0)}/req`}
            color="green"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            label="Avg Latency"
            value={`${latency.mean_ms || 0}ms`}
            subtext={`P99: ${latency.p99_ms || 0}ms`}
            color="purple"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={<AlertCircle className="w-5 h-5" />}
            label="Error Rate"
            value={`${(ov.error_rate || 0).toFixed(2)}%`}
            subtext={`${ov.total_errors || 0} total errors`}
            color={ov.error_rate > 5 ? 'red' : 'green'}
          />
        </Grid>
      </Grid>

      {/* Charts Row 1 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <BarChart3 className="w-4 h-4" style={{ color: '#3b82f6' }} />
              Request Volume
            </Typography>
            <Box sx={{ height: 260 }}>
              {tsLoading ? (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress size={24} /></Box>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeries?.requests || []}>
                    <defs>
                      <linearGradient id="requestGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 11, fill: 'var(--mui-palette-text-disabled)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--mui-palette-text-disabled)' }} axisLine={false} tickLine={false} />
                    <Tooltip labelFormatter={(label) => new Date(label).toLocaleString()} contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="requests" stroke="#3b82f6" strokeWidth={2} fill="url(#requestGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Clock className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              Latency Distribution
            </Typography>
            <Box sx={{ height: 260 }}>
              {tsLoading ? (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress size={24} /></Box>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeries?.latency || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 11, fill: 'var(--mui-palette-text-disabled)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--mui-palette-text-disabled)' }} axisLine={false} tickLine={false} unit="ms" />
                    <Tooltip labelFormatter={(label) => new Date(label).toLocaleString()} contentStyle={tooltipStyle} />
                    <Legend iconType="line" wrapperStyle={{ fontSize: '11px' }} />
                    <Line type="monotone" dataKey="p50_ms" name="P50" stroke="#10b981" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="p90_ms" name="P90" stroke="#f59e0b" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="p99_ms" name="P99" stroke="#ef4444" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Charts Row 2 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <DollarSign className="w-4 h-4" style={{ color: '#10b981' }} />
              Cost by Provider
            </Typography>
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={costData?.by_provider || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: $${value.toFixed(2)}`}
                  >
                    {(costData?.by_provider || []).map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Server className="w-4 h-4" style={{ color: '#3b82f6' }} />
              Model Performance
            </Typography>
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelData?.models || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--mui-palette-text-disabled)' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="model" tick={{ fontSize: 11, fill: 'var(--mui-palette-text-secondary)' }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="requests" name="Requests" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Charts Row 3 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUp className="w-4 h-4" style={{ color: '#10b981' }} />
              Cost Trend
            </Typography>
            <Box sx={{ height: 220 }}>
              {tsLoading ? (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress size={24} /></Box>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeries?.cost || []}>
                    <defs>
                      <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 11, fill: 'var(--mui-palette-text-disabled)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--mui-palette-text-disabled)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip labelFormatter={(label) => new Date(label).toLocaleString()} formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']} contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="cost" stroke="#10b981" strokeWidth={2} fill="url(#costGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <AlertCircle className="w-4 h-4" style={{ color: '#ef4444' }} />
              Error Trend
            </Typography>
            <Box sx={{ height: 220 }}>
              {tsLoading ? (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress size={24} /></Box>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeSeries?.errors || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 11, fill: 'var(--mui-palette-text-disabled)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--mui-palette-text-disabled)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip labelFormatter={(label) => new Date(label).toLocaleString()} contentStyle={tooltipStyle} />
                    <Bar dataKey="errors" name="Errors" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Bottom Row: Workers + Latency Percentiles + Cost by Model */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Server className="w-4 h-4" style={{ color: '#3b82f6' }} />
              Worker Pool
            </Typography>
            <Box sx={{ '& > * + *': { mt: 2 } }}>
              <MetricBar label="Idle" value={workers.idle || 0} max={workers.total || 10} color="#10b981" />
              <MetricBar label="Busy" value={workers.busy || 0} max={workers.total || 10} color="#3b82f6" />
              <MetricBar label="Unhealthy" value={workers.unhealthy || 0} max={workers.total || 10} color="#ef4444" />
              <Box sx={{ pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Queue Utilization</Typography>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{(workers.utilization || 0).toFixed(1)}%</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Queued Jobs</Typography>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{workers.queued_jobs || 0}</Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Clock className="w-4 h-4" style={{ color: '#8b5cf6' }} />
              Latency Percentiles
            </Typography>
            <Box sx={{ '& > * + *': { mt: 2 } }}>
              <MetricBar label="P50 (Median)" value={latency.p50_ms || 0} max={latency.p99_ms || 100} color="#10b981" unit="ms" />
              <MetricBar label="P90" value={latency.p90_ms || 0} max={latency.p99_ms || 100} color="#f59e0b" unit="ms" />
              <MetricBar label="P95" value={latency.p95_ms || 0} max={latency.p99_ms || 100} color="#f97316" unit="ms" />
              <MetricBar label="P99" value={latency.p99_ms || 0} max={latency.p99_ms || 100} color="#ef4444" unit="ms" />
              <Box sx={{ pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Min / Max</Typography>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{latency.min_ms || 0}ms / {latency.max_ms || 0}ms</Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Zap className="w-4 h-4" style={{ color: '#f59e0b' }} />
              Cost by Model
            </Typography>
            <Box>
              {(costData?.by_model || []).map((item: any, idx: number) => (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: COLORS[idx % COLORS.length] }} />
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: 'text.primary', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.name}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'text.primary' }}>
                    ${item.value?.toFixed(4)}
                  </Typography>
                </Box>
              ))}
              {(costData?.by_model || []).length === 0 && (
                <Typography sx={{ fontSize: '0.8rem', color: 'text.disabled', textAlign: 'center', py: 4 }}>No cost data yet</Typography>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

function MetricBar({ label, value, max, color, unit }: {
  label: string; value: number; max: number; color: string; unit?: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: 'text.secondary' }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{value}{unit ? unit : `/${max}`}</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 6,
          borderRadius: 3,
          backgroundColor: 'action.hover',
          '& .MuiLinearProgress-bar': { backgroundColor: color, borderRadius: 3 },
        }}
      />
    </Box>
  );
}
