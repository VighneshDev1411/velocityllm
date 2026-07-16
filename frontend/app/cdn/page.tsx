'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import {
  Globe, Server, Zap, Shield, RefreshCw, Trash2, CheckCircle,
  XCircle, Activity, HardDrive, ArrowUpDown, Clock, Lock, Layers,
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

function useCDNStats() {
  return useQuery({
    queryKey: ['cdn-stats'],
    queryFn: async () => {
      const res = await api.get('/api/v1/cdn/stats');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useCDNEdges() {
  return useQuery({
    queryKey: ['cdn-edges'],
    queryFn: async () => {
      const res = await api.get('/api/v1/cdn/edges');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useCDNOrigins() {
  return useQuery({
    queryKey: ['cdn-origins'],
    queryFn: async () => {
      const res = await api.get('/api/v1/cdn/origins');
      return res.data?.data;
    },
    refetchInterval: 10000,
  });
}

function useCDNRules() {
  return useQuery({
    queryKey: ['cdn-rules'],
    queryFn: async () => {
      const res = await api.get('/api/v1/cdn/rules');
      return res.data?.data;
    },
  });
}

function useCDNInvalidations() {
  return useQuery({
    queryKey: ['cdn-invalidations'],
    queryFn: async () => {
      const res = await api.get('/api/v1/cdn/invalidations');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

/* ── KPI Card ─────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, sub, accent = '#4b8eff' }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        backgroundColor: '#201f1f',
        border: '1px solid #2a2a2a',
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
          {sub && <Typography sx={{ fontSize: '0.65rem', fontFamily: MONO, color: '#c1c6d7' }}>{sub}</Typography>}
        </Box>
      </Box>
    </Paper>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/* ── Edge Locations Map ───────────────────────────────── */
function EdgeLocationsPanel({ edges }: { edges: Record<string, any> }) {
  const edgeList = Object.values(edges || {});

  const positions: Record<string, { top: string; left: string; label: string }> = {
    'us-east-1':       { top: '35%', left: '22%', label: 'US East' },
    'us-west-2':       { top: '35%', left: '10%', label: 'US West' },
    'eu-west-1':       { top: '28%', left: '44%', label: 'EU West' },
    'eu-central-1':    { top: '28%', left: '52%', label: 'EU Central' },
    'ap-southeast-1':  { top: '55%', left: '78%', label: 'AP SE' },
    'ap-northeast-1':  { top: '32%', left: '85%', label: 'AP NE' },
    'sa-east-1':       { top: '68%', left: '28%', label: 'SA East' },
    'af-south-1':      { top: '62%', left: '54%', label: 'AF South' },
  };

  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Edge Locations ({edgeList.length})</Typography>
      <Box sx={{ position: 'relative', height: 280, backgroundColor: '#0e0e0e', borderRadius: '8px', border: '1px solid #2a2a2a', overflow: 'hidden' }}>
        {/* Grid */}
        {[20, 40, 60, 80].map(p => (
          <Box key={`h-${p}`} sx={{ position: 'absolute', top: `${p}%`, left: 0, right: 0, height: '1px', backgroundColor: '#2a2a2a' }} />
        ))}
        {[20, 40, 60, 80].map(p => (
          <Box key={`v-${p}`} sx={{ position: 'absolute', left: `${p}%`, top: 0, bottom: 0, width: '1px', backgroundColor: '#2a2a2a' }} />
        ))}

        {edgeList.map((edge: any) => {
          const pos = positions[edge.location] || { top: '50%', left: '50%', label: edge.location };
          const color = edge.status === 'active' ? '#53e16f' : edge.status === 'draining' ? '#ffb595' : '#ef4444';

          return (
            <Box
              key={edge.location}
              sx={{ position: 'absolute', top: pos.top, left: pos.left, transform: 'translate(-50%, -50%)', textAlign: 'center' }}
            >
              <Box sx={{
                width: 32, height: 32, borderRadius: '50%',
                backgroundColor: `${color}15`, border: `2px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto',
                animation: edge.status === 'active' ? 'pulse 3s infinite' : 'none',
                '@keyframes pulse': {
                  '0%': { boxShadow: `0 0 0 0 ${color}30` },
                  '70%': { boxShadow: `0 0 0 8px ${color}00` },
                  '100%': { boxShadow: `0 0 0 0 ${color}00` },
                },
              }}>
                <Globe className="w-3 h-3" style={{ color }} />
              </Box>
              <Typography sx={{ fontSize: '0.55rem', fontFamily: MONO, color: '#c1c6d7', mt: 0.3, whiteSpace: 'nowrap' }}>
                {pos.label}
              </Typography>
              <Typography sx={{ fontSize: '0.5rem', fontFamily: MONO, color }}>
                {edge.latency_ms?.toFixed(0)}ms
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

/* ── Edge Details Table ───────────────────────────────── */
function EdgeDetailsTable({ edges }: { edges: Record<string, any> }) {
  const queryClient = useQueryClient();
  const edgeList = Object.values(edges || {});

  const toggleEdge = useMutation({
    mutationFn: async ({ location, status }: { location: string; status: string }) => {
      await api.post('/api/v1/cdn/edges/status', { location, status });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cdn-edges'] }),
  });

  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Edge Node Details</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            {['Location', 'Status', 'Hit Rate', 'Cache Size', 'Items', 'Bandwidth', 'Connections', 'Latency', 'Actions'].map(h => (
              <TableCell key={h} sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a' }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {edgeList.map((edge: any) => (
            <TableRow key={edge.location} sx={{ '&:hover': { backgroundColor: '#201f1f' } }}>
              <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.8rem', borderColor: '#2a2a2a' }}>
                {edge.location}
              </TableCell>
              <TableCell sx={{ borderColor: '#2a2a2a' }}>
                <Chip
                  size="small"
                  label={edge.status.toUpperCase()}
                  sx={{
                    height: 20, fontSize: '0.6rem', fontFamily: MONO,
                    backgroundColor: edge.status === 'active' ? '#53e16f20' : edge.status === 'draining' ? '#ffb59520' : '#ef444420',
                    color: edge.status === 'active' ? '#53e16f' : edge.status === 'draining' ? '#ffb595' : '#ef4444',
                  }}
                />
              </TableCell>
              <TableCell sx={{ borderColor: '#2a2a2a' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={edge.hit_rate}
                    sx={{
                      width: 50, height: 4, borderRadius: 2, backgroundColor: '#2a2a2a',
                      '& .MuiLinearProgress-bar': { backgroundColor: edge.hit_rate > 90 ? '#53e16f' : edge.hit_rate > 80 ? '#ffb595' : '#ef4444' },
                    }}
                  />
                  <Typography sx={{ fontSize: '0.7rem', fontFamily: MONO, color: '#e5e2e1' }}>{edge.hit_rate?.toFixed(1)}%</Typography>
                </Box>
              </TableCell>
              <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.75rem', borderColor: '#2a2a2a' }}>
                {formatBytes(edge.cache_size_bytes)}
              </TableCell>
              <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.75rem', borderColor: '#2a2a2a' }}>
                {edge.cache_items?.toLocaleString()}
              </TableCell>
              <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.75rem', borderColor: '#2a2a2a' }}>
                {formatBytes(edge.bandwidth_bps)}/s
              </TableCell>
              <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.75rem', borderColor: '#2a2a2a' }}>
                {edge.connections}
              </TableCell>
              <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.75rem', borderColor: '#2a2a2a' }}>
                {edge.latency_ms?.toFixed(1)}ms
              </TableCell>
              <TableCell sx={{ borderColor: '#2a2a2a' }}>
                <Button
                  size="small"
                  onClick={() => toggleEdge.mutate({
                    location: edge.location,
                    status: edge.status === 'active' ? 'draining' : 'active',
                  })}
                  sx={{ fontFamily: MONO, fontSize: '0.6rem', textTransform: 'none', color: edge.status === 'active' ? '#ffb595' : '#53e16f', minWidth: 0 }}
                >
                  {edge.status === 'active' ? 'Drain' : 'Activate'}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

/* ── Origin Servers ───────────────────────────────────── */
function OriginServers({ origins }: { origins: any[] }) {
  const queryClient = useQueryClient();

  const toggleHealth = useMutation({
    mutationFn: async ({ origin_id, healthy }: { origin_id: string; healthy: boolean }) => {
      await api.post('/api/v1/cdn/origins/health', { origin_id, healthy });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cdn-origins'] }),
  });

  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Origin Servers</Typography>
      {(origins || []).map((origin: any) => (
        <Box key={origin.id} sx={{ p: 2, mb: 1, backgroundColor: '#0e0e0e', borderRadius: '6px', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Server className="w-4 h-4" style={{ color: origin.is_healthy ? '#53e16f' : '#ef4444' }} />
            <Box>
              <Typography sx={{ fontSize: '0.85rem', fontFamily: MONO, color: '#e5e2e1', fontWeight: 600 }}>
                {origin.id}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', fontFamily: MONO, color: '#c1c6d7' }}>
                {origin.protocol}://{origin.host}:{origin.port}
              </Typography>
            </Box>
            <Chip label={`P${origin.priority}`} size="small" sx={{ fontFamily: MONO, fontSize: '0.6rem', backgroundColor: '#2a2a2a', color: '#c1c6d7', height: 20 }} />
            <Chip label={`W:${origin.weight}`} size="small" sx={{ fontFamily: MONO, fontSize: '0.6rem', backgroundColor: '#2a2a2a', color: '#c1c6d7', height: 20 }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              icon={origin.is_healthy ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              label={origin.is_healthy ? 'HEALTHY' : 'UNHEALTHY'}
              size="small"
              sx={{
                fontFamily: MONO, fontSize: '0.6rem', height: 22,
                backgroundColor: origin.is_healthy ? '#53e16f20' : '#ef444420',
                color: origin.is_healthy ? '#53e16f' : '#ef4444',
                '& .MuiChip-icon': { color: 'inherit' },
              }}
            />
            <Button
              size="small"
              onClick={() => toggleHealth.mutate({ origin_id: origin.id, healthy: !origin.is_healthy })}
              sx={{ fontFamily: MONO, fontSize: '0.6rem', textTransform: 'none', color: origin.is_healthy ? '#ef4444' : '#53e16f', minWidth: 0 }}
            >
              {origin.is_healthy ? 'Mark Down' : 'Mark Up'}
            </Button>
          </Box>
        </Box>
      ))}
    </Paper>
  );
}

/* ── Cache Rules ──────────────────────────────────────── */
function CacheRulesPanel({ rules }: { rules: any[] }) {
  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Cache Rules ({(rules || []).length})</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            {['Path Pattern', 'TTL', 'Cache-Control', 'Compress', 'Bypass'].map(h => (
              <TableCell key={h} sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a' }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {(rules || []).map((rule: any, i: number) => {
            const ttlSec = rule.ttl / 1000000000; // nanoseconds to seconds
            const ttlStr = ttlSec === 0 ? 'NO CACHE' : ttlSec >= 86400 ? `${Math.round(ttlSec / 86400)}d` : ttlSec >= 3600 ? `${Math.round(ttlSec / 3600)}h` : `${Math.round(ttlSec / 60)}m`;
            return (
              <TableRow key={i} sx={{ '&:hover': { backgroundColor: '#201f1f' } }}>
                <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.8rem', borderColor: '#2a2a2a' }}>
                  <code style={{ color: '#4b8eff' }}>{rule.path_pattern}</code>
                </TableCell>
                <TableCell sx={{ borderColor: '#2a2a2a' }}>
                  <Chip
                    label={ttlStr}
                    size="small"
                    sx={{
                      fontFamily: MONO, fontSize: '0.6rem', height: 20,
                      backgroundColor: ttlSec === 0 ? '#ef444420' : '#53e16f20',
                      color: ttlSec === 0 ? '#ef4444' : '#53e16f',
                    }}
                  />
                </TableCell>
                <TableCell sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>
                  {rule.cache_control || '—'}
                </TableCell>
                <TableCell sx={{ borderColor: '#2a2a2a' }}>
                  {rule.compress ? <CheckCircle className="w-3 h-3" style={{ color: '#53e16f' }} /> : <XCircle className="w-3 h-3" style={{ color: '#414755' }} />}
                </TableCell>
                <TableCell sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>
                  {rule.bypass_cookie || '—'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );
}

/* ── Invalidation Panel ───────────────────────────────── */
function InvalidationPanel({ invalidations }: { invalidations: any[] }) {
  const queryClient = useQueryClient();
  const [paths, setPaths] = useState('/api/v1/models');

  const invalidate = useMutation({
    mutationFn: async (payload: { paths?: string[]; all?: boolean }) => {
      await api.post('/api/v1/cdn/invalidate', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cdn-invalidations'] });
      queryClient.invalidateQueries({ queryKey: ['cdn-stats'] });
    },
  });

  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Cache Invalidation</Typography>

      <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="/api/v1/models, /static/*"
          value={paths}
          onChange={(e) => setPaths(e.target.value)}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#0e0e0e', color: '#e5e2e1', fontFamily: MONO, fontSize: '0.8rem',
              '& fieldset': { borderColor: '#2a2a2a' },
            },
          }}
        />
        <Button
          size="small"
          variant="outlined"
          onClick={() => invalidate.mutate({ paths: paths.split(',').map(p => p.trim()) })}
          disabled={invalidate.isPending}
          sx={{ fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a', color: '#ffb595', textTransform: 'none', whiteSpace: 'nowrap' }}
        >
          <RefreshCw className="w-3 h-3" style={{ marginRight: 4 }} />
          Invalidate
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => invalidate.mutate({ all: true })}
          disabled={invalidate.isPending}
          sx={{ fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a', color: '#ef4444', textTransform: 'none', whiteSpace: 'nowrap' }}
        >
          <Trash2 className="w-3 h-3" style={{ marginRight: 4 }} />
          Purge All
        </Button>
      </Box>

      {/* Recent invalidations */}
      {(invalidations || []).length > 0 && (
        <>
          <Typography sx={{ fontSize: '0.6rem', fontFamily: MONO, color: '#c1c6d7', mb: 1 }}>RECENT INVALIDATIONS</Typography>
          {(invalidations || []).slice(-5).reverse().map((inv: any) => (
            <Box key={inv.id} sx={{ p: 1.5, mb: 0.5, backgroundColor: '#0e0e0e', borderRadius: '4px', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={inv.status.toUpperCase()}
                  size="small"
                  sx={{
                    height: 18, fontSize: '0.55rem', fontFamily: MONO,
                    backgroundColor: inv.status === 'completed' ? '#53e16f20' : '#ffb59520',
                    color: inv.status === 'completed' ? '#53e16f' : '#ffb595',
                  }}
                />
                <Typography sx={{ fontSize: '0.7rem', fontFamily: MONO, color: '#e5e2e1' }}>
                  {inv.paths?.join(', ')}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '0.6rem', fontFamily: MONO, color: '#c1c6d7' }}>
                {inv.edge_nodes} edges
              </Typography>
            </Box>
          ))}
        </>
      )}
    </Paper>
  );
}

/* ── CDN Feature Badges ───────────────────────────────── */
function CDNFeatures({ stats }: { stats: any }) {
  const features = [
    { label: 'Gzip', enabled: stats?.compression_gzip, icon: Layers },
    { label: 'Brotli', enabled: stats?.compression_brotli, icon: Layers },
    { label: 'WAF', enabled: stats?.waf_enabled, icon: Shield },
    { label: 'HTTP/2 Push', enabled: stats?.http2_push, icon: Zap },
  ];

  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Features</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {features.map(f => {
          const Icon = f.icon;
          return (
            <Chip
              key={f.label}
              icon={<Icon className="w-3 h-3" />}
              label={f.label}
              size="small"
              sx={{
                fontFamily: MONO, fontSize: '0.65rem', height: 28,
                backgroundColor: f.enabled ? '#53e16f15' : '#2a2a2a',
                color: f.enabled ? '#53e16f' : '#414755',
                border: `1px solid ${f.enabled ? '#53e16f30' : '#2a2a2a'}`,
                '& .MuiChip-icon': { color: 'inherit' },
              }}
            />
          );
        })}
      </Box>
      <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Typography sx={{ fontSize: '0.65rem', fontFamily: MONO, color: '#c1c6d7' }}>
          Provider: <span style={{ color: '#4b8eff' }}>{stats?.provider}</span>
        </Typography>
        <Typography sx={{ fontSize: '0.65rem', fontFamily: MONO, color: '#c1c6d7' }}>
          Default TTL: <span style={{ color: '#e5e2e1' }}>{stats?.default_ttl}</span>
        </Typography>
        <Typography sx={{ fontSize: '0.65rem', fontFamily: MONO, color: '#c1c6d7' }}>
          Max TTL: <span style={{ color: '#e5e2e1' }}>{stats?.max_ttl}</span>
        </Typography>
      </Box>
    </Paper>
  );
}

/* ── Main Page ────────────────────────────────────────── */
export default function CDNPage() {
  const { data: stats, isLoading: statsLoading } = useCDNStats();
  const { data: edgeData } = useCDNEdges();
  const { data: originData } = useCDNOrigins();
  const { data: rulesData } = useCDNRules();
  const { data: invData } = useCDNInvalidations();

  if (statsLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>      <PageHeader
        title="CDN"
        subtitle="Content delivery network — edge caching, origin failover, and cache invalidation"
      />

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard icon={Zap} label="Hit Rate" value={stats?.hit_rate || '—'} accent="#53e16f" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard icon={Activity} label="Total Requests" value={(stats?.total_requests || 0).toLocaleString()} accent="#4b8eff" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard icon={ArrowUpDown} label="Bandwidth Saved" value={stats?.bandwidth_savings || '—'} sub={formatBytes(stats?.bytes_saved || 0)} accent="#adc6ff" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <KpiCard icon={Shield} label="WAF Blocked" value={(stats?.waf_blocked || 0).toLocaleString()} accent="#ef4444" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {/* Edge Map */}
        <Grid size={{ xs: 12, md: 7 }}>
          <EdgeLocationsPanel edges={edgeData?.edges || {}} />
        </Grid>

        {/* Features + Origin */}
        <Grid size={{ xs: 12, md: 5 }}>
          <CDNFeatures stats={stats} />
          <Box sx={{ mt: 2 }}>
            <OriginServers origins={originData?.origins || []} />
          </Box>
        </Grid>

        {/* Edge Details Table */}
        <Grid size={12}>
          <EdgeDetailsTable edges={edgeData?.edges || {}} />
        </Grid>

        {/* Cache Rules */}
        <Grid size={{ xs: 12, md: 6 }}>
          <CacheRulesPanel rules={rulesData?.rules || []} />
        </Grid>

        {/* Invalidation */}
        <Grid size={{ xs: 12, md: 6 }}>
          <InvalidationPanel invalidations={invData?.invalidations || []} />
        </Grid>
      </Grid>
    </Box>
  );
}
