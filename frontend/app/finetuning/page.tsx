'use client';

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import LinearProgress from '@mui/material/LinearProgress';
import { useTheme } from '@mui/material/styles';
import {
  Sparkles, Database, Play, BarChart3, Trash2, Plus, X,
  CheckCircle, XCircle, Clock, Cpu, FileText, Loader,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { finetuningAPI } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Example {
  input: string;
  output: string;
}

interface Dataset {
  id: string;
  name: string;
  description: string;
  format: string;
  examples: Example[];
  size: number;
  created_at: string;
}

interface JobMetrics {
  train_loss: number;
  eval_loss: number;
}

interface Job {
  id: string;
  dataset_id: string;
  base_model: string;
  status: string;
  config: { epochs: number; learning_rate: number; batch_size: number };
  progress: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  result_model_id?: string;
  metrics?: JobMetrics;
}

interface FineTunedModel {
  id: string;
  job_id: string;
  base_model: string;
  name: string;
  status: string;
  created_at: string;
}

interface Stats {
  total_datasets: number;
  total_jobs: number;
  total_models: number;
  jobs_completed: number;
  jobs_training: number;
  jobs_failed: number;
  jobs_cancelled: number;
  jobs_pending: number;
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}) {
  const theme = useTheme();
  return (
    <Paper
      sx={{
        p: 2.5,
        borderRadius: 2,
        backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{
          width: 40, height: 40, borderRadius: '10px',
          backgroundColor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Box sx={{ color }}><Icon className="w-5 h-5" /></Box>
        </Box>
        <Box>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>{label}</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{value}</Typography>
        </Box>
      </Box>
    </Paper>
  );
}

// ─── Status Chip ────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { color: 'success' | 'warning' | 'error' | 'info' | 'default'; label: string }> = {
    pending: { color: 'default', label: 'Pending' },
    training: { color: 'warning', label: 'Training' },
    completed: { color: 'success', label: 'Completed' },
    failed: { color: 'error', label: 'Failed' },
    cancelled: { color: 'default', label: 'Cancelled' },
    ready: { color: 'success', label: 'Ready' },
    deploying: { color: 'info', label: 'Deploying' },
  };
  const s = map[status] || { color: 'default' as const, label: status };
  return <Chip size="small" color={s.color} label={s.label} />;
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function FineTuningPage() {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [models, setModels] = useState<FineTunedModel[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Dataset form
  const [dsName, setDsName] = useState('');
  const [dsDesc, setDsDesc] = useState('');
  const [dsFormat, setDsFormat] = useState('jsonl');
  const [dsExamples, setDsExamples] = useState<Example[]>([{ input: '', output: '' }]);

  // Job form
  const [jobDatasetId, setJobDatasetId] = useState('');
  const [jobBaseModel, setJobBaseModel] = useState('gpt-4o-mini');
  const [jobEpochs, setJobEpochs] = useState(3);
  const [jobLR, setJobLR] = useState(0.0001);
  const [jobBatchSize, setJobBatchSize] = useState(4);

  const showSnack = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, message, severity });

  const fetchAll = useCallback(async () => {
    try {
      const [dsRes, jobRes, modelRes, statsRes] = await Promise.all([
        finetuningAPI.listDatasets(),
        finetuningAPI.listJobs(),
        finetuningAPI.listModels(),
        finetuningAPI.getStats(),
      ]);
      setDatasets(dsRes.data?.data || []);
      setJobs(jobRes.data?.data || []);
      setModels(modelRes.data?.data || []);
      setStats(statsRes.data?.data || null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Poll for active jobs
  useEffect(() => {
    const hasActive = jobs.some(j => j.status === 'training' || j.status === 'pending');
    if (!hasActive) return;
    const interval = setInterval(fetchAll, 2000);
    return () => clearInterval(interval);
  }, [jobs, fetchAll]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleCreateDataset = async () => {
    if (!dsName.trim()) return;
    const validExamples = dsExamples.filter(e => e.input.trim() || e.output.trim());
    try {
      await finetuningAPI.createDataset({
        name: dsName, description: dsDesc, format: dsFormat, examples: validExamples,
      });
      showSnack('Dataset created');
      setDsName(''); setDsDesc(''); setDsExamples([{ input: '', output: '' }]);
      fetchAll();
    } catch {
      showSnack('Failed to create dataset', 'error');
    }
  };

  const handleDeleteDataset = async (id: string) => {
    try {
      await finetuningAPI.deleteDataset(id);
      showSnack('Dataset deleted');
      fetchAll();
    } catch {
      showSnack('Failed to delete dataset', 'error');
    }
  };

  const handleCreateJob = async () => {
    if (!jobDatasetId) return;
    try {
      await finetuningAPI.createJob({
        dataset_id: jobDatasetId,
        base_model: jobBaseModel,
        epochs: jobEpochs,
        learning_rate: jobLR,
        batch_size: jobBatchSize,
      });
      showSnack('Training job created');
      fetchAll();
    } catch {
      showSnack('Failed to create job', 'error');
    }
  };

  const handleCancelJob = async (id: string) => {
    try {
      await finetuningAPI.cancelJob(id);
      showSnack('Job cancelled');
      fetchAll();
    } catch {
      showSnack('Failed to cancel job', 'error');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // ── Tab: Datasets ─────────────────────────────────────────────────────────

  const DatasetsTab = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Create Form */}
      <Paper sx={{ p: 3, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Plus className="w-5 h-5" /> Create Dataset
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <TextField size="small" label="Name" value={dsName} onChange={e => setDsName(e.target.value)}
            sx={{ flex: 1, minWidth: 200 }} />
          <TextField size="small" label="Description" value={dsDesc} onChange={e => setDsDesc(e.target.value)}
            sx={{ flex: 2, minWidth: 200 }} />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Format</InputLabel>
            <Select value={dsFormat} label="Format" onChange={e => setDsFormat(e.target.value)}>
              <MenuItem value="jsonl">JSONL</MenuItem>
              <MenuItem value="csv">CSV</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>Training Examples</Typography>
        {dsExamples.map((ex, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
            <TextField size="small" label="Input" value={ex.input} multiline maxRows={3}
              onChange={e => {
                const next = [...dsExamples];
                next[i] = { ...next[i], input: e.target.value };
                setDsExamples(next);
              }}
              sx={{ flex: 1 }} />
            <TextField size="small" label="Output" value={ex.output} multiline maxRows={3}
              onChange={e => {
                const next = [...dsExamples];
                next[i] = { ...next[i], output: e.target.value };
                setDsExamples(next);
              }}
              sx={{ flex: 1 }} />
            <IconButton size="small" onClick={() => setDsExamples(dsExamples.filter((_, j) => j !== i))}
              disabled={dsExamples.length <= 1}>
              <X className="w-4 h-4" />
            </IconButton>
          </Box>
        ))}
        <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
          <Button size="small" variant="outlined" startIcon={<Plus className="w-4 h-4" />}
            onClick={() => setDsExamples([...dsExamples, { input: '', output: '' }])}>
            Add Example
          </Button>
          <Button variant="contained" onClick={handleCreateDataset} disabled={!dsName.trim()}>
            Create Dataset
          </Button>
        </Box>
      </Paper>

      {/* Dataset List */}
      {datasets.length === 0 ? (
        <Alert severity="info">No datasets yet. Create one above to get started.</Alert>
      ) : (
        datasets.map(ds => (
          <Paper key={ds.id} sx={{ p: 2.5, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{ds.name}</Typography>
                <Typography variant="body2" color="text.secondary">{ds.description}</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Chip size="small" label={ds.format.toUpperCase()} variant="outlined" />
                  <Chip size="small" label={`${ds.size} examples`} variant="outlined" />
                  <Chip size="small" label={new Date(ds.created_at).toLocaleDateString()} variant="outlined" />
                </Box>
              </Box>
              <IconButton color="error" onClick={() => handleDeleteDataset(ds.id)}>
                <Trash2 className="w-4 h-4" />
              </IconButton>
            </Box>
            {ds.examples && ds.examples.length > 0 && (
              <Box sx={{ mt: 2, p: 1.5, borderRadius: 1, backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>Sample:</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', mt: 0.5 }}>
                  Input: {ds.examples[0].input.slice(0, 120)}{ds.examples[0].input.length > 120 ? '...' : ''}
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  Output: {ds.examples[0].output.slice(0, 120)}{ds.examples[0].output.length > 120 ? '...' : ''}
                </Typography>
              </Box>
            )}
          </Paper>
        ))
      )}
    </Box>
  );

  // ── Tab: Training ─────────────────────────────────────────────────────────

  const TrainingTab = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Create Job Form */}
      <Paper sx={{ p: 3, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Play className="w-5 h-5" /> Launch Training Job
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200, flex: 1 }}>
            <InputLabel>Dataset</InputLabel>
            <Select value={jobDatasetId} label="Dataset" onChange={e => setJobDatasetId(e.target.value)}>
              {datasets.map(ds => (
                <MenuItem key={ds.id} value={ds.id}>{ds.name} ({ds.size} examples)</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Base Model</InputLabel>
            <Select value={jobBaseModel} label="Base Model" onChange={e => setJobBaseModel(e.target.value)}>
              <MenuItem value="gpt-4o-mini">GPT-4o Mini</MenuItem>
              <MenuItem value="gpt-4o">GPT-4o</MenuItem>
              <MenuItem value="claude-sonnet-4-20250514">Claude Sonnet</MenuItem>
              <MenuItem value="llama-3.1-8b">Llama 3.1 8B</MenuItem>
            </Select>
          </FormControl>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <TextField size="small" label="Epochs" type="number" value={jobEpochs}
            onChange={e => setJobEpochs(Number(e.target.value))} sx={{ width: 120 }}
            inputProps={{ min: 1, max: 20 }} />
          <TextField size="small" label="Learning Rate" type="number" value={jobLR}
            onChange={e => setJobLR(Number(e.target.value))} sx={{ width: 160 }}
            inputProps={{ step: 0.00001, min: 0.00001, max: 0.01 }} />
          <TextField size="small" label="Batch Size" type="number" value={jobBatchSize}
            onChange={e => setJobBatchSize(Number(e.target.value))} sx={{ width: 120 }}
            inputProps={{ min: 1, max: 64 }} />
        </Box>

        <Button variant="contained" onClick={handleCreateJob} disabled={!jobDatasetId}
          startIcon={<Play className="w-4 h-4" />}>
          Start Training
        </Button>
      </Paper>

      {/* Jobs List */}
      {jobs.length === 0 ? (
        <Alert severity="info">No training jobs yet. Select a dataset and start training above.</Alert>
      ) : (
        jobs.map(job => (
          <Paper key={job.id} sx={{ p: 2.5, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.9rem' }}>
                  {job.id.slice(0, 8)}
                </Typography>
                <StatusChip status={job.status} />
                <Chip size="small" label={job.base_model} variant="outlined" />
              </Box>
              {(job.status === 'training' || job.status === 'pending') && (
                <Button size="small" color="error" variant="outlined" onClick={() => handleCancelJob(job.id)}>
                  Cancel
                </Button>
              )}
            </Box>

            {(job.status === 'training' || job.status === 'pending') && (
              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Progress</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>{job.progress}%</Typography>
                </Box>
                <LinearProgress variant="determinate" value={job.progress}
                  sx={{ height: 8, borderRadius: 4 }} />
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary">
                Epochs: {job.config.epochs} | LR: {job.config.learning_rate} | Batch: {job.config.batch_size}
              </Typography>
              {job.metrics && (
                <Typography variant="body2" color="text.secondary">
                  Train Loss: {job.metrics.train_loss} | Eval Loss: {job.metrics.eval_loss}
                </Typography>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Created: {new Date(job.created_at).toLocaleString()}
              {job.completed_at && ` | Completed: ${new Date(job.completed_at).toLocaleString()}`}
            </Typography>
          </Paper>
        ))
      )}
    </Box>
  );

  // ── Tab: Models ───────────────────────────────────────────────────────────

  const ModelsTab = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {models.length === 0 ? (
        <Alert severity="info">No fine-tuned models yet. Complete a training job to see models here.</Alert>
      ) : (
        models.map(m => (
          <Paper key={m.id} sx={{ p: 2.5, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{m.name}</Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                  <Chip size="small" label={`Base: ${m.base_model}`} variant="outlined" />
                  <StatusChip status={m.status} />
                  <Chip size="small" label={`Job: ${m.job_id.slice(0, 8)}`} variant="outlined" />
                </Box>
              </Box>
              <Typography variant="caption" color="text.secondary">
                {new Date(m.created_at).toLocaleString()}
              </Typography>
            </Box>
          </Paper>
        ))
      )}
    </Box>
  );

  // ── Tab: Stats ────────────────────────────────────────────────────────────

  const statusBreakdown = stats ? [
    { name: 'Completed', value: stats.jobs_completed, color: '#4caf50' },
    { name: 'Training', value: stats.jobs_training, color: '#ff9800' },
    { name: 'Pending', value: stats.jobs_pending, color: '#9e9e9e' },
    { name: 'Failed', value: stats.jobs_failed, color: '#f44336' },
    { name: 'Cancelled', value: stats.jobs_cancelled, color: '#607d8b' },
  ].filter(s => s.value > 0) : [];

  const StatsTab = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 2 }}>
        <StatCard icon={Database} label="Total Datasets" value={stats?.total_datasets ?? 0} color="#3b82f6" />
        <StatCard icon={Cpu} label="Total Jobs" value={stats?.total_jobs ?? 0} color="#8b5cf6" />
        <StatCard icon={CheckCircle} label="Completed" value={stats?.jobs_completed ?? 0} color="#4caf50" />
        <StatCard icon={Sparkles} label="Fine-Tuned Models" value={stats?.total_models ?? 0} color="#f59e0b" />
      </Box>

      {statusBreakdown.length > 0 && (
        <Paper sx={{ p: 3, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Job Status Breakdown</Typography>
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis dataKey="name" tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 8,
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {statusBreakdown.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      )}
    </Box>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{
          width: 40, height: 40, borderRadius: '10px',
          background: 'linear-gradient(135deg, #f59e0b, #f97316)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles className="w-5 h-5" style={{ color: '#fff' }} />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Fine-Tuning</Typography>
          <Typography variant="body2" color="text.secondary">
            Upload datasets, train custom models, and monitor training progress
          </Typography>
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: `1px solid ${theme.palette.divider}` }}>
        <Tab icon={<Database className="w-4 h-4" />} iconPosition="start" label="Datasets" />
        <Tab icon={<Play className="w-4 h-4" />} iconPosition="start" label="Training" />
        <Tab icon={<Cpu className="w-4 h-4" />} iconPosition="start" label="Models" />
        <Tab icon={<BarChart3 className="w-4 h-4" />} iconPosition="start" label="Stats" />
      </Tabs>

      {tab === 0 && DatasetsTab}
      {tab === 1 && TrainingTab}
      {tab === 2 && ModelsTab}
      {tab === 3 && StatsTab}

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
