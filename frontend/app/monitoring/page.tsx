'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Server, Activity, Wifi, Shield, AlertTriangle, CheckCircle,
  XCircle, Clock, Zap, Database, HardDrive, Globe, RefreshCw,
  Bell, TrendingUp
} from 'lucide-react';
import dynamic from 'next/dynamic';
import ChartLoadingFallback from '@/components/ChartLoadingFallback';

const MonitoringCharts = dynamic(() => import('./MonitoringCharts'), {
  ssr: false,
  loading: () => <ChartLoadingFallback />,
});
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import { PageHeader } from '@/components/PageHeader';

const MONO = 'var(--font-mono), "JetBrains Mono", monospace';

const sectionLabelSx = {
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.2em',
  color: '#c1c6d7',
  fontFamily: MONO,
};

// --- Data Hooks ---

function useSystemHealth() {
  return useQuery({
    queryKey: ['monitoring-system-health'],
    queryFn: async () => {
      const res = await api.get('/api/v1/system/health');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useWorkerMetrics() {
  return useQuery({
    queryKey: ['monitoring-worker-metrics'],
    queryFn: async () => {
      const res = await api.get('/api/v1/workers/metrics');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useWorkerList() {
  return useQuery({
    queryKey: ['monitoring-workers'],
    queryFn: async () => {
      const res = await api.get('/api/v1/workers');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useConnectionPools() {
  return useQuery({
    queryKey: ['monitoring-pools'],
    queryFn: async () => {
      const res = await api.get('/api/v1/optimization/pools');
      return res.data?.data;
    },
    refetchInterval: 10000,
  });
}

function useRateLimiter() {
  return useQuery({
    queryKey: ['monitoring-rate-limiter'],
    queryFn: async () => {
      const res = await api.get('/api/v1/metrics/rate-limiter');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useBackpressure() {
  return useQuery({
    queryKey: ['monitoring-backpressure'],
    queryFn: async () => {
      const res = await api.get('/api/v1/metrics/backpressure/status');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useMetricsSnapshot() {
  return useQuery({
    queryKey: ['monitoring-metrics'],
    queryFn: async () => {
      const res = await api.get('/api/v1/metrics/snapshot');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

// --- Main Component ---

export default function MonitoringPage() {
  const { data: health, isLoading: healthLoading } = useSystemHealth();
  const { data: workerMetrics } = useWorkerMetrics();
  const { data: workers } = useWorkerList();
  const { data: pools } = useConnectionPools();
  const { data: rateLimiter } = useRateLimiter();
  const { data: backpressure } = useBackpressure();
  const { data: metricsSnapshot } = useMetricsSnapshot();

  // Generate alerts based on current state
  const alerts = generateAlerts(health, workerMetrics, backpressure, metricsSnapshot);

  if (healthLoading) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 }, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress size={48} sx={{ color: '#adc6ff' }} />
        <Typography sx={{ mt: 2, color: 'text.secondary', fontSize: '0.875rem' }}>Connecting to monitoring...</Typography>
      </Box>
    );
  }

  const systemStatus = health?.status || 'unknown';
  const statusChipColor = systemStatus === 'healthy' ? 'success' : systemStatus === 'degraded' ? 'warning' : 'error';

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1400, mx: 'auto' }}>
      <PageHeader
        title="System Monitoring"
        subtitle="Real-time infrastructure health"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', fontSize: '0.75rem' }}>
              <RefreshCw className="w-3 h-3 animate-spin" />
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Auto-refresh 5s</Typography>
            </Box>
            <Chip
              label={systemStatus}
              color={statusChipColor as any}
              size="small"
              variant="outlined"
              sx={{ textTransform: 'capitalize', fontWeight: 600 }}
              icon={
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: systemStatus === 'healthy' ? '#53e16f' : systemStatus === 'degraded' ? '#ffb595' : '#ef4444',
                    animation: 'pulse 2s infinite',
                    ml: 0.5,
                  }}
                />
              }
            />
          </Box>
        }
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Backpressure Alert */}
        {backpressure?.active && (
          <Alert
            severity="error"
            icon={<AlertTriangle className="w-5 h-5" />}
            sx={{ borderRadius: '8px' }}
          >
            <Typography sx={{ fontWeight: 600, fontSize: '0.875rem' }}>Backpressure Active</Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>
              {backpressure.reason || 'System is under heavy load. Some requests may be rejected.'}
            </Typography>
          </Alert>
        )}

        {/* Alert Notifications */}
        {alerts.length > 0 && (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Bell className="w-4 h-4" style={{ color: '#ffb595' }} />
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 500, color: 'text.primary' }}>Alerts ({alerts.length})</Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {alerts.map((alert, i) => (
                <Alert
                  key={i}
                  severity={alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info'}
                  icon={
                    alert.severity === 'critical' ? <XCircle className="w-4 h-4" /> :
                    alert.severity === 'warning' ? <AlertTriangle className="w-4 h-4" /> :
                    <Bell className="w-4 h-4" />
                  }
                  sx={{ borderRadius: '8px', py: 0.5, '& .MuiAlert-message': { fontSize: '0.8125rem' } }}
                >
                  {alert.message}
                </Alert>
              ))}
            </Box>
          </Box>
        )}

        {/* ── INFRASTRUCTURE ── */}
        <Typography sx={{ ...sectionLabelSx, mt: 1 }}>Infrastructure</Typography>

        {/* System Health Checks */}
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Shield className="w-4 h-4" style={{ color: '#53e16f' }} />
            <Typography sx={sectionLabelSx}>Health Checks</Typography>
          </Box>
          <Grid container spacing={2}>
            {health?.checks && Object.entries(health.checks).map(([name, check]: [string, any]) => (
              <Grid size={{ xs: 6, md: 3 }} key={name}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderLeft: check.status ? '3px solid #53e16f' : '3px solid #ef4444',
                    backgroundColor: check.status ? 'rgba(83,225,111,0.06)' : 'rgba(239,68,68,0.06)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    {check.status ? <CheckCircle className="w-4 h-4" style={{ color: '#53e16f' }} /> : <XCircle className="w-4 h-4" style={{ color: '#ef4444' }} />}
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: 'text.primary', textTransform: 'uppercase', fontFamily: MONO, letterSpacing: '0.05em' }}>{name.replace('_', ' ')}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>
                    {typeof check === 'object' ? Object.entries(check).filter(([k]) => k !== 'status').map(([k, v]) => `${k}: ${v}`).join(', ') : String(check)}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>

        {/* Worker Pool Visualization */}
        <Grid container spacing={3}>
          {/* Worker Grid */}
          <Grid size={{ xs: 12, lg: 8 }}>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Server className="w-4 h-4" style={{ color: '#adc6ff' }} />
                <Typography sx={sectionLabelSx}>
                  Worker Pool ({workerMetrics?.total_workers || 0} workers)
                </Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(5, 1fr)', md: 'repeat(10, 1fr)' }, gap: 1, mb: 2 }}>
                {(workers || []).map((w: any, i: number) => (
                  <WorkerDot key={i} worker={w} />
                ))}
                {(!workers || workers.length === 0) && Array.from({ length: 10 }).map((_, i) => (
                  <Box
                    key={i}
                    sx={{
                      aspectRatio: '1',
                      borderRadius: '8px',
                      backgroundColor: 'action.hover',
                      border: '1px solid', borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Typography sx={{ fontSize: '10px', color: 'text.disabled' }}>{i + 1}</Typography>
                  </Box>
                ))}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: 'rgba(83,225,111,0.2)', border: '1px solid rgba(83,225,111,0.4)' }} />
                  <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', fontFamily: MONO, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Idle</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: 'rgba(173,198,255,0.2)', border: '1px solid rgba(173,198,255,0.4)' }} />
                  <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', fontFamily: MONO, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Busy</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '2px', backgroundColor: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)' }} />
                  <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', fontFamily: MONO, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Unhealthy</Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>

          {/* Queue Status */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, height: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <TrendingUp className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                <Typography sx={sectionLabelSx}>Queue Status</Typography>
              </Box>
              <Box>
                <GaugeCircle
                  value={workerMetrics?.queue_utilization || 0}
                  label="Queue Utilization"
                  color={
                    (workerMetrics?.queue_utilization || 0) > 80 ? '#ef4444' :
                    (workerMetrics?.queue_utilization || 0) > 50 ? '#ffb595' : '#53e16f'
                  }
                />
                <Grid container spacing={1.5} sx={{ mt: 2 }}>
                  <Grid size={{ xs: 6 }}><MetricBox label="Queued" value={workerMetrics?.queued_jobs || 0} color="yellow" /></Grid>
                  <Grid size={{ xs: 6 }}><MetricBox label="In Progress" value={workerMetrics?.jobs_in_progress || 0} color="blue" /></Grid>
                  <Grid size={{ xs: 6 }}><MetricBox label="Processed" value={workerMetrics?.total_jobs_processed || 0} color="green" /></Grid>
                  <Grid size={{ xs: 6 }}><MetricBox label="Failed" value={workerMetrics?.total_jobs_failed || 0} color="red" /></Grid>
                </Grid>
                <Box sx={{ pt: 2, mt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Throughput</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.primary', fontFamily: MONO }}>{(workerMetrics?.throughput_jobs_per_sec || 0).toFixed(2)} jobs/s</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Avg Duration</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.primary', fontFamily: MONO }}>{(workerMetrics?.avg_job_duration_ms || 0).toFixed(0)}ms</Typography>
                  </Box>
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Connection Pools */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <PoolCard
              icon={<Database className="w-4 h-4" />}
              title="Database Pool"
              data={pools?.database}
              color="blue"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <PoolCard
              icon={<HardDrive className="w-4 h-4" />}
              title="Redis Pool"
              data={pools?.redis}
              color="purple"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <PoolCard
              icon={<Globe className="w-4 h-4" />}
              title="HTTP Pool"
              data={pools?.http}
              color="green"
            />
          </Grid>
        </Grid>

        {/* ── PERFORMANCE ── */}
        <Typography sx={{ ...sectionLabelSx, mt: 1 }}>Performance</Typography>

        {/* Rate Limiting & Metrics */}
        <Grid container spacing={3}>
          {/* Rate Limiter */}
          <Grid size={{ xs: 12, lg: 6 }}>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, height: '100%', boxShadow: 'inset 3px 0 0 0 #ffb595' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Shield className="w-4 h-4" style={{ color: '#ffb595' }} />
                <Typography sx={sectionLabelSx}>Rate Limiting</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Total Requests</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', fontFamily: MONO, color: 'text.primary' }}>{rateLimiter?.total_requests || 0}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Allowed</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', fontFamily: MONO, color: '#53e16f' }}>{rateLimiter?.allowed || 0}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Rejected</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', fontFamily: MONO, color: '#ef4444' }}>{rateLimiter?.rejected || 0}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Active Users</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', fontFamily: MONO, color: 'text.primary' }}>{rateLimiter?.active_users || 0}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Limit</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', fontFamily: MONO, color: 'text.primary' }}>{rateLimiter?.requests_per_minute || 100} req/min</Typography>
                </Box>
                {/* Rejection rate bar */}
                <Box sx={{ pt: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Rejection Rate</Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                      {rateLimiter?.total_requests > 0
                        ? ((rateLimiter.rejected / rateLimiter.total_requests) * 100).toFixed(1)
                        : '0.0'}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={rateLimiter?.total_requests > 0
                      ? Math.min((rateLimiter.rejected / rateLimiter.total_requests) * 100, 100)
                      : 0}
                    sx={{
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: '#2a2a2a',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 2,
                        backgroundColor: '#ef4444',
                      },
                    }}
                  />
                </Box>
              </Box>
            </Paper>
          </Grid>

          {/* Performance Summary */}
          <Grid size={{ xs: 12, lg: 6 }}>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, height: '100%', boxShadow: 'inset 3px 0 0 0 #ffb595' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Zap className="w-4 h-4" style={{ color: '#ffb595' }} />
                <Typography sx={sectionLabelSx}>Performance Metrics</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Total Requests</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', fontFamily: MONO, color: 'text.primary' }}>{metricsSnapshot?.throughput?.total_requests || 0}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Req/Second</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', fontFamily: MONO, color: '#adc6ff' }}>{metricsSnapshot?.throughput?.requests_per_second || '0.00'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>P50 Latency</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', fontFamily: MONO, color: '#53e16f' }}>{metricsSnapshot?.latency?.p50_ms || 0}ms</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>P99 Latency</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', fontFamily: MONO, color: '#ffb595' }}>{metricsSnapshot?.latency?.p99_ms || 0}ms</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Error Rate</Typography>
                  <Typography sx={{
                    fontSize: '0.8125rem',
                    fontFamily: MONO,
                    color: parseFloat(metricsSnapshot?.errors?.error_rate || '0') > 5 ? '#ef4444' : '#53e16f',
                  }}>{metricsSnapshot?.errors?.error_rate || '0.00%'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Total Cost</Typography>
                  <Typography sx={{ fontSize: '0.8125rem', fontFamily: MONO, color: 'text.primary' }}>{metricsSnapshot?.cost?.total_cost || '$0.0000'}</Typography>
                </Box>
                {/* Latency bar chart (dynamically loaded) */}
                <MonitoringCharts metricsSnapshot={metricsSnapshot} />
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Backpressure Status */}
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, boxShadow: 'inset 3px 0 0 0 #adc6ff' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Activity className="w-4 h-4" style={{ color: '#adc6ff' }} />
            <Typography sx={sectionLabelSx}>Backpressure Status</Typography>
          </Box>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: '8px', border: '1px solid', borderColor: 'divider', boxShadow: 'inset 3px 0 0 0 #adc6ff' }}>
                <Chip
                  size="small"
                  label={backpressure?.active ? 'Active' : 'Inactive'}
                  color={backpressure?.active ? 'error' : 'success'}
                  variant="outlined"
                  icon={backpressure?.active ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                  sx={{ fontSize: '0.75rem' }}
                />
                <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', mt: 0.5, fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Status</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: '8px', border: '1px solid', borderColor: 'divider', boxShadow: 'inset 3px 0 0 0 #adc6ff' }}>
                <Typography sx={{ fontSize: '1.125rem', fontFamily: MONO, fontWeight: 700, color: 'text.primary' }}>{backpressure?.queue_usage || '0.00%'}</Typography>
                <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Queue Usage</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: '8px', border: '1px solid', borderColor: 'divider', boxShadow: 'inset 3px 0 0 0 #adc6ff' }}>
                <Typography sx={{ fontSize: '1.125rem', fontFamily: MONO, fontWeight: 700, color: 'text.primary' }}>{backpressure?.worker_utilization || '0.00%'}</Typography>
                <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Worker Utilization</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: '8px', border: '1px solid', borderColor: 'divider', boxShadow: 'inset 3px 0 0 0 #ef4444' }}>
                <Typography sx={{ fontSize: '1.125rem', fontFamily: MONO, fontWeight: 700, color: '#ef4444' }}>{backpressure?.requests_rejected || 0}</Typography>
                <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Rejected</Typography>
              </Paper>
            </Grid>
          </Grid>
        </Paper>

        {/* Model Performance */}
        {metricsSnapshot?.models && metricsSnapshot.models.length > 0 && (
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Zap className="w-4 h-4" style={{ color: '#ffb595' }} />
              <Typography sx={sectionLabelSx}>Model Performance</Typography>
            </Box>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Model</TableCell>
                    <TableCell align="right">Requests</TableCell>
                    <TableCell align="right">Success Rate</TableCell>
                    <TableCell align="right">Avg Latency</TableCell>
                    <TableCell align="right">Total Cost</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {metricsSnapshot.models.map((m: any, i: number) => (
                    <TableRow
                      key={i}
                      sx={{
                        '& td': { borderBottom: '1px solid', borderColor: 'divider', fontSize: '0.75rem', py: 1 },
                        '&:hover': { backgroundColor: 'rgba(32,31,31,0.3)' },
                      }}
                    >
                      <TableCell sx={{ fontFamily: MONO, color: 'text.primary' }}>{m.model_name}</TableCell>
                      <TableCell align="right" sx={{ color: 'text.primary' }}>{m.request_count}</TableCell>
                      <TableCell align="right" sx={{ color: parseFloat(m.success_rate) > 95 ? '#53e16f' : '#ffb595' }}>
                        {m.success_rate}
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'text.primary' }}>{m.avg_latency_ms}ms</TableCell>
                      <TableCell align="right" sx={{ color: 'text.primary' }}>{m.total_cost}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Paper>
        )}
      </Box>
    </Box>
  );
}

// --- Sub Components ---

function WorkerDot({ worker }: { worker: any }) {
  const status = worker.status || 'idle';
  const colorMap: Record<string, { bg: string; border: string; dot: string }> = {
    idle: { bg: 'rgba(83,225,111,0.12)', border: 'rgba(83,225,111,0.25)', dot: '#53e16f' },
    busy: { bg: 'rgba(173,198,255,0.12)', border: 'rgba(173,198,255,0.25)', dot: '#adc6ff' },
    unhealthy: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', dot: '#ef4444' },
  };

  const colors = colorMap[status] || colorMap.idle;

  return (
    <Box
      sx={{
        aspectRatio: '1',
        borderRadius: '8px',
        border: '1px solid',
        borderColor: colors.border,
        backgroundColor: colors.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'default',
        position: 'relative',
        ...(status === 'unhealthy' && {
          animation: 'pulse 2s infinite',
        }),
      }}
      title={`Worker ${worker.id || '?'} - ${status} (Jobs: ${worker.jobs_processed || 0})`}
    >
      <Typography sx={{ fontSize: '9px', fontFamily: MONO, color: 'text.secondary', opacity: 0.8 }}>
        {(worker.id || '').replace('worker-', '')}
      </Typography>
      <Box sx={{
        position: 'absolute',
        top: 3,
        right: 3,
        width: 5,
        height: 5,
        borderRadius: '50%',
        backgroundColor: colors.dot,
      }} />
    </Box>
  );
}

function GaugeCircle({ value, label, color }: { value: number; label: string; color: string }) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
      <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r="40" fill="none" stroke="#2a2a2a" strokeWidth="6" />
        <circle
          cx="50" cy="50" r="40" fill="none"
          stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'all 1s ease' }}
        />
      </svg>
      <Box sx={{ position: 'absolute', top: '32px', textAlign: 'center' }}>
        <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: MONO, color: 'text.primary' }}>{value.toFixed(1)}%</Typography>
      </Box>
      <Typography sx={{ fontSize: '10px', color: 'text.secondary', mt: 0.5 }}>{label}</Typography>
    </Box>
  );
}

function MetricBox({ label, value, color }: { label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    green: '#53e16f',
    blue: '#adc6ff',
    yellow: '#ffb595',
    red: '#ef4444',
  };

  return (
    <Paper
      elevation={0}
      sx={{
        backgroundColor: 'background.default',
        border: '1px solid', borderColor: 'divider',
        borderRadius: '8px',
        p: 1,
        boxShadow: `inset 3px 0 0 0 ${colorMap[color]}`,
        transition: 'background-color 0.15s',
        '&:hover': { backgroundColor: '#2a2a2a' },
      }}
    >
      <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, fontFamily: MONO, color: colorMap[color] }}>{value}</Typography>
      <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</Typography>
    </Paper>
  );
}

