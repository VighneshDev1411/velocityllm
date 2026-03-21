'use client';

import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import {
  Activity, Zap, Clock, AlertTriangle, Cpu, HardDrive,
  Radio, Users, BarChart3, GitBranch,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import ChartLoadingFallback from '@/components/ChartLoadingFallback';

const RealtimeCharts = dynamic(() => import('./RealtimeCharts'), {
  ssr: false,
  loading: () => <ChartLoadingFallback />,
});
import { useWebSocket, RealtimeMetrics } from '@/hooks/useWebSocket';

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function StatCard({
  icon: Icon, label, value, subtitle, color = '#6C63FF',
}: {
  icon: React.ComponentType<any>;
  label: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}) {
  return (
    <Paper sx={{ p: 2.5, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
        <Box sx={{
          p: 1, borderRadius: 1.5,
          bgcolor: `${color}18`, display: 'flex',
        }}>
          <Icon size={20} color={color} />
        </Box>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </Box>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>{value}</Typography>
      {subtitle && (
        <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
      )}
    </Paper>
  );
}

function GaugeCircle({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress
          variant="determinate"
          value={100}
          size={100}
          thickness={4}
          sx={{ color: 'action.hover', position: 'absolute' }}
        />
        <CircularProgress
          variant="determinate"
          value={Math.min(value, 100)}
          size={100}
          thickness={4}
          sx={{ color }}
        />
        <Box sx={{
          position: 'absolute', top: 0, left: 0, bottom: 0, right: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {value.toFixed(0)}%
          </Typography>
        </Box>
      </Box>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
    </Box>
  );
}

export default function RealtimeDashboard() {
  const { connected, metrics, lastUpdate, reconnectCount, metricsHistory } = useWebSocket();

  const chartData = useMemo(() => {
    return metricsHistory.map((m: RealtimeMetrics, i: number) => ({
      time: new Date(m.timestamp).toLocaleTimeString(),
      rps: Number(m.requests_per_sec.toFixed(2)),
      latency: m.avg_latency_ms,
      errors: m.total_errors,
      connections: m.active_connections,
      goroutines: m.goroutines,
    }));
  }, [metricsHistory]);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Real-Time Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Live system metrics via WebSocket
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Chip
            icon={<Box sx={{
              width: 8, height: 8, borderRadius: '50%',
              bgcolor: connected ? '#4CAF50' : '#f44336',
              animation: connected ? 'pulse 2s infinite' : 'none',
              '@keyframes pulse': {
                '0%': { opacity: 1 },
                '50%': { opacity: 0.5 },
                '100%': { opacity: 1 },
              },
            }} />}
            label={connected ? 'Connected' : 'Disconnected'}
            color={connected ? 'success' : 'error'}
            variant="outlined"
            size="small"
          />
          {reconnectCount > 0 && (
            <Typography variant="caption" color="text.secondary">
              Reconnects: {reconnectCount}
            </Typography>
          )}
          {lastUpdate && (
            <Typography variant="caption" color="text.secondary">
              Last: {lastUpdate.toLocaleTimeString()}
            </Typography>
          )}
        </Box>
      </Box>

      {!metrics ? (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <CircularProgress size={40} sx={{ mb: 2 }} />
          <Typography color="text.secondary">
            {connected ? 'Waiting for metrics...' : 'Connecting to WebSocket...'}
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {/* Stat Cards Row */}
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={Zap}
              label="Requests/sec"
              value={metrics.requests_per_sec.toFixed(2)}
              color="#6C63FF"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={Users}
              label="Active Connections"
              value={metrics.active_connections}
              color="#00BCD4"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={Clock}
              label="Avg Latency"
              value={`${metrics.avg_latency_ms}ms`}
              color="#FF9800"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={AlertTriangle}
              label="Error Rate"
              value={`${metrics.error_rate.toFixed(2)}%`}
              subtitle={`${metrics.total_errors} total errors`}
              color="#f44336"
            />
          </Grid>

          {/* Summary row */}
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={BarChart3}
              label="Total Requests"
              value={metrics.total_requests.toLocaleString()}
              color="#4CAF50"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={GitBranch}
              label="Goroutines"
              value={metrics.goroutines}
              color="#9C27B0"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={Activity}
              label="Uptime"
              value={formatUptime(metrics.uptime_seconds)}
              color="#2196F3"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={HardDrive}
              label="Memory"
              value={`${metrics.memory_usage_mb.toFixed(1)} MB`}
              color="#FF5722"
            />
          </Grid>

          {/* Charts (dynamically loaded) */}
          <RealtimeCharts chartData={chartData} />

          {/* System Gauges */}
          <Grid size={{ xs: 12, lg: 4 }}>
            <Paper sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 3 }}>
                System Resources
              </Typography>
              <Box sx={{
                display: 'flex', justifyContent: 'space-around',
                alignItems: 'center', flex: 1,
              }}>
                <GaugeCircle
                  value={metrics.cpu_usage}
                  label="CPU"
                  color={metrics.cpu_usage > 80 ? '#f44336' : metrics.cpu_usage > 50 ? '#FF9800' : '#4CAF50'}
                />
                <GaugeCircle
                  value={metrics.memory_usage_pct}
                  label="Memory"
                  color={metrics.memory_usage_pct > 80 ? '#f44336' : metrics.memory_usage_pct > 50 ? '#FF9800' : '#4CAF50'}
                />
              </Box>
            </Paper>
          </Grid>

          {/* Model Activity */}
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 2.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                Active Models
              </Typography>
              {metrics.models.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  No model activity yet — make some API requests to see data here
                </Typography>
              ) : (
                <List dense disablePadding>
                  {metrics.models.slice(0, 10).map((model, i) => (
                    <ListItem key={i} divider={i < metrics.models.length - 1} sx={{ px: 0 }}>
                      <ListItemText
                        primary={model.name}
                        secondary={`${model.request_count} requests · avg ${model.avg_latency}ms`}
                      />
                      <Chip
                        label={`${model.request_count} req`}
                        size="small"
                        sx={{ bgcolor: '#6C63FF22', color: '#6C63FF' }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
