'use client';

import { useState, useEffect } from 'react';
import { streamAPI, StreamMetrics } from '@/lib/api';
import { Zap, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';

export default function StreamsPage() {
  const [metrics, setMetrics] = useState<StreamMetrics | null>(null);
  const [activeStreams, setActiveStreams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const metricsRes = await streamAPI.getMetrics();

      // The API returns metrics nested in data.data.metrics
      const data = metricsRes.data.data;
      setMetrics(data?.metrics || null);

      // Convert active_by_type object to array
      const activeByType = data?.active_by_type || {};
      const activeStreamsArray = Object.entries(activeByType).flatMap(([type, streams]: [string, any]) => {
        if (Array.isArray(streams)) {
          return streams.map(stream => ({ ...stream, type }));
        }
        return [];
      });

      setActiveStreams(activeStreamsArray);
    } catch (err) {
      console.error('Error fetching stream data:', err);
      setMetrics(null);
      setActiveStreams([]);
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress size={48} />
      </Box>
    );
  }

  const formatBytes = (bytes: number) => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <PageHeader
        title="Stream Monitoring"
        subtitle="Real-time stream activity and metrics"
      />

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <StatCard
            icon={<Activity size={20} />}
            label="Active Streams"
            value={metrics?.active_streams || 0}
            color="blue"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <StatCard
            icon={<CheckCircle size={20} />}
            label="Completed"
            value={metrics?.completed_streams || 0}
            color="green"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <StatCard
            icon={<XCircle size={20} />}
            label="Cancelled"
            value={metrics?.cancelled_streams || 0}
            color="yellow"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <StatCard
            icon={<Clock size={20} />}
            label="Errored"
            value={metrics?.errored_streams || 0}
            color="red"
          />
        </Grid>
      </Grid>

      {/* Performance Metrics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 3 }}>
            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 1 }}>Avg Duration</Typography>
            <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: 'text.primary' }}>
              {(metrics?.avg_duration_ms || 0).toFixed(0)}ms
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 3 }}>
            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 1 }}>Avg Chunks/Stream</Typography>
            <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: 'text.primary' }}>
              {(metrics?.avg_chunks_per_stream || 0).toFixed(1)}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 3 }}>
            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 1 }}>Data Streamed</Typography>
            <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: 'text.primary' }}>
              {formatBytes(metrics?.bytes_streamed || 0)}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Active Streams */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px' }}>
        <Box sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600, color: 'text.primary' }}>
            Active Streams
          </Typography>
        </Box>

        <Box sx={{ p: 3 }}>
          {activeStreams.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
              <Zap size={48} style={{ margin: '0 auto 16px', display: 'block', color: 'text.disabled' }} />
              <Typography>No active streams</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {activeStreams.map((stream: any, index: number) => (
                <Paper
                  key={stream.stream_id || index}
                  elevation={0}
                  sx={{
                    border: '1px solid', borderColor: 'divider',
                    borderRadius: '12px',
                    p: 2,
                    transition: 'box-shadow 0.2s',
                    '&:hover': { boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          backgroundColor: '#22c55e',
                          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                          '@keyframes pulse': {
                            '0%, 100%': { opacity: 1 },
                            '50%': { opacity: 0.5 },
                          },
                        }}
                      />
                      <Box>
                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'text.primary' }}>
                          {stream.stream_id || `Stream ${index + 1}`}
                        </Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {stream.type || 'completion'}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      size="small"
                      label="Active"
                      sx={{
                        backgroundColor: 'rgba(59,130,246,0.1)',
                        color: '#2563eb',
                        fontWeight: 600,
                        fontSize: '0.7rem',
                      }}
                    />
                  </Box>
                </Paper>
              ))}
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