function PoolCard({ icon, title, data, color }: { icon: React.ReactNode; title: string; data: any; color: string }) {
  const colorMap: Record<string, string> = {
    blue: '#adc6ff',
    purple: '#8b5cf6',
    green: '#53e16f',
  };

  const active = data?.active_connections || data?.active || 0;
  const idle = data?.idle_connections || data?.idle || 0;
  const total = data?.max_connections || data?.total || data?.max || 10;
  const used = active + idle;
  const pct = total > 0 ? (used / total) * 100 : 0;

  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 2.5, boxShadow: `inset 3px 0 0 0 ${colorMap[color]}` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Box sx={{ color: colorMap[color] }}>{icon}</Box>
        <Typography sx={sectionLabelSx}>{title}</Typography>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Active</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.primary', fontFamily: MONO }}>{active}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Idle</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.primary', fontFamily: MONO }}>{idle}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Max</Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'text.primary', fontFamily: MONO }}>{total}</Typography>
        </Box>
        <Box sx={{ pt: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Usage</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{pct.toFixed(0)}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(pct, 100)}
            sx={{
              height: 4,
              borderRadius: 2,
              backgroundColor: '#2a2a2a',
              '& .MuiLinearProgress-bar': {
                borderRadius: 2,
                backgroundColor: colorMap[color],
                transition: 'all 0.5s ease',
              },
            }}
          />
        </Box>
      </Box>
    </Paper>
  );
}

