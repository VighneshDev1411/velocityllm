'use client';

import { useState, useEffect } from 'react';
import { workerAPI, WorkerStats, WorkerMetrics } from '@/lib/api';
import { Server, Activity, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';

export default function WorkersPage() {
  const [workers, setWorkers] = useState<WorkerStats[]>([]);
  const [metrics, setMetrics] = useState<WorkerMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [statsRes, metricsRes] = await Promise.all([
        workerAPI.getStats(),
        workerAPI.getMetrics(),
      ]);

      setWorkers(statsRes.data.data.workers || []);
      setMetrics(metricsRes.data.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch worker data');
      console.error('Error fetching worker data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress size={48} />
        <Typography sx={{ mt: 2, color: '#6b7280' }}>Loading workers...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Alert
          severity="error"
          action={
            <Button color="error" variant="contained" size="small" onClick={fetchData}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <PageHeader
        title="Worker Pool"
        subtitle="Monitor and manage worker instances"
        action={
          <Button
            variant="outlined"
            startIcon={<RefreshCw size={16} />}
            onClick={fetchData}
          >
            Refresh
          </Button>
        }
      />

      {/* Summary Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <StatCard
            icon={<Server size={20} />}
            label="Total Workers"
            value={metrics?.total_workers || 0}
            color="blue"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <StatCard
            icon={<Activity size={20} />}
            label="Busy Workers"
            value={metrics?.busy_workers || 0}
            color="orange"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <StatCard
            icon={<TrendingUp size={20} />}
            label="Idle Workers"
            value={metrics?.idle_workers || 0}
            color="green"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <StatCard
            icon={<AlertCircle size={20} />}
            label="Unhealthy"
            value={metrics?.unhealthy_workers || 0}
            color="red"
          />
        </Grid>
      </Grid>

      {/* Worker Grid */}
      <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
        <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #e5e7eb' }}>
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600, color: '#111827' }}>
            Active Workers
          </Typography>
        </Box>

        <Box sx={{ p: 3 }}>
          {workers.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: '#9ca3af' }}>
              <Server size={48} style={{ margin: '0 auto 16px', display: 'block', color: '#d1d5db' }} />
              <Typography>No workers available</Typography>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {workers.map((worker) => (
                <Grid size={{ xs: 12, md: 6, lg: 4 }} key={worker.id}>
                  <WorkerCard worker={worker} />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

// Worker Card Component
function WorkerCard({ worker }: { worker: WorkerStats }) {
  const getStatusChipProps = () => {
    switch (worker.status) {
      case 'idle':
        return { label: 'idle', sx: { backgroundColor: '#ecfdf5', color: '#059669', fontWeight: 600, fontSize: '0.75rem' } };
      case 'busy':
        return { label: 'busy', sx: { backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: 600, fontSize: '0.75rem' } };
      case 'unhealthy':
        return { label: 'unhealthy', sx: { backgroundColor: '#fef2f2', color: '#dc2626', fontWeight: 600, fontSize: '0.75rem' } };
      default:
        return { label: worker.status, sx: { backgroundColor: '#fefce8', color: '#ca8a04', fontWeight: 600, fontSize: '0.75rem' } };
    }
  };

  const getHealthColor = () => {
    if (worker.health_score >= 80) return '#22c55e';
    if (worker.health_score >= 50) return '#eab308';
    return '#ef4444';
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <Paper
      elevation={0}
      sx={{
        border: '1px solid #e5e7eb',
        borderRadius: '12px',
        p: 3,
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: '8px',
              backgroundColor: '#eff6ff',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Server size={20} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 600, color: '#111827', fontSize: '0.9rem' }}>{worker.id}</Typography>
            <Chip size="small" {...getStatusChipProps()} />
          </Box>
        </Box>
      </Box>

      {/* Stats */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.875rem', color: '#6b7280' }}>Jobs Processed</Typography>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
            {worker.jobs_processed}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.875rem', color: '#6b7280' }}>Jobs Failed</Typography>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#dc2626' }}>
            {worker.jobs_failed}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.875rem', color: '#6b7280' }}>Health Score</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinearProgress
              variant="determinate"
              value={worker.health_score}
              sx={{
                width: 64,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#e5e7eb',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: getHealthColor(),
                  borderRadius: 4,
                },
              }}
            />
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
              {worker.health_score.toFixed(0)}%
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.875rem', color: '#6b7280' }}>Uptime</Typography>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
            {formatUptime(worker.uptime_seconds)}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ fontSize: '0.875rem', color: '#6b7280' }}>Last Heartbeat</Typography>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
            {formatDate(worker.last_heartbeat)}
          </Typography>
        </Box>
      </Box>

      {/* Current Job (if any) */}
      {(worker as any).current_job && (
        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e5e7eb' }}>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', mb: 1 }}>
            Current Job:
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  color: '#111827',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {(worker as any).current_job.id}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>
                {((worker as any).current_job.duration / 1000).toFixed(1)}s
              </Typography>
            </Box>
            <CircularProgress size={16} />
          </Box>
        </Box>
      )}
    </Paper>
  );
}
