'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import {
  Server, Cpu, HardDrive, Activity, Play, Square, Trash2, Plus,
  Gauge, Zap, DollarSign, ArrowUpDown, Clock, Box as BoxIcon,
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
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

const MONO = 'var(--font-mono), "JetBrains Mono", monospace';

const sectionLabelSx = {
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.2em',
  color: '#c1c6d7',
  fontFamily: MONO,
};

function useHostingStats() {
  return useQuery({
    queryKey: ['hosting-stats'],
    queryFn: async () => { const res = await api.get('/api/v1/hosting/stats'); return res.data?.data; },
    refetchInterval: 5000,
  });
}

function useHostedModels() {
  return useQuery({
    queryKey: ['hosted-models'],
    queryFn: async () => { const res = await api.get('/api/v1/hosting/models'); return res.data?.data; },
    refetchInterval: 5000,
  });
}

/* ── KPI Card ─────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, sub, accent = '#4b8eff' }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderLeft: `3px solid ${accent}`, borderRadius: '8px' }}>
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

/* ── Model Cards ──────────────────────────────────────── */
function ModelCard({ model }: { model: any }) {
  const queryClient = useQueryClient();

  const stopModel = useMutation({
    mutationFn: async () => { await api.post('/api/v1/hosting/stop', { id: model.id }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hosted-models'] }),
  });

  const startModel = useMutation({
    mutationFn: async () => { await api.post('/api/v1/hosting/start', { id: model.id }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hosted-models'] }),
  });

  const deleteModel = useMutation({
    mutationFn: async () => { await api.post('/api/v1/hosting/delete', { id: model.id }); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosted-models'] });
      queryClient.invalidateQueries({ queryKey: ['hosting-stats'] });
    },
  });

  const scaleModel = useMutation({
    mutationFn: async (replicas: number) => { await api.post('/api/v1/hosting/scale', { id: model.id, replicas }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hosted-models'] }),
  });

  const statusColors: Record<string, string> = {
    running: '#53e16f', stopped: '#4b5563', deploying: '#ffb595', failed: '#ef4444', scaling: '#4b8eff',
  };
  const frameworkColors: Record<string, string> = {
    pytorch: '#ee4c2c', tensorflow: '#ff6f00', onnx: '#005CED', triton: '#76b900',
  };
  const isRunning = model.status === 'running';

  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: '1rem', fontFamily: MONO, color: '#e5e2e1', fontWeight: 700 }}>{model.name}</Typography>
          <Typography sx={{ fontSize: '0.65rem', fontFamily: MONO, color: '#8b949e', mt: 0.3 }}>{model.model_path}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Chip label={model.status.toUpperCase()} size="small" sx={{ fontFamily: MONO, fontSize: '0.6rem', height: 22, backgroundColor: statusColors[model.status] + '20', color: statusColors[model.status] }} />
          <Chip label={model.framework} size="small" sx={{ fontFamily: MONO, fontSize: '0.6rem', height: 22, backgroundColor: (frameworkColors[model.framework] || '#8b949e') + '20', color: frameworkColors[model.framework] || '#8b949e' }} />
        </Box>
      </Box>

      {/* Specs Row */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <Chip icon={<Cpu className="w-3 h-3" />} label={model.gpu} size="small" sx={{ fontFamily: MONO, fontSize: '0.6rem', height: 22, backgroundColor: '#2a2a2a', color: '#c1c6d7', '& .MuiChip-icon': { color: '#c1c6d7' } }} />
        <Chip label={`${model.replicas} replica${model.replicas !== 1 ? 's' : ''}`} size="small" sx={{ fontFamily: MONO, fontSize: '0.6rem', height: 22, backgroundColor: '#2a2a2a', color: '#c1c6d7' }} />
        {model.quantization !== 'none' && <Chip label={`Q:${model.quantization}`} size="small" sx={{ fontFamily: MONO, fontSize: '0.6rem', height: 22, backgroundColor: '#adc6ff20', color: '#adc6ff' }} />}
        <Chip label={`$${(model.cost_per_hour * model.replicas).toFixed(2)}/hr`} size="small" sx={{ fontFamily: MONO, fontSize: '0.6rem', height: 22, backgroundColor: '#ffb59520', color: '#ffb595' }} />
      </Box>

      {/* Metrics */}
      {isRunning && (
        <Box sx={{ mb: 2 }}>
          <Grid container spacing={1}>
            <Grid size={{ xs: 6 }}>
              <Box sx={{ p: 1, backgroundColor: '#0e0e0e', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
                <Typography sx={{ fontSize: '0.55rem', fontFamily: MONO, color: '#8b949e' }}>GPU UTIL</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress variant="determinate" value={model.metrics.gpu_utilization} sx={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: '#2a2a2a', '& .MuiLinearProgress-bar': { backgroundColor: model.metrics.gpu_utilization > 80 ? '#ef4444' : model.metrics.gpu_utilization > 60 ? '#ffb595' : '#53e16f' } }} />
                  <Typography sx={{ fontSize: '0.7rem', fontFamily: MONO, color: '#e5e2e1' }}>{model.metrics.gpu_utilization.toFixed(0)}%</Typography>
                </Box>
              </Box>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Box sx={{ p: 1, backgroundColor: '#0e0e0e', borderRadius: '4px', border: '1px solid #2a2a2a' }}>
                <Typography sx={{ fontSize: '0.55rem', fontFamily: MONO, color: '#8b949e' }}>MEMORY</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress variant="determinate" value={(model.metrics.memory_used_gb / model.metrics.memory_total_gb) * 100} sx={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: '#2a2a2a', '& .MuiLinearProgress-bar': { backgroundColor: '#4b8eff' } }} />
                  <Typography sx={{ fontSize: '0.7rem', fontFamily: MONO, color: '#e5e2e1' }}>{model.metrics.memory_used_gb.toFixed(1)}G</Typography>
                </Box>
              </Box>
            </Grid>
            <Grid size={{ xs: 4 }}>
              <Box sx={{ p: 1, backgroundColor: '#0e0e0e', borderRadius: '4px', border: '1px solid #2a2a2a', textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.55rem', fontFamily: MONO, color: '#8b949e' }}>LATENCY</Typography>
                <Typography sx={{ fontSize: '0.85rem', fontFamily: MONO, color: '#e5e2e1', fontWeight: 600 }}>{model.metrics.avg_latency_ms.toFixed(0)}ms</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 4 }}>
              <Box sx={{ p: 1, backgroundColor: '#0e0e0e', borderRadius: '4px', border: '1px solid #2a2a2a', textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.55rem', fontFamily: MONO, color: '#8b949e' }}>THROUGHPUT</Typography>
                <Typography sx={{ fontSize: '0.85rem', fontFamily: MONO, color: '#e5e2e1', fontWeight: 600 }}>{model.metrics.tokens_per_second.toFixed(0)} t/s</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 4 }}>
              <Box sx={{ p: 1, backgroundColor: '#0e0e0e', borderRadius: '4px', border: '1px solid #2a2a2a', textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.55rem', fontFamily: MONO, color: '#8b949e' }}>UPTIME</Typography>
                <Typography sx={{ fontSize: '0.85rem', fontFamily: MONO, color: '#53e16f', fontWeight: 600 }}>{model.metrics.uptime}</Typography>
              </Box>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        {isRunning && (
          <>
            <Button size="small" onClick={() => scaleModel.mutate(model.replicas + 1)} sx={{ fontFamily: MONO, fontSize: '0.6rem', textTransform: 'none', color: '#4b8eff', minWidth: 0 }}>
              <ArrowUpDown className="w-3 h-3" style={{ marginRight: 3 }} /> Scale Up
            </Button>
            {model.replicas > 1 && (
              <Button size="small" onClick={() => scaleModel.mutate(model.replicas - 1)} sx={{ fontFamily: MONO, fontSize: '0.6rem', textTransform: 'none', color: '#ffb595', minWidth: 0 }}>
                Scale Down
              </Button>
            )}
            <Button size="small" onClick={() => stopModel.mutate()} sx={{ fontFamily: MONO, fontSize: '0.6rem', textTransform: 'none', color: '#ef4444', minWidth: 0 }}>
              <Square className="w-3 h-3" style={{ marginRight: 3 }} /> Stop
            </Button>
          </>
        )}
        {model.status === 'stopped' && (
          <Button size="small" onClick={() => startModel.mutate()} sx={{ fontFamily: MONO, fontSize: '0.6rem', textTransform: 'none', color: '#53e16f', minWidth: 0 }}>
            <Play className="w-3 h-3" style={{ marginRight: 3 }} /> Start
          </Button>
        )}
        <Button size="small" onClick={() => deleteModel.mutate()} sx={{ fontFamily: MONO, fontSize: '0.6rem', textTransform: 'none', color: '#ef4444', minWidth: 0 }}>
          <Trash2 className="w-3 h-3" style={{ marginRight: 3 }} /> Delete
        </Button>
      </Box>
    </Paper>
  );
}

/* ── Deploy Dialog ────────────────────────────────────── */
function DeployDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', model_path: '', framework: 'pytorch', gpu: 'T4-16GB', quantization: 'none', replicas: 1 });

  const deploy = useMutation({
    mutationFn: async () => {
      await api.post('/api/v1/hosting/deploy', { ...form, model_source: 'huggingface', max_batch_size: 16, max_sequence_len: 4096 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosted-models'] });
      queryClient.invalidateQueries({ queryKey: ['hosting-stats'] });
      onClose();
      setForm({ name: '', model_path: '', framework: 'pytorch', gpu: 'T4-16GB', quantization: 'none', replicas: 1 });
    },
  });

  const inputSx = { '& .MuiOutlinedInput-root': { backgroundColor: '#0e0e0e', color: '#e5e2e1', fontFamily: MONO, fontSize: '0.8rem', '& fieldset': { borderColor: '#2a2a2a' } } };
  const selectStyle = { width: '100%', padding: '10px 12px', backgroundColor: '#0e0e0e', border: '1px solid #2a2a2a', borderRadius: '6px', color: '#e5e2e1', fontFamily: MONO, fontSize: '0.8rem' };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderRadius: '12px' } }}>
      <DialogTitle sx={{ fontFamily: MONO, color: '#e5e2e1', fontSize: '1rem' }}>Deploy Custom Model</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <TextField label="Model Name" size="small" fullWidth value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} sx={inputSx} InputLabelProps={{ sx: { color: '#8b949e', fontFamily: MONO, fontSize: '0.75rem' } }} />
        <TextField label="Model Path (HuggingFace)" size="small" fullWidth placeholder="meta-llama/Llama-3-8B" value={form.model_path} onChange={(e) => setForm({ ...form, model_path: e.target.value })} sx={inputSx} InputLabelProps={{ sx: { color: '#8b949e', fontFamily: MONO, fontSize: '0.75rem' } }} />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.65rem', fontFamily: MONO, color: '#8b949e', mb: 0.5 }}>Framework</Typography>
            <select value={form.framework} onChange={(e) => setForm({ ...form, framework: e.target.value })} style={selectStyle}>
              <option value="pytorch">PyTorch</option>
              <option value="onnx">ONNX</option>
              <option value="triton">Triton</option>
              <option value="tensorflow">TensorFlow</option>
            </select>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.65rem', fontFamily: MONO, color: '#8b949e', mb: 0.5 }}>GPU</Typography>
            <select value={form.gpu} onChange={(e) => setForm({ ...form, gpu: e.target.value })} style={selectStyle}>
              <option value="H100-80GB">H100 (80GB)</option>
              <option value="A100-80GB">A100 (80GB)</option>
              <option value="A10G-24GB">A10G (24GB)</option>
              <option value="L4-24GB">L4 (24GB)</option>
              <option value="T4-16GB">T4 (16GB)</option>
              <option value="CPU-only">CPU Only</option>
            </select>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.65rem', fontFamily: MONO, color: '#8b949e', mb: 0.5 }}>Quantization</Typography>
            <select value={form.quantization} onChange={(e) => setForm({ ...form, quantization: e.target.value })} style={selectStyle}>
              <option value="none">None (FP16)</option>
              <option value="int8">INT8</option>
              <option value="int4">INT4</option>
              <option value="gptq">GPTQ</option>
              <option value="awq">AWQ</option>
            </select>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.65rem', fontFamily: MONO, color: '#8b949e', mb: 0.5 }}>Replicas</Typography>
            <TextField size="small" fullWidth type="number" value={form.replicas} onChange={(e) => setForm({ ...form, replicas: parseInt(e.target.value) || 1 })} sx={inputSx} inputProps={{ min: 1, max: 8 }} />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ fontFamily: MONO, fontSize: '0.75rem', color: '#8b949e', textTransform: 'none' }}>Cancel</Button>
        <Button
          onClick={() => deploy.mutate()}
          disabled={deploy.isPending || !form.name || !form.model_path}
          variant="contained"
          sx={{ fontFamily: MONO, fontSize: '0.75rem', textTransform: 'none', backgroundColor: '#4b8eff', '&:hover': { backgroundColor: '#3a7dee' } }}
        >
          Deploy Model
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ── Main Page ────────────────────────────────────────── */
export default function HostingPage() {
  const { data: stats, isLoading } = useHostingStats();
  const { data: modelsData } = useHostedModels();
  const [deployOpen, setDeployOpen] = useState(false);

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><CircularProgress size={32} /></Box>;
  }

  const models = modelsData?.models || [];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>      <PageHeader title="Model Hosting" subtitle="Deploy, scale, and manage custom models with GPU acceleration" />

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 2 }}><KpiCard icon={Server} label="Models" value={stats?.total_models || 0} accent="#4b8eff" /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><KpiCard icon={Activity} label="Running" value={stats?.running_models || 0} accent="#53e16f" /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><KpiCard icon={Cpu} label="GPUs" value={stats?.total_gpus || 0} accent="#adc6ff" /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><KpiCard icon={Gauge} label="Avg GPU" value={`${(stats?.avg_gpu_utilization || 0).toFixed(0)}%`} accent="#ffb595" /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><KpiCard icon={Zap} label="Requests" value={(stats?.total_requests || 0).toLocaleString()} accent="#53e16f" /></Grid>
        <Grid size={{ xs: 6, md: 2 }}><KpiCard icon={DollarSign} label="Cost/hr" value={`$${(stats?.total_cost_per_hour || 0).toFixed(2)}`} accent="#ef4444" /></Grid>
      </Grid>

      {/* Deploy Button */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          onClick={() => setDeployOpen(true)}
          sx={{ fontFamily: MONO, fontSize: '0.75rem', textTransform: 'none', backgroundColor: '#4b8eff', '&:hover': { backgroundColor: '#3a7dee' } }}
        >
          <Plus className="w-4 h-4" style={{ marginRight: 6 }} /> Deploy New Model
        </Button>
      </Box>

      {/* Model Cards */}
      <Grid container spacing={2}>
        {models.map((model: any) => (
          <Grid key={model.id} size={{ xs: 12, md: 6 }}>
            <ModelCard model={model} />
          </Grid>
        ))}
      </Grid>

      {models.length === 0 && (
        <Alert severity="info" sx={{ mt: 2, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', '& .MuiAlert-message': { fontFamily: MONO, fontSize: '0.8rem', color: '#e5e2e1' } }}>
          No models deployed yet. Click "Deploy New Model" to get started.
        </Alert>
      )}

      <DeployDialog open={deployOpen} onClose={() => setDeployOpen(false)} />
    </Box>
  );
}
