'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import {
  Layers, Database, HardDrive, Activity, Zap, Trash2, Flame,
  Tag, CheckCircle, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Alert from '@mui/material/Alert';

const MONO = 'var(--font-mono), "JetBrains Mono", monospace';

const sectionLabelSx = {
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.2em',
  color: '#c1c6d7',
  fontFamily: MONO,
};

function useCacheAnalytics() {
  return useQuery({
    queryKey: ['cache-analytics'],
    queryFn: async () => {
      const res = await api.get('/api/v1/cache/analytics');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useCacheStats() {
  return useQuery({
    queryKey: ['cache-stats'],
    queryFn: async () => {
      const res = await api.get('/api/v1/cache/stats');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useCacheHitRate() {
  return useQuery({
    queryKey: ['cache-hitrate'],
    queryFn: async () => {
      const res = await api.get('/api/v1/cache/hitrate');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useCacheLatency() {
  return useQuery({
    queryKey: ['cache-latency'],
    queryFn: async () => {
      const res = await api.get('/api/v1/cache/latency');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useResponseCacheStats() {
  return useQuery({
    queryKey: ['cache-response-stats'],
    queryFn: async () => {
      const res = await api.get('/api/v1/cache/response/stats');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

export default function CachingPage() {
  const { data: analytics, isLoading } = useCacheAnalytics();
  const { data: redisStats } = useCacheStats();
  const { data: hitRate } = useCacheHitRate();
  const { data: latency } = useCacheLatency();
  const { data: responseStats } = useResponseCacheStats();
  const queryClient = useQueryClient();

  const [invalidateTags, setInvalidateTags] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  const clearMutation = useMutation({
    mutationFn: () => api.post('/api/v1/cache/clear'),
    onSuccess: () => {
      setActionMsg('Cache cleared successfully');
      queryClient.invalidateQueries({ queryKey: ['cache-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['cache-hitrate'] });
    },
  });

  const invalidateMutation = useMutation({
    mutationFn: (tags: string[]) => api.post('/api/v1/cache/invalidate', { tags }),
    onSuccess: (res) => {
      setActionMsg(`Invalidated ${res.data?.data?.deleted || 0} entries`);
      queryClient.invalidateQueries({ queryKey: ['cache-analytics'] });
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress size={48} sx={{ color: '#adc6ff' }} />
        <Typography sx={{ mt: 2, color: 'text.secondary', fontSize: '0.875rem' }}>Loading cache metrics...</Typography>
      </Box>
    );
  }

  const overallHitRate = hitRate?.overall_hit_rate || 0;
  const l1HitRate = hitRate?.l1_hit_rate || 0;
  const l2HitRate = hitRate?.l2_hit_rate || 0;
  const totalReqs = (hitRate?.total_hits || 0) + (hitRate?.total_misses || 0);

  const l1Stats = analytics?.multi_level?.l1_memory;
  const analyticsData = analytics?.multi_level?.analytics;
  const semanticStats = analytics?.semantic;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1400, mx: 'auto' }}>
      <PageHeader
        title="Distributed Caching"
        subtitle="Multi-level cache performance & management"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <RefreshCw className="w-3 h-3 animate-spin" style={{ color: '#adc6ff' }} />
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Auto-refresh 5s</Typography>
          </Box>
        }
      />

      {actionMsg && (
        <Alert severity="success" onClose={() => setActionMsg('')} sx={{ mb: 2, borderRadius: '8px' }}>
          {actionMsg}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* ── OVERVIEW ── */}
        <Typography sx={sectionLabelSx}>Overview</Typography>

        <Grid container spacing={2}>
          <Grid size={{ xs: 6, md: 3 }}>
            <KpiCard label="Overall Hit Rate" value={`${(overallHitRate * 100).toFixed(1)}%`} color="#53e16f" progress={overallHitRate * 100} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <KpiCard label="L1 Hit Rate" value={`${(l1HitRate * 100).toFixed(1)}%`} color="#adc6ff" progress={l1HitRate * 100} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <KpiCard label="L2 Hit Rate" value={`${(l2HitRate * 100).toFixed(1)}%`} color="#8b5cf6" progress={l2HitRate * 100} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <KpiCard label="Total Requests" value={totalReqs.toLocaleString()} color="#ffb595" />
          </Grid>
        </Grid>

        {/* ── CACHE LAYERS ── */}
        <Typography sx={sectionLabelSx}>Cache Layers</Typography>

        <Grid container spacing={3}>
          {/* L1 Memory */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, boxShadow: 'inset 3px 0 0 0 #adc6ff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Zap className="w-4 h-4" style={{ color: '#adc6ff' }} />
                <Typography sx={sectionLabelSx}>L1 — In-Memory</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <MetricRow label="Entries" value={`${l1Stats?.size || 0} / ${l1Stats?.max_size || 0}`} />
                <MetricRow label="Hits" value={(l1Stats?.hits || 0).toLocaleString()} color="#53e16f" />
                <MetricRow label="Misses" value={(l1Stats?.misses || 0).toLocaleString()} color="#ef4444" />
                <MetricRow label="Evictions" value={(l1Stats?.evictions || 0).toLocaleString()} color="#ffb595" />
                <MetricRow label="Hit Rate" value={`${((l1Stats?.hit_rate || 0) * 100).toFixed(1)}%`} />
                <Box sx={{ pt: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={l1Stats?.max_size ? (l1Stats.size / l1Stats.max_size) * 100 : 0}
                    sx={{ height: 4, borderRadius: 2, backgroundColor: '#2a2a2a', '& .MuiLinearProgress-bar': { borderRadius: 2, backgroundColor: '#adc6ff' } }}
                  />
                  <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', mt: 0.5, fontFamily: MONO }}>
                    Memory Usage
                  </Typography>
                </Box>
              </Box>
            </Paper>
          </Grid>

          {/* L2 Redis */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, boxShadow: 'inset 3px 0 0 0 #8b5cf6' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Database className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                <Typography sx={sectionLabelSx}>L2 — Redis</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <MetricRow label="DB Size" value={`${redisStats?.db_size || 0} keys`} />
                <MetricRow label="Connected" value={redisStats?.connected ? 'Yes' : 'No'} color={redisStats?.connected ? '#53e16f' : '#ef4444'} />
                <MetricRow label="L2 Hits" value={(analyticsData?.l2_hits || 0).toLocaleString()} color="#53e16f" />
                <MetricRow label="L2 Misses" value={(analyticsData?.l2_misses || 0).toLocaleString()} color="#ef4444" />
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* ── RESPONSE CACHE ── */}
        {responseStats && (
          <>
            <Typography sx={sectionLabelSx}>HTTP Response Cache</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 4, md: 2 }}>
                <KpiCard label="Hits" value={(responseStats.hits || 0).toLocaleString()} color="#53e16f" />
              </Grid>
              <Grid size={{ xs: 4, md: 2 }}>
                <KpiCard label="Misses" value={(responseStats.misses || 0).toLocaleString()} color="#ef4444" />
              </Grid>
              <Grid size={{ xs: 4, md: 2 }}>
                <KpiCard label="Bypassed" value={(responseStats.bypassed || 0).toLocaleString()} color="#ffb595" />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <KpiCard label="Hit Rate" value={`${((responseStats.hit_rate || 0) * 100).toFixed(1)}%`} color="#adc6ff" progress={(responseStats.hit_rate || 0) * 100} />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <KpiCard label="Total" value={(responseStats.total || 0).toLocaleString()} color="#c1c6d7" />
              </Grid>
            </Grid>

            {responseStats.by_route && Object.keys(responseStats.by_route).length > 0 && (
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
                <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Per-Route Stats</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Route</TableCell>
                      <TableCell align="right">Hits</TableCell>
                      <TableCell align="right">Misses</TableCell>
                      <TableCell align="right">Hit Rate</TableCell>
                      <TableCell align="right">Avg Size</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(responseStats.by_route).map(([route, rs]: [string, any]) => (
                      <TableRow key={route} sx={{ '&:hover': { backgroundColor: 'rgba(32,31,31,0.3)' } }}>
                        <TableCell sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{route}</TableCell>
                        <TableCell align="right" sx={{ color: '#53e16f', fontFamily: MONO, fontSize: '0.75rem' }}>{rs.hits}</TableCell>
                        <TableCell align="right" sx={{ color: '#ef4444', fontFamily: MONO, fontSize: '0.75rem' }}>{rs.misses}</TableCell>
                        <TableCell align="right" sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{((rs.hit_rate || 0) * 100).toFixed(1)}%</TableCell>
                        <TableCell align="right" sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{formatBytes(rs.avg_size_bytes || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </>
        )}

        {/* ── LATENCY ── */}
        <Typography sx={sectionLabelSx}>Latency Metrics</Typography>

        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Layer</TableCell>
                <TableCell align="right">Avg (ms)</TableCell>
                <TableCell align="right">P50 (ms)</TableCell>
                <TableCell align="right">P95 (ms)</TableCell>
                <TableCell align="right">P99 (ms)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow sx={{ '&:hover': { backgroundColor: 'rgba(32,31,31,0.3)' } }}>
                <TableCell sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>L1 Memory</TableCell>
                <TableCell align="right" sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{(latency?.l1_latency?.avg_ms || 0).toFixed(2)}</TableCell>
                <TableCell align="right" sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{(latency?.l1_latency?.p50_ms || 0).toFixed(2)}</TableCell>
                <TableCell align="right" sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{(latency?.l1_latency?.p95_ms || 0).toFixed(2)}</TableCell>
                <TableCell align="right" sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{(latency?.l1_latency?.p99_ms || 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow sx={{ '&:hover': { backgroundColor: 'rgba(32,31,31,0.3)' } }}>
                <TableCell sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>L2 Redis</TableCell>
                <TableCell align="right" sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{(latency?.l2_latency?.avg_ms || 0).toFixed(2)}</TableCell>
                <TableCell align="right" sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{(latency?.l2_latency?.p50_ms || 0).toFixed(2)}</TableCell>
                <TableCell align="right" sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{(latency?.l2_latency?.p95_ms || 0).toFixed(2)}</TableCell>
                <TableCell align="right" sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{(latency?.l2_latency?.p99_ms || 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow sx={{ '&:hover': { backgroundColor: 'rgba(32,31,31,0.3)' } }}>
                <TableCell sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>Write</TableCell>
                <TableCell align="right" sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{(latency?.write_latency?.avg_ms || 0).toFixed(2)}</TableCell>
                <TableCell align="right" sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>—</TableCell>
                <TableCell align="right" sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>—</TableCell>
                <TableCell align="right" sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>—</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Paper>

        {/* ── COST SAVINGS ── */}
        {analyticsData && (
          <>
            <Typography sx={sectionLabelSx}>Savings</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6, md: 4 }}>
                <KpiCard label="Cost Saved" value={`$${(analyticsData.cost_savings_usd || 0).toFixed(4)}`} color="#53e16f" />
              </Grid>
              <Grid size={{ xs: 6, md: 4 }}>
                <KpiCard label="Bytes Served" value={formatBytes(analyticsData.bytes_served || 0)} color="#adc6ff" />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <KpiCard label="Total Hits" value={(analyticsData.total_hits || 0).toLocaleString()} color="#8b5cf6" />
              </Grid>
            </Grid>
          </>
        )}

        {/* ── HITS BY MODEL ── */}
        {analyticsData?.hits_by_model && Object.keys(analyticsData.hits_by_model).length > 0 && (
          <>
            <Typography sx={sectionLabelSx}>Cache Hits by Model</Typography>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Model</TableCell>
                    <TableCell align="right">Hits</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(analyticsData.hits_by_model).map(([model, hits]: [string, any]) => (
                    <TableRow key={model} sx={{ '&:hover': { backgroundColor: 'rgba(32,31,31,0.3)' } }}>
                      <TableCell sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{model}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: MONO, fontSize: '0.75rem', color: '#53e16f' }}>{hits}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </>
        )}

        {/* ── ACTIONS ── */}
        <Typography sx={sectionLabelSx}>Management</Typography>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, boxShadow: 'inset 3px 0 0 0 #ef4444' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Trash2 className="w-4 h-4" style={{ color: '#ef4444' }} />
                <Typography sx={sectionLabelSx}>Clear Cache</Typography>
              </Box>
              <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mb: 2 }}>
                Flush all cache entries from L1 memory and L2 Redis.
              </Typography>
              <Button
                variant="outlined"
                color="error"
                size="small"
                disabled={clearMutation.isPending}
                onClick={() => clearMutation.mutate()}
                startIcon={clearMutation.isPending ? <CircularProgress size={14} /> : <Trash2 className="w-3.5 h-3.5" />}
                sx={{ fontFamily: MONO, textTransform: 'uppercase', fontSize: '0.6875rem', letterSpacing: '0.1em' }}
              >
                Clear All
              </Button>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, boxShadow: 'inset 3px 0 0 0 #ffb595' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Tag className="w-4 h-4" style={{ color: '#ffb595' }} />
                <Typography sx={sectionLabelSx}>Invalidate by Tags</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  size="small"
                  placeholder="models, metrics, settings"
                  value={invalidateTags}
                  onChange={(e) => setInvalidateTags(e.target.value)}
                  sx={{ flex: 1, '& input': { fontFamily: MONO, fontSize: '0.8125rem' } }}
                />
                <Button
                  variant="outlined"
                  size="small"
                  disabled={!invalidateTags.trim() || invalidateMutation.isPending}
                  onClick={() => {
                    const tags = invalidateTags.split(',').map(t => t.trim()).filter(Boolean);
                    if (tags.length > 0) {
                      invalidateMutation.mutate(tags);
                      setInvalidateTags('');
                    }
                  }}
                  sx={{ fontFamily: MONO, textTransform: 'uppercase', fontSize: '0.6875rem', letterSpacing: '0.1em' }}
                >
                  Invalidate
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

// --- Sub Components ---

function KpiCard({ label, value, color, progress }: { label: string; value: string | number; color: string; progress?: number }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: '8px',
        boxShadow: `inset 3px 0 0 0 ${color}`,
        transition: 'background-color 0.15s',
        '&:hover': { backgroundColor: '#2a2a2a' },
      }}
    >
      <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: MONO, color }}>{value}</Typography>
      <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.1em', mt: 0.25 }}>{label}</Typography>
      {progress !== undefined && (
        <LinearProgress
          variant="determinate"
          value={Math.min(progress, 100)}
          sx={{ mt: 1, height: 4, borderRadius: 2, backgroundColor: '#2a2a2a', '& .MuiLinearProgress-bar': { borderRadius: 2, backgroundColor: color } }}
        />
      )}
    </Paper>
  );
}

function MetricRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.8125rem', fontFamily: MONO, color: color || 'text.primary' }}>{value}</Typography>
    </Box>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
