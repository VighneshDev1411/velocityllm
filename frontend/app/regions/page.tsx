'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import {
  Globe, MapPin, Activity, Zap, AlertTriangle, CheckCircle,
  RefreshCw, Navigation, Signal, Clock, TrendingUp, Server,
} from 'lucide-react';
import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import TextField from '@mui/material/TextField';

const MONO = 'var(--font-mono), "JetBrains Mono", monospace';

const sectionLabelSx = {
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.2em',
  color: '#c1c6d7',
  fontFamily: MONO,
};

function useRegionStatuses() {
  return useQuery({
    queryKey: ['geo-regions'],
    queryFn: async () => {
      const res = await api.get('/api/v1/geo/regions');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useGeoStats() {
  return useQuery({
    queryKey: ['geo-stats'],
    queryFn: async () => {
      const res = await api.get('/api/v1/geo/stats');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useGeoConfig() {
  return useQuery({
    queryKey: ['geo-config'],
    queryFn: async () => {
      const res = await api.get('/api/v1/geo/config');
      return res.data?.data;
    },
  });
}

/* ── KPI Card ─────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, accent = '#4b8eff' }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        backgroundColor: '#141922',
        border: '1px solid #1e2736',
        borderLeft: `3px solid ${accent}`,
        borderRadius: '8px',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Icon className="w-4 h-4" />
        <Box>
          <Typography sx={{ ...sectionLabelSx, mb: 0.5 }}>{label}</Typography>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: MONO, color: '#e5e2e1' }}>
            {value}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
}

/* ── Region Health Map ────────────────────────────────── */
function RegionHealthMap({ regions }: { regions: any[] }) {
  const regionPositions: Record<string, { top: string; left: string; label: string }> = {
    'us-east-1':       { top: '35%', left: '25%', label: 'US East' },
    'us-west-2':       { top: '35%', left: '12%', label: 'US West' },
    'eu-west-1':       { top: '28%', left: '47%', label: 'EU West' },
    'ap-southeast-1':  { top: '55%', left: '78%', label: 'AP Southeast' },
    'ap-northeast-1':  { top: '35%', left: '82%', label: 'AP Northeast' },
    'sa-east-1':       { top: '70%', left: '30%', label: 'SA East' },
  };

  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#141922', border: '1px solid #1e2736', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Region Health Map</Typography>
      <Box sx={{ position: 'relative', height: 300, backgroundColor: '#0d1117', borderRadius: '8px', border: '1px solid #1e2736', overflow: 'hidden' }}>
        {/* Grid lines */}
        {[20, 40, 60, 80].map(p => (
          <Box key={`h-${p}`} sx={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, height: '1px', backgroundColor: '#1e2736' }} />
        ))}
        {[20, 40, 60, 80].map(p => (
          <Box key={`v-${p}`} sx={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: '1px', backgroundColor: '#1e2736' }} />
        ))}

        {/* Region nodes */}
        {regions.map((region) => {
          const pos = regionPositions[region.region] || { top: '50%', left: '50%', label: region.region };
          const isHealthy = region.healthy > 0 && region.unhealthy === 0;
          const isDegraded = region.degraded > 0;
          const color = isHealthy ? '#22c55e' : isDegraded ? '#f59e0b' : region.instances > 0 ? '#ef4444' : '#4b5563';

          return (
            <Box
              key={region.region}
              sx={{
                position: 'absolute',
                top: pos.top,
                left: pos.left,
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                cursor: 'default',
              }}
            >
              {/* Pulse ring */}
              <Box sx={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                backgroundColor: `${color}20`,
                border: `2px solid ${color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                animation: isHealthy ? 'pulse 2s infinite' : 'none',
                '@keyframes pulse': {
                  '0%': { boxShadow: `0 0 0 0 ${color}40` },
                  '70%': { boxShadow: `0 0 0 10px ${color}00` },
                  '100%': { boxShadow: `0 0 0 0 ${color}00` },
                },
              }}>
                <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color, fontFamily: MONO }}>
                  {region.instances}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.6rem', fontFamily: MONO, color: '#8b949e', mt: 0.5, whiteSpace: 'nowrap' }}>
                {pos.label}
              </Typography>
              {region.is_failover && (
                <Chip label="FAILOVER" size="small" sx={{ mt: 0.3, height: 14, fontSize: '0.5rem', backgroundColor: '#1e2736', color: '#8b949e' }} />
              )}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

/* ── Region Details Table ─────────────────────────────── */
function RegionDetailsTable({ regions }: { regions: any[] }) {
  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#141922', border: '1px solid #1e2736', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Region Details</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            {['Region', 'Status', 'Instances', 'Health', 'Avg Latency', 'P99 Latency', 'Requests', 'Error Rate'].map(h => (
              <TableCell key={h} sx={{ color: '#8b949e', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#1e2736' }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {regions.map((r) => {
            const healthPct = r.instances > 0 ? Math.round((r.healthy / r.instances) * 100) : 0;
            return (
              <TableRow key={r.region} sx={{ '&:hover': { backgroundColor: '#1a2332' } }}>
                <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.8rem', borderColor: '#1e2736' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MapPin className="w-3 h-3" />
                    {r.region}
                    {!r.is_failover && <Chip label="PRIMARY" size="small" sx={{ height: 16, fontSize: '0.55rem', backgroundColor: '#22c55e20', color: '#22c55e' }} />}
                  </Box>
                </TableCell>
                <TableCell sx={{ borderColor: '#1e2736' }}>
                  <Chip
                    size="small"
                    label={r.unhealthy > 0 ? 'DEGRADED' : r.instances > 0 ? 'HEALTHY' : 'EMPTY'}
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      fontFamily: MONO,
                      backgroundColor: r.unhealthy > 0 ? '#f59e0b20' : r.instances > 0 ? '#22c55e20' : '#4b556320',
                      color: r.unhealthy > 0 ? '#f59e0b' : r.instances > 0 ? '#22c55e' : '#4b5563',
                    }}
                  />
                </TableCell>
                <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.8rem', borderColor: '#1e2736' }}>
                  {r.instances}
                </TableCell>
                <TableCell sx={{ borderColor: '#1e2736' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress
                      variant="determinate"
                      value={healthPct}
                      sx={{
                        width: 60,
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: '#1e2736',
                        '& .MuiLinearProgress-bar': { backgroundColor: healthPct > 80 ? '#22c55e' : healthPct > 50 ? '#f59e0b' : '#ef4444' },
                      }}
                    />
                    <Typography sx={{ fontSize: '0.7rem', fontFamily: MONO, color: '#8b949e' }}>{healthPct}%</Typography>
                  </Box>
                </TableCell>
                <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.8rem', borderColor: '#1e2736' }}>
                  {r.avg_latency_ms > 0 ? `${r.avg_latency_ms.toFixed(1)}ms` : '—'}
                </TableCell>
                <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.8rem', borderColor: '#1e2736' }}>
                  {r.p99_latency_ms > 0 ? `${r.p99_latency_ms.toFixed(1)}ms` : '—'}
                </TableCell>
                <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.8rem', borderColor: '#1e2736' }}>
                  {r.request_count.toLocaleString()}
                </TableCell>
                <TableCell sx={{ borderColor: '#1e2736' }}>
                  <Typography sx={{
                    fontSize: '0.8rem',
                    fontFamily: MONO,
                    color: r.error_rate > 5 ? '#ef4444' : r.error_rate > 1 ? '#f59e0b' : '#22c55e',
                  }}>
                    {r.error_rate.toFixed(2)}%
                  </Typography>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );
}

/* ── Latency Simulator ────────────────────────────────── */
function LatencySimulator() {
  const queryClient = useQueryClient();
  const [region, setRegion] = useState('us-east-1');
  const [latency, setLatency] = useState('45');

  const recordLatency = useMutation({
    mutationFn: async () => {
      await api.post('/api/v1/geo/latency', { region, latency_ms: parseFloat(latency) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geo-regions'] });
      queryClient.invalidateQueries({ queryKey: ['geo-stats'] });
    },
  });

  const recordError = useMutation({
    mutationFn: async () => {
      await api.post('/api/v1/geo/error', { region });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geo-regions'] });
    },
  });

  const testGeoRoute = useMutation({
    mutationFn: async () => {
      const res = await api.get('/api/v1/geo/route?service=velocityllm');
      return res.data?.data;
    },
  });

  const regions = ['us-east-1', 'us-west-2', 'eu-west-1', 'ap-southeast-1'];

  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#141922', border: '1px solid #1e2736', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Simulation Controls</Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Typography sx={{ fontSize: '0.7rem', color: '#8b949e', fontFamily: MONO, mb: 0.5 }}>Region</Typography>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#0d1117',
              border: '1px solid #1e2736',
              borderRadius: '6px',
              color: '#e5e2e1',
              fontFamily: MONO,
              fontSize: '0.8rem',
            }}
          >
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Typography sx={{ fontSize: '0.7rem', color: '#8b949e', fontFamily: MONO, mb: 0.5 }}>Latency (ms)</Typography>
          <TextField
            size="small"
            fullWidth
            value={latency}
            onChange={(e) => setLatency(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: '#0d1117',
                color: '#e5e2e1',
                fontFamily: MONO,
                fontSize: '0.8rem',
                '& fieldset': { borderColor: '#1e2736' },
              },
            }}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }} sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => recordLatency.mutate()}
            disabled={recordLatency.isPending}
            sx={{ fontFamily: MONO, fontSize: '0.7rem', borderColor: '#1e2736', color: '#4b8eff', textTransform: 'none' }}
          >
            <Clock className="w-3 h-3" style={{ marginRight: 4 }} />
            Record
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => recordError.mutate()}
            disabled={recordError.isPending}
            sx={{ fontFamily: MONO, fontSize: '0.7rem', borderColor: '#1e2736', color: '#ef4444', textTransform: 'none' }}
          >
            <AlertTriangle className="w-3 h-3" style={{ marginRight: 4 }} />
            Error
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => testGeoRoute.mutate()}
            disabled={testGeoRoute.isPending}
            sx={{ fontFamily: MONO, fontSize: '0.7rem', borderColor: '#1e2736', color: '#22c55e', textTransform: 'none' }}
          >
            <Navigation className="w-3 h-3" style={{ marginRight: 4 }} />
            Route
          </Button>
        </Grid>
      </Grid>

      {/* Route result */}
      {testGeoRoute.data && (
        <Alert severity="info" sx={{ mt: 2, backgroundColor: '#0d1117', border: '1px solid #1e2736', '& .MuiAlert-message': { fontFamily: MONO, fontSize: '0.75rem', color: '#e5e2e1' } }}>
          Routed to <strong>{testGeoRoute.data.instance}</strong> in {testGeoRoute.data.region} ({testGeoRoute.data.route_type}) — {testGeoRoute.data.endpoint}
        </Alert>
      )}
    </Paper>
  );
}

/* ── Geo Routing Stats ────────────────────────────────── */
function GeoRoutingStats({ stats }: { stats: any }) {
  if (!stats) return null;

  const items = [
    { label: 'Local Region', value: stats.local_region, color: '#22c55e' },
    { label: 'Local Zone', value: stats.local_zone, color: '#4b8eff' },
    { label: 'Local Routes', value: stats.local_routes, color: '#22c55e' },
    { label: 'Cross-Region Routes', value: stats.cross_region_routes, color: '#f59e0b' },
    { label: 'Failover Routes', value: stats.failover_routes, color: '#ef4444' },
    { label: 'Zone Preferred', value: stats.zone_preferred, color: '#a78bfa' },
  ];

  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#141922', border: '1px solid #1e2736', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Routing Statistics</Typography>
      <Grid container spacing={1.5}>
        {items.map((item) => (
          <Grid size={{ xs: 6, sm: 4 }} key={item.label}>
            <Box sx={{ p: 1.5, backgroundColor: '#0d1117', borderRadius: '6px', border: '1px solid #1e2736' }}>
              <Typography sx={{ fontSize: '0.6rem', fontFamily: MONO, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {item.label}
              </Typography>
              <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: MONO, color: item.color }}>
                {item.value}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* Failover regions */}
      {stats.failover_regions && (
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontSize: '0.6rem', fontFamily: MONO, color: '#8b949e', mb: 1 }}>FAILOVER ORDER</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {stats.failover_regions.map((r: string, i: number) => (
              <Chip
                key={r}
                label={`${i + 1}. ${r}`}
                size="small"
                sx={{ fontFamily: MONO, fontSize: '0.7rem', backgroundColor: '#1e2736', color: '#c1c6d7' }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Config details */}
      <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: '0.65rem', fontFamily: MONO, color: '#8b949e' }}>
          Latency Threshold: <span style={{ color: '#e5e2e1' }}>{stats.latency_threshold}</span>
        </Typography>
        <Typography sx={{ fontSize: '0.65rem', fontFamily: MONO, color: '#8b949e' }}>
          Healthy Threshold: <span style={{ color: '#e5e2e1' }}>{stats.healthy_threshold}</span>
        </Typography>
        <Typography sx={{ fontSize: '0.65rem', fontFamily: MONO, color: '#8b949e' }}>
          Zone Preference: <span style={{ color: stats.prefer_local_zone ? '#22c55e' : '#8b949e' }}>{stats.prefer_local_zone ? 'ON' : 'OFF'}</span>
        </Typography>
      </Box>
    </Paper>
  );
}

/* ── Main Page ────────────────────────────────────────── */
export default function RegionsPage() {
  const { data: regionData, isLoading: regLoading } = useRegionStatuses();
  const { data: geoStats, isLoading: geoLoading } = useGeoStats();

  const regions = regionData?.regions || [];
  const totalInstances = regions.reduce((s: number, r: any) => s + r.instances, 0);
  const totalHealthy = regions.reduce((s: number, r: any) => s + r.healthy, 0);
  const totalRequests = regions.reduce((s: number, r: any) => s + (r.request_count || 0), 0);

  if (regLoading && geoLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Multi-Region"
        subtitle="Geo-aware routing, region health monitoring, and cross-region failover"
      />

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard icon={Globe} label="Regions" value={regions.length} accent="#4b8eff" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard icon={Server} label="Total Instances" value={totalInstances} accent="#a78bfa" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard icon={CheckCircle} label="Healthy" value={totalHealthy} accent="#22c55e" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard icon={TrendingUp} label="Total Requests" value={totalRequests.toLocaleString()} accent="#f59e0b" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {/* Region Health Map */}
        <Grid size={{ xs: 12, md: 7 }}>
          <RegionHealthMap regions={regions} />
        </Grid>

        {/* Geo Routing Stats */}
        <Grid size={{ xs: 12, md: 5 }}>
          <GeoRoutingStats stats={geoStats} />
        </Grid>

        {/* Region Details Table */}
        <Grid size={12}>
          <RegionDetailsTable regions={regions} />
        </Grid>

        {/* Simulation Controls */}
        <Grid size={12}>
          <LatencySimulator />
        </Grid>
      </Grid>
    </Box>
  );
}
