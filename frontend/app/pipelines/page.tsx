'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import {
  GitBranch, Play, CheckCircle, XCircle, Clock, Rocket, RefreshCw,
  Activity, AlertTriangle, Package, Shield, Terminal, Layers,
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
import LinearProgress from '@mui/material/LinearProgress';

const MONO = 'var(--font-mono), "JetBrains Mono", monospace';
const sectionLabelSx = { fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.2em', color: '#c1c6d7', fontFamily: MONO };

function useCICDStats() { return useQuery({ queryKey: ['cicd-stats'], queryFn: async () => { const r = await api.get('/api/v1/cicd/stats'); return r.data?.data; }, refetchInterval: 5000 }); }
function usePipelines() { return useQuery({ queryKey: ['cicd-pipelines'], queryFn: async () => { const r = await api.get('/api/v1/cicd/pipelines'); return r.data?.data; } }); }
function usePipelineRuns(pipelineId: string) { return useQuery({ queryKey: ['cicd-runs', pipelineId], queryFn: async () => { const r = await api.get(`/api/v1/cicd/runs?pipeline_id=${pipelineId}`); return r.data?.data; }, refetchInterval: 5000 }); }
function useCICDDeploys() { return useQuery({ queryKey: ['cicd-deploys'], queryFn: async () => { const r = await api.get('/api/v1/cicd/deployments'); return r.data?.data; } }); }

function KpiCard({ icon: Icon, label, value, sub, accent = '#4b8eff' }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, backgroundColor: '#141922', border: '1px solid #2a2a2a', borderLeft: `3px solid ${accent}`, borderRadius: '8px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Icon className="w-4 h-4" />
        <Box>
          <Typography sx={{ ...sectionLabelSx, mb: 0.5 }}>{label}</Typography>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: MONO, color: '#e5e2e1' }}>{value}</Typography>
          {sub && <Typography sx={{ fontSize: '0.65rem', fontFamily: MONO, color: '#8b949e' }}>{sub}</Typography>}
        </Box>
      </Box>
    </Paper>
  );
}

const statusColors: Record<string, string> = { success: '#22c55e', failed: '#ef4444', running: '#4b8eff', pending: '#ffb595', cancelled: '#4b5563', skipped: '#4b5563' };
const statusIcons: Record<string, React.ComponentType<{ className?: string }>> = { success: CheckCircle, failed: XCircle, running: RefreshCw, pending: Clock };

