'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import {
  Globe, Server, Activity, Shield, GitBranch, Zap, AlertTriangle,
  CheckCircle, RefreshCw, Network, RotateCcw, Radio,
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
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import Slider from '@mui/material/Slider';

const MONO = 'var(--font-mono), "JetBrains Mono", monospace';

const sectionLabelSx = {
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.2em',
  color: '#c1c6d7',
  fontFamily: MONO,
};

function useMeshStats() {
  return useQuery({
    queryKey: ['mesh-stats'],
    queryFn: async () => {
      const res = await api.get('/api/v1/mesh/stats');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useMeshTopology() {
  return useQuery({
    queryKey: ['mesh-topology'],
    queryFn: async () => {
      const res = await api.get('/api/v1/mesh/topology');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

export default function MeshPage() {
  const { data: stats, isLoading } = useMeshStats();
  const { data: topology } = useMeshTopology();
  const queryClient = useQueryClient();

  const [actionMsg, setActionMsg] = useState('');
  const [lbAlgorithm, setLbAlgorithm] = useState('round-robin');
  const [cbEnabled, setCbEnabled] = useState(true);
  const [canaryEnabled, setCanaryEnabled] = useState(false);
  const [canaryPct, setCanaryPct] = useState(10);

  const policyMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/v1/mesh/policy/update', data),
    onSuccess: () => {
      setActionMsg('Traffic policy updated');
      queryClient.invalidateQueries({ queryKey: ['mesh-stats'] });
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress size={48} sx={{ color: '#adc6ff' }} />
        <Typography sx={{ mt: 2, color: 'text.secondary', fontSize: '0.875rem' }}>Loading service mesh...</Typography>
      </Box>
    );
  }

  const topologyData = stats?.topology || topology || {};
  const services = topologyData?.services || {};
  const policies = stats?.traffic_policies || [];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1400, mx: 'auto' }}>
      <PageHeader
        title="Service Mesh"
        subtitle="Service discovery, traffic management & observability"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={`${stats?.region || 'unknown'} / ${stats?.zone || 'unknown'}`}
              size="small"
              sx={{ fontFamily: MONO, fontSize: '0.625rem', backgroundColor: 'rgba(6,182,212,0.15)', color: '#adc6ff' }}
            />
            <RefreshCw className="w-3 h-3 animate-spin" style={{ color: '#adc6ff' }} />
          </Box>
        }
      />

      {actionMsg && (
        <Alert severity="success" onClose={() => setActionMsg('')} sx={{ mb: 2, borderRadius: '8px' }}>
          {actionMsg}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* ── MESH OVERVIEW ── */}
        <Typography sx={sectionLabelSx}>Mesh Overview</Typography>

        <Grid container spacing={2}>
          <Grid size={{ xs: 6, md: 2 }}>
            <KpiCard label="Total Requests" value={(stats?.total_requests || 0).toLocaleString()} color="#adc6ff" icon={<Activity className="w-3.5 h-3.5" />} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <KpiCard label="Successful Routes" value={(stats?.successful_routes || 0).toLocaleString()} color="#53e16f" icon={<CheckCircle className="w-3.5 h-3.5" />} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <KpiCard label="Failed Routes" value={(stats?.failed_routes || 0).toLocaleString()} color="#ef4444" icon={<AlertTriangle className="w-3.5 h-3.5" />} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <KpiCard label="Circuit Breaks" value={(stats?.circuit_breaks || 0).toLocaleString()} color="#ffb595" icon={<Shield className="w-3.5 h-3.5" />} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <KpiCard label="Retries" value={(stats?.retries || 0).toLocaleString()} color="#4b8eff" icon={<RotateCcw className="w-3.5 h-3.5" />} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <KpiCard label="Canary Requests" value={(stats?.canary_requests || 0).toLocaleString()} color="#adc6ff" icon={<GitBranch className="w-3.5 h-3.5" />} />
          </Grid>
        </Grid>

        {/* ── SERVICE TOPOLOGY ── */}
        <Typography sx={sectionLabelSx}>Service Topology</Typography>

        <Grid container spacing={2}>
          <Grid size={{ xs: 6, md: 3 }}>
            <KpiCard label="Total Services" value={topologyData.total_services || 0} color="#4b8eff" icon={<Network className="w-3.5 h-3.5" />} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <KpiCard label="Total Instances" value={topologyData.total_instances || 0} color="#adc6ff" icon={<Server className="w-3.5 h-3.5" />} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <KpiCard label="Health Passed" value={(stats?.health_checks_passed || 0).toLocaleString()} color="#53e16f" icon={<CheckCircle className="w-3.5 h-3.5" />} />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <KpiCard label="Health Failed" value={(stats?.health_checks_failed || 0).toLocaleString()} color="#ef4444" icon={<AlertTriangle className="w-3.5 h-3.5" />} />
          </Grid>
        </Grid>

        {/* ── INSTANCES TABLE ── */}
        {Object.keys(services).length > 0 && (
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
            <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Registered Instances</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Service</TableCell>
                  <TableCell>Instance ID</TableCell>
                  <TableCell>Endpoint</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Health</TableCell>
                  <TableCell>Region</TableCell>
                  <TableCell align="right">Weight</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(services).flatMap(([svcName, instances]: [string, any]) =>
                  instances.map((inst: any) => (
                    <TableRow key={inst.id} sx={{ '&:hover': { backgroundColor: 'rgba(32,31,31,0.3)' } }}>
                      <TableCell>
                        <Chip label={svcName} size="small" sx={{ fontFamily: MONO, fontSize: '0.625rem', backgroundColor: 'rgba(139,92,246,0.15)', color: '#4b8eff' }} />
                      </TableCell>
                      <TableCell sx={{ fontFamily: MONO, fontSize: '0.7rem' }}>{inst.id}</TableCell>
                      <TableCell sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{inst.endpoint}</TableCell>
                      <TableCell sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{inst.version}</TableCell>
                      <TableCell>
                        <Chip
                          label={inst.status}
                          size="small"
                          icon={inst.status === 'active' ? <Radio className="w-2.5 h-2.5" /> : undefined}
                          sx={{
                            fontFamily: MONO, fontSize: '0.625rem',
                            backgroundColor: inst.status === 'active' ? 'rgba(83,225,111,0.15)' : 'rgba(255,181,149,0.15)',
                            color: inst.status === 'active' ? '#53e16f' : '#ffb595',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <HealthBadge health={inst.health} />
                      </TableCell>
                      <TableCell sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{inst.region || '—'}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{inst.weight}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Paper>
        )}

        {/* ── TRAFFIC POLICIES ── */}
        <Typography sx={sectionLabelSx}>Traffic Policies</Typography>

        {policies.length > 0 && (
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Service</TableCell>
                  <TableCell>Load Balancing</TableCell>
                  <TableCell>Circuit Breaker</TableCell>
                  <TableCell>Max Retries</TableCell>
                  <TableCell>Timeout</TableCell>
                  <TableCell>Canary</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {policies.map((p: any) => (
                  <TableRow key={p.service} sx={{ '&:hover': { backgroundColor: 'rgba(32,31,31,0.3)' } }}>
                    <TableCell sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{p.service}</TableCell>
                    <TableCell>
                      <Chip label={p.load_balancing} size="small" sx={{ fontFamily: MONO, fontSize: '0.625rem' }} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={p.circuit_breaker ? 'ON' : 'OFF'}
                        size="small"
                        sx={{
                          fontFamily: MONO, fontSize: '0.625rem',
                          backgroundColor: p.circuit_breaker ? 'rgba(83,225,111,0.15)' : 'rgba(239,68,68,0.15)',
                          color: p.circuit_breaker ? '#53e16f' : '#ef4444',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{p.retry_attempts}</TableCell>
                    <TableCell sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{p.timeout}</TableCell>
                    <TableCell>
                      <Chip
                        label={p.canary_enabled ? 'Active' : 'Off'}
                        size="small"
                        sx={{
                          fontFamily: MONO, fontSize: '0.625rem',
                          backgroundColor: p.canary_enabled ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.05)',
                          color: p.canary_enabled ? '#adc6ff' : 'text.secondary',
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}

        {/* ── POLICY CONTROLS ── */}
        <Typography sx={sectionLabelSx}>Configure Traffic Policy</Typography>

        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, boxShadow: 'inset 3px 0 0 0 #4b8eff' }}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', mb: 0.5 }}>Load Balancing Algorithm</Typography>
              <Select
                size="small"
                value={lbAlgorithm}
                onChange={(e) => setLbAlgorithm(e.target.value)}
                fullWidth
                sx={{ fontFamily: MONO, fontSize: '0.8125rem' }}
              >
                <MenuItem value="round-robin">Round Robin</MenuItem>
                <MenuItem value="weighted">Weighted</MenuItem>
                <MenuItem value="random">Random</MenuItem>
              </Select>
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', mb: 0.5 }}>Circuit Breaker</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Switch checked={cbEnabled} onChange={(e) => setCbEnabled(e.target.checked)} size="small" />
                <Typography sx={{ fontSize: '0.8125rem', fontFamily: MONO }}>{cbEnabled ? 'Enabled' : 'Disabled'}</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 4 }}>
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', mb: 0.5 }}>Canary Routing</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Switch checked={canaryEnabled} onChange={(e) => setCanaryEnabled(e.target.checked)} size="small" />
                <Typography sx={{ fontSize: '0.8125rem', fontFamily: MONO }}>{canaryEnabled ? `${canaryPct}%` : 'Off'}</Typography>
              </Box>
            </Grid>
            {canaryEnabled && (
              <Grid size={{ xs: 12 }}>
                <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', mb: 1 }}>Canary Traffic Percentage</Typography>
                <Slider
                  value={canaryPct}
                  onChange={(_, v) => setCanaryPct(v as number)}
                  min={1}
                  max={100}
                  valueLabelDisplay="auto"
                  sx={{ color: '#adc6ff' }}
                />
              </Grid>
            )}
          </Grid>
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              size="small"
              disabled={policyMutation.isPending}
              onClick={() => policyMutation.mutate({
                service: 'velocityllm',
                algorithm: lbAlgorithm,
                circuit_breaker_enabled: cbEnabled,
                canary_enabled: canaryEnabled,
                canary_traffic_pct: canaryPct,
              })}
              startIcon={policyMutation.isPending ? <CircularProgress size={14} /> : <Zap className="w-3.5 h-3.5" />}
              sx={{ fontFamily: MONO, textTransform: 'uppercase', fontSize: '0.6875rem', letterSpacing: '0.1em' }}
            >
              Apply Policy
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

// --- Sub Components ---

function KpiCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon?: React.ReactNode }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2, borderRadius: '8px',
        boxShadow: `inset 3px 0 0 0 ${color}`,
        transition: 'background-color 0.15s',
        '&:hover': { backgroundColor: '#2a2a2a' },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {icon && <Box sx={{ color }}>{icon}</Box>}
        <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: MONO, color }}>{value}</Typography>
      </Box>
      <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.1em', mt: 0.25 }}>{label}</Typography>
    </Paper>
  );
}

function HealthBadge({ health }: { health: string }) {
  const colorMap: Record<string, string> = {
    healthy: '#53e16f',
    degraded: '#ffb595',
    unhealthy: '#ef4444',
    unknown: '#c1c6d7',
  };
  return (
    <Chip
      label={health}
      size="small"
      sx={{
        fontFamily: MONO, fontSize: '0.625rem',
        backgroundColor: `${colorMap[health] || '#c1c6d7'}20`,
        color: colorMap[health] || '#c1c6d7',
      }}
    />
  );
}
