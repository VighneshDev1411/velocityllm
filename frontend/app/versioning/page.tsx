'use client';

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
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
import Slider from '@mui/material/Slider';
import { useTheme } from '@mui/material/styles';
import {
  GitBranch, Plus, ArrowUpCircle, Archive, FlaskConical, BarChart3,
  CheckCircle, Clock, Rocket, FileText, Layers, Zap,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { versioningAPI } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────────────────

interface VersionMetrics {
  accuracy: number;
  latency: number;
  throughput: number;
}

interface ModelVersion {
  id: string;
  model_name: string;
  version: string;
  description: string;
  base_model: string;
  status: string;
  config: Record<string, string>;
  metrics: VersionMetrics;
  created_at: string;
  promoted_at?: string;
}

interface ABTestResults {
  requests: number;
  version_a_wins: number;
  version_b_wins: number;
  avg_latency_a: number;
  avg_latency_b: number;
}

interface ABTest {
  id: string;
  model_name: string;
  version_a: string;
  version_b: string;
  status: string;
  traffic_split: number;
  results: ABTestResults;
  created_at: string;
  completed_at?: string;
}

interface Stats {
  total_versions: number;
  versions_draft: number;
  versions_active: number;
  versions_deployed: number;
  versions_archived: number;
  total_abtests: number;
  abtests_running: number;
  abtests_completed: number;
  abtests_stopped: number;
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
        p: 2.5, borderRadius: 2,
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
    draft: { color: 'default', label: 'Draft' },
    active: { color: 'info', label: 'Active' },
    deployed: { color: 'success', label: 'Deployed' },
    archived: { color: 'default', label: 'Archived' },
    running: { color: 'warning', label: 'Running' },
    completed: { color: 'success', label: 'Completed' },
    stopped: { color: 'error', label: 'Stopped' },
  };
  const s = map[status] || { color: 'default' as const, label: status };
  return <Chip size="small" color={s.color} label={s.label} />;
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function VersioningPage() {
  const theme = useTheme();
  const [tab, setTab] = useState(0);
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [abtests, setABTests] = useState<ABTest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Version form
  const [vModelName, setVModelName] = useState('');
  const [vVersion, setVVersion] = useState('');
  const [vDesc, setVDesc] = useState('');
  const [vBaseModel, setVBaseModel] = useState('gpt-4o-mini');
  const [vConfig, setVConfig] = useState('{}');

  // Compare form
  const [compareA, setCompareA] = useState('');
  const [compareB, setCompareB] = useState('');

  // AB Test form
  const [abVersionA, setAbVersionA] = useState('');
  const [abVersionB, setAbVersionB] = useState('');
  const [abSplit, setAbSplit] = useState(50);

  const showSnack = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, message, severity });

  const fetchAll = useCallback(async () => {
    try {
      const [vRes, abRes, sRes] = await Promise.all([
        versioningAPI.listVersions(),
        versioningAPI.listABTests(),
        versioningAPI.getStats(),
      ]);
      setVersions(vRes.data?.data || []);
      setABTests(abRes.data?.data || []);
      setStats(sRes.data?.data || null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Poll when AB tests are running
  useEffect(() => {
    const hasRunning = abtests.some(t => t.status === 'running');
    if (!hasRunning) return;
    const interval = setInterval(fetchAll, 2000);
    return () => clearInterval(interval);
  }, [abtests, fetchAll]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCreateVersion = async () => {
    if (!vModelName.trim() || !vVersion.trim()) return;
    let config: Record<string, string> = {};
    try { config = JSON.parse(vConfig); } catch { /* use empty */ }
    try {
      await versioningAPI.createVersion({
        model_name: vModelName, version: vVersion, description: vDesc,
        base_model: vBaseModel, config,
      });
      showSnack('Version created');
      setVModelName(''); setVVersion(''); setVDesc(''); setVConfig('{}');
      fetchAll();
    } catch {
      showSnack('Failed to create version', 'error');
    }
  };

  const handlePromote = async (id: string) => {
    try {
      await versioningAPI.promoteVersion(id);
      showSnack('Version promoted to deployed');
      fetchAll();
    } catch {
      showSnack('Failed to promote version', 'error');
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await versioningAPI.archiveVersion(id);
      showSnack('Version archived');
      fetchAll();
    } catch {
      showSnack('Failed to archive version', 'error');
    }
  };

  const handleCreateABTest = async () => {
    if (!abVersionA || !abVersionB) return;
    const vA = versions.find(v => v.id === abVersionA);
    try {
      await versioningAPI.createABTest({
        model_name: vA?.model_name || '',
        version_a: abVersionA,
        version_b: abVersionB,
        traffic_split: abSplit,
      });
      showSnack('A/B test started');
      fetchAll();
    } catch {
      showSnack('Failed to create A/B test', 'error');
    }
  };

  const handleStopABTest = async (id: string) => {
    try {
      await versioningAPI.stopABTest(id);
      showSnack('A/B test stopped');
      fetchAll();
    } catch {
      showSnack('Failed to stop A/B test', 'error');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  const versionLabel = (id: string) => {
    const v = versions.find(x => x.id === id);
    return v ? `${v.model_name} v${v.version}` : id.slice(0, 8);
  };

  // ── Tab: Versions ───────────────────────────────────────────────────────

  const VersionsTab = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper sx={{ p: 3, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Plus className="w-5 h-5" /> Register Version
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <TextField size="small" label="Model Name" value={vModelName} onChange={e => setVModelName(e.target.value)}
            placeholder="my-chatbot" sx={{ flex: 1, minWidth: 180 }} />
          <TextField size="small" label="Version" value={vVersion} onChange={e => setVVersion(e.target.value)}
            placeholder="1.0.0" sx={{ width: 120 }} />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Base Model</InputLabel>
            <Select value={vBaseModel} label="Base Model" onChange={e => setVBaseModel(e.target.value)}>
              <MenuItem value="gpt-4o-mini">GPT-4o Mini</MenuItem>
              <MenuItem value="gpt-4o">GPT-4o</MenuItem>
              <MenuItem value="claude-sonnet-4-20250514">Claude Sonnet</MenuItem>
              <MenuItem value="llama-3.1-70b">Llama 3.1 70B</MenuItem>
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <TextField size="small" label="Description" value={vDesc} onChange={e => setVDesc(e.target.value)}
            sx={{ flex: 2, minWidth: 200 }} />
          <TextField size="small" label="Config (JSON)" value={vConfig} onChange={e => setVConfig(e.target.value)}
            sx={{ flex: 1, minWidth: 200 }} />
        </Box>
        <Button variant="contained" onClick={handleCreateVersion} disabled={!vModelName.trim() || !vVersion.trim()}
          startIcon={<Plus className="w-4 h-4" />}>
          Register Version
        </Button>
      </Paper>

      {versions.length === 0 ? (
        <Alert severity="info">No model versions registered yet. Create one above to get started.</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {versions.map(v => (
            <Paper key={v.id} sx={{
              p: 2.5, borderRadius: 2, border: `1px solid ${theme.palette.divider}`,
              display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
            }}>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {v.model_name} <Typography component="span" sx={{ color: 'text.secondary' }}>v{v.version}</Typography>
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {v.base_model} {v.description && `— ${v.description}`}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip size="small" label={`Acc: ${(v.metrics.accuracy * 100).toFixed(1)}%`} variant="outlined" />
                <Chip size="small" label={`Lat: ${v.metrics.latency.toFixed(0)}ms`} variant="outlined" />
                <Chip size="small" label={`Thr: ${v.metrics.throughput.toFixed(0)} req/s`} variant="outlined" />
              </Box>
              <StatusChip status={v.status} />
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {v.status !== 'deployed' && v.status !== 'archived' && (
                  <Button size="small" variant="outlined" color="success" onClick={() => handlePromote(v.id)}
                    startIcon={<ArrowUpCircle className="w-4 h-4" />}>
                    Promote
                  </Button>
                )}
                {v.status !== 'deployed' && v.status !== 'archived' && (
                  <Button size="small" variant="outlined" color="warning" onClick={() => handleArchive(v.id)}
                    startIcon={<Archive className="w-4 h-4" />}>
                    Archive
                  </Button>
                )}
              </Box>
            </Paper>
          ))}
        </Box>
      )}
    </Box>
  );

  // ── Tab: Compare ────────────────────────────────────────────────────────

  const vA = versions.find(v => v.id === compareA);
  const vB = versions.find(v => v.id === compareB);

  const comparisonData = vA && vB ? [
    { metric: 'Accuracy (%)', A: +(vA.metrics.accuracy * 100).toFixed(1), B: +(vB.metrics.accuracy * 100).toFixed(1) },
    { metric: 'Latency (ms)', A: +vA.metrics.latency.toFixed(1), B: +vB.metrics.latency.toFixed(1) },
    { metric: 'Throughput (req/s)', A: +vA.metrics.throughput.toFixed(1), B: +vB.metrics.throughput.toFixed(1) },
  ] : [];

  const CompareTab = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper sx={{ p: 3, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Select Two Versions to Compare</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 250 }}>
            <InputLabel>Version A</InputLabel>
            <Select value={compareA} label="Version A" onChange={e => setCompareA(e.target.value)}>
              {versions.map(v => (
                <MenuItem key={v.id} value={v.id}>{v.model_name} v{v.version}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 250 }}>
            <InputLabel>Version B</InputLabel>
            <Select value={compareB} label="Version B" onChange={e => setCompareB(e.target.value)}>
              {versions.map(v => (
                <MenuItem key={v.id} value={v.id}>{v.model_name} v{v.version}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {vA && vB ? (
        <>
          <Paper sx={{ p: 3, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Metrics Comparison</Typography>
            <Box sx={{ height: 320 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                  <XAxis dataKey="metric" tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                  <YAxis tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }}
                  />
                  <Legend />
                  <Bar dataKey="A" name={`${vA.model_name} v${vA.version}`} fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="B" name={`${vB.model_name} v${vB.version}`} fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>

          <Paper sx={{ p: 3, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Config Diff</Typography>
            <Box sx={{ display: 'flex', gap: 3 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                  {vA.model_name} v{vA.version}
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, fontFamily: 'monospace', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(vA.config, null, 2) || '{}'}
                </Paper>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                  {vB.model_name} v{vB.version}
                </Typography>
                <Paper variant="outlined" sx={{ p: 2, fontFamily: 'monospace', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(vB.config, null, 2) || '{}'}
                </Paper>
              </Box>
            </Box>
          </Paper>
        </>
      ) : (
        <Alert severity="info">Select two versions above to see a side-by-side comparison.</Alert>
      )}
    </Box>
  );

  // ── Tab: A/B Tests ──────────────────────────────────────────────────────

  const ABTestsTab = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Paper sx={{ p: 3, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <FlaskConical className="w-5 h-5" /> Launch A/B Test
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Version A</InputLabel>
            <Select value={abVersionA} label="Version A" onChange={e => setAbVersionA(e.target.value)}>
              {versions.filter(v => v.status !== 'archived').map(v => (
                <MenuItem key={v.id} value={v.id}>{v.model_name} v{v.version}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Version B</InputLabel>
            <Select value={abVersionB} label="Version B" onChange={e => setAbVersionB(e.target.value)}>
              {versions.filter(v => v.status !== 'archived').map(v => (
                <MenuItem key={v.id} value={v.id}>{v.model_name} v{v.version}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Box sx={{ px: 1, mb: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
            Traffic Split: {abSplit}% A / {100 - abSplit}% B
          </Typography>
          <Slider value={abSplit} onChange={(_, v) => setAbSplit(v as number)}
            min={10} max={90} step={5} valueLabelDisplay="auto"
            sx={{ maxWidth: 400 }} />
        </Box>
        <Button variant="contained" onClick={handleCreateABTest}
          disabled={!abVersionA || !abVersionB || abVersionA === abVersionB}
          startIcon={<Zap className="w-4 h-4" />}>
          Start A/B Test
        </Button>
      </Paper>

      {abtests.length === 0 ? (
        <Alert severity="info">No A/B tests yet. Launch one above to compare model versions.</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {abtests.map(t => {
            const total = t.results.version_a_wins + t.results.version_b_wins;
            const pctA = total > 0 ? ((t.results.version_a_wins / total) * 100).toFixed(1) : '0';
            const pctB = total > 0 ? ((t.results.version_b_wins / total) * 100).toFixed(1) : '0';
            const winner = t.status === 'completed'
              ? (t.results.version_a_wins > t.results.version_b_wins ? 'A' : 'B')
              : null;

            return (
              <Paper key={t.id} sx={{
                p: 2.5, borderRadius: 2, border: `1px solid ${theme.palette.divider}`,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {versionLabel(t.version_a)} vs {versionLabel(t.version_b)}
                  </Typography>
                  <StatusChip status={t.status} />
                  <Chip size="small" label={`${t.traffic_split}/${100 - t.traffic_split} split`} variant="outlined" />
                  {winner && (
                    <Chip size="small" color="success" icon={<CheckCircle className="w-3 h-3" />}
                      label={`Winner: ${winner === 'A' ? versionLabel(t.version_a) : versionLabel(t.version_b)}`} />
                  )}
                  {t.status === 'running' && (
                    <Button size="small" variant="outlined" color="error" onClick={() => handleStopABTest(t.id)}>
                      Stop
                    </Button>
                  )}
                </Box>
                <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Requests: <strong>{t.results.requests}</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    A wins: <strong>{t.results.version_a_wins}</strong> ({pctA}%)
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    B wins: <strong>{t.results.version_b_wins}</strong> ({pctB}%)
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Avg Latency A: <strong>{t.results.avg_latency_a.toFixed(1)}ms</strong>
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    Avg Latency B: <strong>{t.results.avg_latency_b.toFixed(1)}ms</strong>
                  </Typography>
                </Box>
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );

  // ── Tab: Stats ──────────────────────────────────────────────────────────

  const statusData = stats ? [
    { name: 'Draft', value: stats.versions_draft, color: '#94a3b8' },
    { name: 'Active', value: stats.versions_active, color: '#6366f1' },
    { name: 'Deployed', value: stats.versions_deployed, color: '#22c55e' },
    { name: 'Archived', value: stats.versions_archived, color: '#f59e0b' },
  ] : [];

  const StatsTab = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
        <StatCard icon={Layers} label="Total Versions" value={stats?.total_versions || 0} color="#6366f1" />
        <StatCard icon={CheckCircle} label="Active" value={stats?.versions_active || 0} color="#3b82f6" />
        <StatCard icon={Rocket} label="Deployed" value={stats?.versions_deployed || 0} color="#22c55e" />
        <StatCard icon={FlaskConical} label="A/B Tests" value={stats?.total_abtests || 0} color="#f59e0b" />
      </Box>

      <Paper sx={{ p: 3, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Version Status Breakdown</Typography>
        {statusData.every(d => d.value === 0) ? (
          <Alert severity="info">No version data to display yet.</Alert>
        ) : (
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis dataKey="name" tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                <YAxis tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} allowDecimals={false} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}` }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {statusData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        )}
      </Paper>
    </Box>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <GitBranch className="w-7 h-7" />
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Model Versioning</Typography>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Versions" />
        <Tab label="Compare" />
        <Tab label="A/B Tests" />
        <Tab label="Stats" />
      </Tabs>

      {tab === 0 && VersionsTab}
      {tab === 1 && CompareTab}
      {tab === 2 && ABTestsTab}
      {tab === 3 && StatsTab}

      <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.message}</Alert>
      </Snackbar>
    </Box>
  );
}
