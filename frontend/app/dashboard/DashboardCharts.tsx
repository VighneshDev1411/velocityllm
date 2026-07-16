'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import {
  Clock, BarChart3, DollarSign, Server, TrendingUp, AlertCircle, Zap,
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useTheme } from '@mui/material/styles';

const COLORS = ['#adc6ff', '#4b8eff', '#53e16f', '#ffb595', '#ef4444', '#ffb595'];

interface DashboardChartsProps {
  timeSeries: any;
  tsLoading: boolean;
  modelData: any;
  costData: any;
  overview: any;
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

export default function DashboardCharts({ timeSeries, tsLoading, modelData, costData, overview }: DashboardChartsProps) {
  const theme = useTheme();
  const tooltipStyle = { backgroundColor: '#201f1f', border: '1px solid rgba(65,71,85,0.3)', borderRadius: '6px', fontSize: '12px', color: '#e5e2e1' };

  const latency = overview?.latency || {};
  const workers = overview?.workers || {};

  const formatTime = (timeStr: string) => {
    const d = new Date(timeStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      {/* Charts Row 1 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <BarChart3 className="w-4 h-4" style={{ color: '#adc6ff' }} />
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
                        <stop offset="5%" stopColor="#adc6ff" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#adc6ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(65,71,85,0.2)" />
                    <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 11, fill: '#c1c6d7' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#c1c6d7' }} axisLine={false} tickLine={false} />
                    <Tooltip labelFormatter={(label) => new Date(label).toLocaleString()} contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="requests" stroke="#adc6ff" strokeWidth={2} fill="url(#requestGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Clock className="w-4 h-4" style={{ color: '#4b8eff' }} />
              Latency Distribution
            </Typography>
            <Box sx={{ height: 260 }}>
              {tsLoading ? (
                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress size={24} /></Box>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeries?.latency || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(65,71,85,0.2)" />
                    <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 11, fill: '#c1c6d7' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#c1c6d7' }} axisLine={false} tickLine={false} unit="ms" />
                    <Tooltip labelFormatter={(label) => new Date(label).toLocaleString()} contentStyle={tooltipStyle} />
                    <Legend iconType="line" wrapperStyle={{ fontSize: '11px' }} />
                    <Line type="monotone" dataKey="p50_ms" name="P50" stroke="#53e16f" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="p90_ms" name="P90" stroke="#ffb595" strokeWidth={2} dot={false} />
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
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <DollarSign className="w-4 h-4" style={{ color: '#53e16f' }} />
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
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Server className="w-4 h-4" style={{ color: '#adc6ff' }} />
              Model Performance
            </Typography>
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelData?.models || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(65,71,85,0.2)" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#c1c6d7' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="model" tick={{ fontSize: 11, fill: '#c1c6d7' }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="requests" name="Requests" fill="#adc6ff" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Charts Row 3 */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUp className="w-4 h-4" style={{ color: '#53e16f' }} />
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
                        <stop offset="5%" stopColor="#53e16f" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#53e16f" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(65,71,85,0.2)" />
                    <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 11, fill: '#c1c6d7' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#c1c6d7' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip labelFormatter={(label) => new Date(label).toLocaleString()} formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']} contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="cost" stroke="#53e16f" strokeWidth={2} fill="url(#costGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
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
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(65,71,85,0.2)" />
                    <XAxis dataKey="time" tickFormatter={formatTime} tick={{ fontSize: 11, fill: '#c1c6d7' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#c1c6d7' }} axisLine={false} tickLine={false} allowDecimals={false} />
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
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Server className="w-4 h-4" style={{ color: '#adc6ff' }} />
              Worker Pool
            </Typography>
            <Box sx={{ '& > * + *': { mt: 2 } }}>
              <MetricBar label="Idle" value={workers.idle || 0} max={workers.total || 10} color="#53e16f" />
              <MetricBar label="Busy" value={workers.busy || 0} max={workers.total || 10} color="#adc6ff" />
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
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Clock className="w-4 h-4" style={{ color: '#4b8eff' }} />
              Latency Percentiles
            </Typography>
            <Box sx={{ '& > * + *': { mt: 2 } }}>
              <MetricBar label="P50 (Median)" value={latency.p50_ms || 0} max={latency.p99_ms || 100} color="#53e16f" unit="ms" />
              <MetricBar label="P90" value={latency.p90_ms || 0} max={latency.p99_ms || 100} color="#ffb595" unit="ms" />
              <MetricBar label="P95" value={latency.p95_ms || 0} max={latency.p99_ms || 100} color="#ffb595" unit="ms" />
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
          <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'text.primary', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Zap className="w-4 h-4" style={{ color: '#ffb595' }} />
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
    </>
  );
}
