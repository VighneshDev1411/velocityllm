'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import {
  Box as BoxIcon, Server, Cpu, HardDrive, Activity, RefreshCw,
  CheckCircle, XCircle, ArrowUpDown, AlertTriangle, Network, Layers,
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
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

const MONO = 'var(--font-mono), "JetBrains Mono", monospace';
const sectionLabelSx = { fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.2em', color: '#c1c6d7', fontFamily: MONO };

function useK8sStats() { return useQuery({ queryKey: ['k8s-stats'], queryFn: async () => { const r = await api.get('/api/v1/k8s/stats'); return r.data?.data; }, refetchInterval: 5000 }); }
function useK8sNodes() { return useQuery({ queryKey: ['k8s-nodes'], queryFn: async () => { const r = await api.get('/api/v1/k8s/nodes'); return r.data?.data; }, refetchInterval: 5000 }); }
function useK8sDeploys(ns: string) { return useQuery({ queryKey: ['k8s-deploys', ns], queryFn: async () => { const r = await api.get(`/api/v1/k8s/deployments?namespace=${ns}`); return r.data?.data; }, refetchInterval: 5000 }); }
function useK8sPods(ns: string) { return useQuery({ queryKey: ['k8s-pods', ns], queryFn: async () => { const r = await api.get(`/api/v1/k8s/pods?namespace=${ns}`); return r.data?.data; }, refetchInterval: 5000 }); }
function useK8sServices(ns: string) { return useQuery({ queryKey: ['k8s-svcs', ns], queryFn: async () => { const r = await api.get(`/api/v1/k8s/services?namespace=${ns}`); return r.data?.data; } }); }
function useK8sHPAs(ns: string) { return useQuery({ queryKey: ['k8s-hpas', ns], queryFn: async () => { const r = await api.get(`/api/v1/k8s/hpas?namespace=${ns}`); return r.data?.data; } }); }
function useK8sEvents() { return useQuery({ queryKey: ['k8s-events'], queryFn: async () => { const r = await api.get('/api/v1/k8s/events'); return r.data?.data; } }); }

function KpiCard({ icon: Icon, label, value, accent = '#4b8eff' }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; accent?: string }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderLeft: `3px solid ${accent}`, borderRadius: '8px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Icon className="w-4 h-4" />
        <Box>
          <Typography sx={{ ...sectionLabelSx, mb: 0.5 }}>{label}</Typography>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: MONO, color: '#e5e2e1' }}>{value}</Typography>
        </Box>
      </Box>
    </Paper>
  );
}