// --- Alert Generation ---

interface AlertItem {
  severity: 'critical' | 'warning' | 'info';
  message: string;
}

function generateAlerts(health: any, workerMetrics: any, backpressure: any, metrics: any): AlertItem[] {
  const alerts: AlertItem[] = [];

  if (health?.status === 'degraded') {
    alerts.push({ severity: 'warning', message: 'System health is degraded. Check individual health checks for details.' });
  }

  if (health?.issues && health.issues.length > 0) {
    health.issues.forEach((issue: string) => {
      alerts.push({ severity: 'warning', message: issue });
    });
  }

  if (backpressure?.active) {
    alerts.push({ severity: 'critical', message: `Backpressure active: ${backpressure.reason || 'High system load'}` });
  }

  if (workerMetrics?.unhealthy_workers > 0) {
    alerts.push({ severity: 'warning', message: `${workerMetrics.unhealthy_workers} unhealthy worker(s) detected` });
  }

  if ((workerMetrics?.queue_utilization || 0) > 80) {
    alerts.push({ severity: 'warning', message: `Queue utilization is high: ${workerMetrics.queue_utilization.toFixed(1)}%` });
  }

  const errorRate = parseFloat(metrics?.errors?.error_rate || '0');
  if (errorRate > 5) {
    alerts.push({ severity: 'critical', message: `High error rate: ${errorRate.toFixed(2)}%` });
  }

  return alerts;
}