function PipelineCard({ pipeline }: { pipeline: any }) {
  const queryClient = useQueryClient();
  const trigger = useMutation({
    mutationFn: async () => { await api.post('/api/v1/cicd/trigger', { pipeline_id: pipeline.id }); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cicd-runs'] }); queryClient.invalidateQueries({ queryKey: ['cicd-stats'] }); },
  });

  const triggerColors: Record<string, string> = { push: '#4b8eff', pr: '#adc6ff', schedule: '#ffb595', manual: '#22c55e' };
  const envColors: Record<string, string> = { production: '#ef4444', staging: '#ffb595' };

  return (
    <Paper elevation={0} sx={{ p: 2.5, backgroundColor: '#141922', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box>
          <Typography sx={{ fontSize: '0.9rem', fontFamily: MONO, color: '#e5e2e1', fontWeight: 700 }}>{pipeline.name}</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
            <Chip label={pipeline.branch} size="small" icon={<GitBranch className="w-3 h-3" />} sx={{ fontFamily: MONO, fontSize: '0.6rem', height: 20, backgroundColor: '#2a2a2a', color: '#c1c6d7', '& .MuiChip-icon': { color: '#c1c6d7' } }} />
            <Chip label={pipeline.trigger} size="small" sx={{ fontFamily: MONO, fontSize: '0.6rem', height: 20, backgroundColor: (triggerColors[pipeline.trigger] || '#8b949e') + '20', color: triggerColors[pipeline.trigger] || '#8b949e' }} />
            <Chip label={pipeline.environment} size="small" sx={{ fontFamily: MONO, fontSize: '0.6rem', height: 20, backgroundColor: (envColors[pipeline.environment] || '#8b949e') + '20', color: envColors[pipeline.environment] || '#8b949e' }} />
          </Box>
        </Box>
        <Button
          size="small" variant="outlined"
          onClick={() => trigger.mutate()} disabled={trigger.isPending}
          sx={{ fontFamily: MONO, fontSize: '0.65rem', textTransform: 'none', borderColor: '#2a2a2a', color: '#22c55e' }}
        >
          <Play className="w-3 h-3" style={{ marginRight: 3 }} /> Run
        </Button>
      </Box>

      {/* Pipeline stages visualization */}
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        {(pipeline.stages || []).map((s: any, i: number) => (
          <Box key={i} sx={{ flex: 1, textAlign: 'center' }}>
            <Box sx={{ height: 4, borderRadius: 2, backgroundColor: '#22c55e40', mb: 0.5 }} />
            <Typography sx={{ fontSize: '0.5rem', fontFamily: MONO, color: '#8b949e' }}>{s.name}</Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

function RunsTable({ runs }: { runs: any[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#141922', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Pipeline Runs ({runs.length})</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            {['Status', 'Pipeline', 'Branch', 'Commit', 'Author', 'Duration', 'Trigger', 'Stages'].map(h => (
              <TableCell key={h} sx={{ color: '#8b949e', fontFamily: MONO, fontSize: '0.6rem', borderColor: '#2a2a2a' }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {runs.map((run: any) => {
            const StatusIcon = statusIcons[run.status] || Clock;
            return (
              <>
                <TableRow key={run.id} sx={{ '&:hover': { backgroundColor: '#1a2332' }, cursor: 'pointer' }} onClick={() => setExpanded(expanded === run.id ? null : run.id)}>
                  <TableCell sx={{ borderColor: '#2a2a2a' }}>
                    <Chip
                      icon={<StatusIcon className="w-3 h-3" />}
                      label={run.status.toUpperCase()}
                      size="small"
                      sx={{ fontFamily: MONO, fontSize: '0.55rem', height: 22, backgroundColor: statusColors[run.status] + '20', color: statusColors[run.status], '& .MuiChip-icon': { color: 'inherit' } }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.75rem', borderColor: '#2a2a2a', fontWeight: 600 }}>{run.pipeline_name}</TableCell>
                  <TableCell sx={{ color: '#8b949e', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{run.branch}</TableCell>
                  <TableCell sx={{ borderColor: '#2a2a2a' }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.7rem', fontFamily: MONO, color: '#4b8eff' }}>{run.commit}</Typography>
                      <Typography sx={{ fontSize: '0.6rem', fontFamily: MONO, color: '#8b949e', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{run.commit_message}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: '#8b949e', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{run.author}</TableCell>
                  <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{run.duration}</TableCell>
                  <TableCell sx={{ borderColor: '#2a2a2a' }}>
                    <Chip label={run.trigger} size="small" sx={{ fontFamily: MONO, fontSize: '0.55rem', height: 18, backgroundColor: '#2a2a2a', color: '#c1c6d7' }} />
                  </TableCell>
                  <TableCell sx={{ borderColor: '#2a2a2a' }}>
                    <Box sx={{ display: 'flex', gap: 0.3 }}>
                      {(run.stages || []).map((s: any, i: number) => (
                        <Box key={i} sx={{ width: 12, height: 12, borderRadius: '2px', backgroundColor: statusColors[s.status] || '#4b5563', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={`${s.name}: ${s.status}`} />
                      ))}
                    </Box>
                  </TableCell>
                </TableRow>
                {expanded === run.id && (
                  <TableRow>
                    <TableCell colSpan={8} sx={{ borderColor: '#2a2a2a', p: 0 }}>
                      <Box sx={{ p: 2, backgroundColor: '#0e0e0e' }}>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {(run.stages || []).map((stage: any, si: number) => (
                            <Box key={si} sx={{ flex: 1, p: 1.5, backgroundColor: '#141922', borderRadius: '6px', border: '1px solid #2a2a2a' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColors[stage.status] || '#4b5563' }} />
                                <Typography sx={{ fontSize: '0.7rem', fontFamily: MONO, color: '#e5e2e1', fontWeight: 600 }}>{stage.name}</Typography>
                                <Typography sx={{ fontSize: '0.6rem', fontFamily: MONO, color: '#8b949e', ml: 'auto' }}>{stage.duration}</Typography>
                              </Box>
                              {(stage.steps || []).map((step: any, ki: number) => (
                                <Box key={ki} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.3 }}>
                                  <Box sx={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: statusColors[step.status] || '#4b5563' }} />
                                  <Typography sx={{ fontSize: '0.6rem', fontFamily: MONO, color: '#c1c6d7' }}>{step.name}</Typography>
                                  <Typography sx={{ fontSize: '0.55rem', fontFamily: MONO, color: '#4b5563', ml: 'auto' }}>{step.duration}</Typography>
                                </Box>
                              ))}
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );
}

function DeploymentsPanel({ deployments }: { deployments: any[] }) {
  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#141922', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Deployment History</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            {['Version', 'Environment', 'Status', 'Deployed By', 'Time'].map(h => (
              <TableCell key={h} sx={{ color: '#8b949e', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a' }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {(deployments || []).map((d: any) => (
            <TableRow key={d.id} sx={{ '&:hover': { backgroundColor: '#1a2332' } }}>
              <TableCell sx={{ color: '#4b8eff', fontFamily: MONO, fontSize: '0.8rem', borderColor: '#2a2a2a', fontWeight: 600 }}>{d.version}</TableCell>
              <TableCell sx={{ borderColor: '#2a2a2a' }}>
                <Chip label={d.environment} size="small" sx={{ fontFamily: MONO, fontSize: '0.6rem', height: 20, backgroundColor: d.environment === 'production' ? '#ef444420' : '#ffb59520', color: d.environment === 'production' ? '#ef4444' : '#ffb595' }} />
              </TableCell>
              <TableCell sx={{ borderColor: '#2a2a2a' }}>
                <Chip label={d.status} size="small" sx={{ fontFamily: MONO, fontSize: '0.6rem', height: 20, backgroundColor: d.status === 'deployed' ? '#22c55e20' : '#ef444420', color: d.status === 'deployed' ? '#22c55e' : '#ef4444' }} />
              </TableCell>
              <TableCell sx={{ color: '#8b949e', fontFamily: MONO, fontSize: '0.75rem', borderColor: '#2a2a2a' }}>{d.deployed_by}</TableCell>
              <TableCell sx={{ color: '#8b949e', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{new Date(d.deployed_at).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

export default function PipelinesPage() {
  const { data: stats, isLoading } = useCICDStats();
  const { data: pipesData } = usePipelines();
  const { data: runsData } = usePipelineRuns('');
  const { data: deploysData } = useCICDDeploys();

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><CircularProgress size={32} /></Box>;

  const pipelines = pipesData?.pipelines || [];
  const runs = runsData?.runs || [];
  const deployments = deploysData?.deployments || [];

  return (
    <Box>
      <PageHeader title="CI/CD Pipelines" subtitle="Build, test, scan, and deploy — automated pipeline management" />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 2 }}><KpiCard icon={GitBranch} label="Pipelines" value={stats?.total_pipelines || 0} accent="#4b8eff" /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><KpiCard icon={Activity} label="Total Runs" value={stats?.total_runs || 0} accent="#adc6ff" /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><KpiCard icon={CheckCircle} label="Success Rate" value={stats?.success_rate || '—'} accent="#22c55e" /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><KpiCard icon={Clock} label="Avg Duration" value={stats?.avg_duration || '—'} accent="#ffb595" /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><KpiCard icon={Rocket} label="Deployments" value={stats?.deployments || 0} accent="#22c55e" /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><KpiCard icon={XCircle} label="Failed" value={stats?.failed_runs || 0} accent="#ef4444" /></Grid>
      </Grid>

      {/* Pipeline Cards */}
      <Typography sx={{ ...sectionLabelSx, mb: 1.5 }}>Pipeline Definitions</Typography>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {pipelines.map((p: any) => (
          <Grid key={p.id} size={{ xs: 12, md: 6 }}>
            <PipelineCard pipeline={p} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={12}>
          <RunsTable runs={runs} />
        </Grid>
        <Grid size={12}>
          <DeploymentsPanel deployments={deployments} />
        </Grid>
      </Grid>
    </Box>
  );
}
