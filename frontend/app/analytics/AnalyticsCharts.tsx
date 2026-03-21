'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import { Clock, Zap, DollarSign, BarChart3 } from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useTheme } from '@mui/material/styles';
import LinearProgress from '@mui/material/LinearProgress';

const CHART_BLUE = '#adc6ff';
const CHART_GREEN = '#53e16f';
const CHART_PURPLE = '#8b5cf6';
const CHART_YELLOW = '#ffb595';
const CHART_RED = '#ef4444';

function PercentileBar({ label, value, max, color }: {
  label: string; value: number; max: number; color: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: 'text.secondary' }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'text.primary' }}>{value}ms</Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={pct}
        sx={{
          height: 8,
          borderRadius: 4,
          backgroundColor: 'action.hover',
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

function ChartPlaceholder() {
  return (
    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box sx={{ textAlign: 'center' }}>
        <CircularProgress size={24} sx={{ color: '#60a5fa' }} />
        <Typography sx={{ mt: 1, fontSize: '0.75rem', color: 'text.disabled' }}>Loading chart...</Typography>
      </Box>
    </Box>
  );
}

interface AnalyticsChartsProps {
  timeSeries: any;
  tsLoading: boolean;
  latency: any;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function AnalyticsCharts({ timeSeries, tsLoading, latency }: AnalyticsChartsProps) {
  const theme = useTheme();
  const tooltipStyle = { backgroundColor: '#201f1f', border: '1px solid rgba(65,71,85,0.3)', borderRadius: '6px', fontSize: '12px', color: '#e5e2e1' };

  return (
    <Grid container spacing={3}>
      {/* Latency Percentiles Time Series */}
      <Grid size={{ xs: 12, lg: 6 }}>
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Clock style={{ width: 16, height: 16, color: '#7c3aed' }} />
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>
              Latency Percentiles Over Time
            </Typography>
          </Box>
          <Box sx={{ height: 256 }}>
            {tsLoading ? (
              <ChartPlaceholder />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeries?.latency || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(65,71,85,0.2)" />
                  <XAxis dataKey="time" tickFormatter={formatTime}
                    tick={{ fontSize: 11, fill: '#c1c6d7' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#c1c6d7' }} axisLine={false} tickLine={false} unit="ms" />
                  <Tooltip labelFormatter={(l) => new Date(l as string).toLocaleString()}
                    contentStyle={tooltipStyle} />
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
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <BarChart3 style={{ width: 16, height: 16, color: '#7c3aed' }} />
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>
              Latency Distribution
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <PercentileBar label="P50 (Median)" value={latency.p50_ms || 0} max={latency.p99_ms || 100} color="#53e16f" />
            <PercentileBar label="P90" value={latency.p90_ms || 0} max={latency.p99_ms || 100} color="#ffb595" />
            <PercentileBar label="P95" value={latency.p95_ms || 0} max={latency.p99_ms || 100} color="#8b5cf6" />
            <PercentileBar label="P99" value={latency.p99_ms || 0} max={latency.p99_ms || 100} color="#ef4444" />
          </Box>
          <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
            <Grid container spacing={2}>
              <Grid size={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Min</Typography>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'text.primary' }}>{latency.min_ms ?? 0}ms</Typography>
                </Box>
              </Grid>
              <Grid size={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Mean</Typography>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'text.primary' }}>{latency.mean_ms ?? 0}ms</Typography>
                </Box>
              </Grid>
              <Grid size={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Max</Typography>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'text.primary' }}>{latency.max_ms ?? 0}ms</Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </Paper>
      </Grid>

      {/* Request Throughput */}
      <Grid size={{ xs: 12, lg: 6 }}>
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Zap style={{ width: 16, height: 16, color: '#2563eb' }} />
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(65,71,85,0.2)" />
                  <XAxis dataKey="time" tickFormatter={formatTime}
                    tick={{ fontSize: 11, fill: '#c1c6d7' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#c1c6d7' }} axisLine={false} tickLine={false} />
                  <Tooltip labelFormatter={(l) => new Date(l as string).toLocaleString()}
                    contentStyle={tooltipStyle} />
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
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <DollarSign style={{ width: 16, height: 16, color: '#059669' }} />
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(65,71,85,0.2)" />
                  <XAxis dataKey="time" tickFormatter={formatTime}
                    tick={{ fontSize: 11, fill: '#c1c6d7' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#c1c6d7' }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `$${v}`} />
                  <Tooltip labelFormatter={(l) => new Date(l as string).toLocaleString()}
                    formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                    contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="cost" stroke={CHART_GREEN}
                    strokeWidth={2} fill="url(#costGradientAnalytics)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
}