function NodesPanel({ nodes }: { nodes: any[] }) {
  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Cluster Nodes ({nodes.length})</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            {['Node', 'Status', 'Role', 'CPU', 'Memory', 'Pods', 'Version', 'IP'].map(h => (
              <TableCell key={h} sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a' }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {nodes.map((n: any) => (
            <TableRow key={n.name} sx={{ '&:hover': { backgroundColor: '#201f1f' } }}>
              <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.8rem', borderColor: '#2a2a2a', fontWeight: 600 }}>{n.name}</TableCell>
              <TableCell sx={{ borderColor: '#2a2a2a' }}>
                <Chip label={n.status} size="small" sx={{ fontFamily: MONO, fontSize: '0.6rem', height: 20, backgroundColor: n.status === 'Ready' ? '#53e16f20' : '#ef444420', color: n.status === 'Ready' ? '#53e16f' : '#ef4444' }} />
              </TableCell>
              <TableCell sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.75rem', borderColor: '#2a2a2a' }}>{n.role}</TableCell>
              <TableCell sx={{ borderColor: '#2a2a2a' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress variant="determinate" value={n.cpu_percent} sx={{ width: 50, height: 4, borderRadius: 2, backgroundColor: '#2a2a2a', '& .MuiLinearProgress-bar': { backgroundColor: n.cpu_percent > 80 ? '#ef4444' : n.cpu_percent > 60 ? '#ffb595' : '#53e16f' } }} />
                  <Typography sx={{ fontSize: '0.65rem', fontFamily: MONO, color: '#e5e2e1' }}>{n.cpu_usage}/{n.cpu_capacity}</Typography>
                </Box>
              </TableCell>
              <TableCell sx={{ borderColor: '#2a2a2a' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress variant="determinate" value={n.mem_percent} sx={{ width: 50, height: 4, borderRadius: 2, backgroundColor: '#2a2a2a', '& .MuiLinearProgress-bar': { backgroundColor: n.mem_percent > 80 ? '#ef4444' : n.mem_percent > 60 ? '#ffb595' : '#4b8eff' } }} />
                  <Typography sx={{ fontSize: '0.65rem', fontFamily: MONO, color: '#e5e2e1' }}>{n.mem_percent.toFixed(0)}%</Typography>
                </Box>
              </TableCell>
              <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.75rem', borderColor: '#2a2a2a' }}>{n.pods}/{n.max_pods}</TableCell>
              <TableCell sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{n.version}</TableCell>
              <TableCell sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{n.internal_ip}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

function DeploymentsPanel({ deployments, ns }: { deployments: any[]; ns: string }) {
  const queryClient = useQueryClient();
  const scale = useMutation({ mutationFn: async ({ name, replicas }: { name: string; replicas: number }) => { await api.post('/api/v1/k8s/scale', { name, namespace: ns, replicas }); }, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['k8s-deploys'] }) });
  const restart = useMutation({ mutationFn: async (name: string) => { await api.post('/api/v1/k8s/restart', { name, namespace: ns }); }, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['k8s-deploys'] }) });

  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Deployments ({deployments.length})</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            {['Name', 'Status', 'Ready', 'Image', 'Strategy', 'Actions'].map(h => (
              <TableCell key={h} sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a' }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {deployments.map((d: any) => (
            <TableRow key={d.name} sx={{ '&:hover': { backgroundColor: '#201f1f' } }}>
              <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.8rem', borderColor: '#2a2a2a', fontWeight: 600 }}>{d.name}</TableCell>
              <TableCell sx={{ borderColor: '#2a2a2a' }}>
                <Chip label={d.status} size="small" sx={{ fontFamily: MONO, fontSize: '0.6rem', height: 20, backgroundColor: d.status === 'Available' ? '#53e16f20' : '#ffb59520', color: d.status === 'Available' ? '#53e16f' : '#ffb595' }} />
              </TableCell>
              <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.75rem', borderColor: '#2a2a2a' }}>{d.ready_replicas}/{d.replicas}</TableCell>
              <TableCell sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{d.image}</TableCell>
              <TableCell sx={{ borderColor: '#2a2a2a' }}>
                <Chip label={d.strategy} size="small" sx={{ fontFamily: MONO, fontSize: '0.55rem', height: 18, backgroundColor: '#2a2a2a', color: '#c1c6d7' }} />
              </TableCell>
              <TableCell sx={{ borderColor: '#2a2a2a' }}>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Button size="small" onClick={() => scale.mutate({ name: d.name, replicas: d.replicas + 1 })} sx={{ fontFamily: MONO, fontSize: '0.55rem', textTransform: 'none', color: '#4b8eff', minWidth: 0, px: 1 }}>+1</Button>
                  {d.replicas > 1 && <Button size="small" onClick={() => scale.mutate({ name: d.name, replicas: d.replicas - 1 })} sx={{ fontFamily: MONO, fontSize: '0.55rem', textTransform: 'none', color: '#ffb595', minWidth: 0, px: 1 }}>-1</Button>}
                  <Button size="small" onClick={() => restart.mutate(d.name)} sx={{ fontFamily: MONO, fontSize: '0.55rem', textTransform: 'none', color: '#adc6ff', minWidth: 0, px: 1 }}><RefreshCw className="w-3 h-3" /></Button>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

function PodsPanel({ pods }: { pods: any[] }) {
  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Pods ({pods.length})</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            {['Pod', 'Phase', 'Ready', 'Node', 'IP', 'CPU', 'Memory', 'Restarts', 'Age'].map(h => (
              <TableCell key={h} sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.6rem', borderColor: '#2a2a2a' }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {pods.map((p: any) => (
            <TableRow key={p.name} sx={{ '&:hover': { backgroundColor: '#201f1f' } }}>
              <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</TableCell>
              <TableCell sx={{ borderColor: '#2a2a2a' }}>
                <Chip label={p.phase} size="small" sx={{ fontFamily: MONO, fontSize: '0.55rem', height: 18, backgroundColor: p.phase === 'Running' ? '#53e16f20' : '#ffb59520', color: p.phase === 'Running' ? '#53e16f' : '#ffb595' }} />
              </TableCell>
              <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{p.ready}</TableCell>
              <TableCell sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{p.node}</TableCell>
              <TableCell sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{p.ip}</TableCell>
              <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{p.cpu_usage}</TableCell>
              <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{p.mem_usage}</TableCell>
              <TableCell sx={{ color: p.restarts > 0 ? '#ffb595' : '#c1c6d7', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{p.restarts}</TableCell>
              <TableCell sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{p.age}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

function ServicesPanel({ services }: { services: any[] }) {
  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Services ({services.length})</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            {['Name', 'Type', 'Cluster IP', 'External IP', 'Ports'].map(h => (
              <TableCell key={h} sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a' }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {services.map((s: any) => (
            <TableRow key={s.name} sx={{ '&:hover': { backgroundColor: '#201f1f' } }}>
              <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.8rem', borderColor: '#2a2a2a', fontWeight: 600 }}>{s.name}</TableCell>
              <TableCell sx={{ borderColor: '#2a2a2a' }}>
                <Chip label={s.type} size="small" sx={{ fontFamily: MONO, fontSize: '0.6rem', height: 20, backgroundColor: s.type === 'LoadBalancer' ? '#4b8eff20' : '#2a2a2a', color: s.type === 'LoadBalancer' ? '#4b8eff' : '#c1c6d7' }} />
              </TableCell>
              <TableCell sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.75rem', borderColor: '#2a2a2a' }}>{s.cluster_ip}</TableCell>
              <TableCell sx={{ color: s.external_ip ? '#53e16f' : '#414755', fontFamily: MONO, fontSize: '0.75rem', borderColor: '#2a2a2a' }}>{s.external_ip || '—'}</TableCell>
              <TableCell sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>
                {(s.ports || []).map((p: any) => `${p.port}→${p.target_port}`).join(', ')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

function EventsPanel({ events }: { events: any[] }) {
  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Recent Events</Typography>
      {(events || []).map((e: any, i: number) => (
        <Box key={i} sx={{ p: 1.5, mb: 0.5, backgroundColor: '#0e0e0e', borderRadius: '4px', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Box sx={{ mt: 0.5 }}>
            {e.type === 'Warning' ? <AlertTriangle className="w-3 h-3" style={{ color: '#ffb595' }} /> : <CheckCircle className="w-3 h-3" style={{ color: '#53e16f' }} />}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, mb: 0.3, alignItems: 'center' }}>
              <Chip label={e.reason} size="small" sx={{ fontFamily: MONO, fontSize: '0.55rem', height: 16, backgroundColor: e.type === 'Warning' ? '#ffb59520' : '#53e16f20', color: e.type === 'Warning' ? '#ffb595' : '#53e16f' }} />
              <Typography sx={{ fontSize: '0.6rem', fontFamily: MONO, color: '#414755' }}>{e.object}</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.7rem', fontFamily: MONO, color: '#e5e2e1' }}>{e.message}</Typography>
          </Box>
          {e.count > 1 && <Chip label={`x${e.count}`} size="small" sx={{ fontFamily: MONO, fontSize: '0.55rem', height: 16, backgroundColor: '#2a2a2a', color: '#c1c6d7' }} />}
        </Box>
      ))}
    </Paper>
  );
}

export default function KubernetesPage() {
  const [ns, setNs] = useState('');
  const [tab, setTab] = useState(0);
  const { data: stats, isLoading } = useK8sStats();
  const { data: nodesData } = useK8sNodes();
  const { data: deploysData } = useK8sDeploys(ns);
  const { data: podsData } = useK8sPods(ns);
  const { data: svcsData } = useK8sServices(ns);
  const { data: eventsData } = useK8sEvents();

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><CircularProgress size={32} /></Box>;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>      <PageHeader title="Kubernetes" subtitle="Cluster management, deployments, pods, services, and autoscaling" />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 2 }}><KpiCard icon={Server} label="Nodes" value={`${stats?.ready_nodes}/${stats?.total_nodes}`} accent="#4b8eff" /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><KpiCard icon={BoxIcon} label="Pods" value={`${stats?.running_pods}/${stats?.total_pods}`} accent="#53e16f" /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><KpiCard icon={Layers} label="Deployments" value={stats?.total_deployments || 0} accent="#adc6ff" /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><KpiCard icon={Network} label="Services" value={stats?.total_services || 0} accent="#ffb595" /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><KpiCard icon={Activity} label="Namespaces" value={stats?.total_namespaces || 0} accent="#53e16f" /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><KpiCard icon={ArrowUpDown} label="Scale Events" value={stats?.scale_events || 0} accent="#ef4444" /></Grid>
      </Grid>

      <Paper elevation={0} sx={{ backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderRadius: '8px', mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, '& .MuiTab-root': { fontFamily: MONO, fontSize: '0.75rem', textTransform: 'none', color: '#c1c6d7', minHeight: 42 }, '& .Mui-selected': { color: '#4b8eff' }, '& .MuiTabs-indicator': { backgroundColor: '#4b8eff' } }}>
          <Tab label="Nodes" />
          <Tab label="Deployments" />
          <Tab label="Pods" />
          <Tab label="Services" />
          <Tab label="Events" />
        </Tabs>
      </Paper>

      {tab === 0 && <NodesPanel nodes={nodesData?.nodes || []} />}
      {tab === 1 && <DeploymentsPanel deployments={deploysData?.deployments || []} ns={ns || 'velocityllm'} />}
      {tab === 2 && <PodsPanel pods={podsData?.pods || []} />}
      {tab === 3 && <ServicesPanel services={svcsData?.services || []} />}
      {tab === 4 && <EventsPanel events={eventsData?.events || []} />}
    </Box>
  );
}
