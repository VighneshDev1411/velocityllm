'use client';

import React, { useState, useEffect } from 'react';
import api, { loadTestAPI } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import SpeedIcon from '@mui/icons-material/Speed';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TimerIcon from '@mui/icons-material/Timer';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

interface LoadTestConfig {
  id: number;
  name: string;
  pattern: string;
  target_rps: number;
  duration: number;
  concurrency: number;
  model: string;
  created_at: string;
}

interface LoadTestRun {
  id: number;
  config_id: number;
  status: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  actual_rps: number;
  config?: LoadTestConfig;
}

interface TestMetric {
  timestamp: string;
  elapsed_seconds: number;
  current_rps: number;
  completed_requests: number;
  failed_requests: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  error_rate: number;
}

export default function LoadTestPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [configs, setConfigs] = useState<LoadTestConfig[]>([]);
  const [runs, setRuns] = useState<LoadTestRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<LoadTestRun | null>(null);
  const [metrics, setMetrics] = useState<TestMetric[]>([]);
  const [loading, setLoading] = useState(false);

  // Quick benchmark form
  const [quickRPS, setQuickRPS] = useState(100);
  const [quickModel, setQuickModel] = useState('gpt-4');

  // Create config form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newConfig, setNewConfig] = useState({
    name: '',
    pattern: 'constant',
    target_rps: 100,
    duration: 60,
    concurrency: 50,
    model: 'gpt-4',
    prompt: 'Hello, this is a load test. Please respond briefly.',
    max_tokens: 50,
    enable_cache: true,
  });

  const [availableModels, setAvailableModels] = useState<{ name: string; id: string }[]>([]);

  useEffect(() => {
    fetchConfigs();
    fetchRuns();
    api.get('/api/v1/models').then((res) => {
      setAvailableModels(res.data?.data || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedRun && selectedRun.status === 'running') {
      const interval = setInterval(() => {
        fetchRunDetails(selectedRun.id);
        fetchMetrics(selectedRun.id);
      }, 2000); // Poll every 2 seconds

      return () => clearInterval(interval);
    }
  }, [selectedRun]);

  const fetchConfigs = async () => {
    try {
      const response = await loadTestAPI.listConfigs(50);
      if (response.data) {
        setConfigs(response.data.configs || []);
      }
    } catch (error) {
      console.error('Failed to fetch configs:', error);
    }
  };

  const fetchRuns = async () => {
    try {
      const response = await loadTestAPI.listRuns(20);
      if (response.data) {
        setRuns(response.data.runs || []);
      }
    } catch (error) {
      console.error('Failed to fetch runs:', error);
    }
  };

  const fetchRunDetails = async (runId: number) => {
    try {
      const response = await loadTestAPI.getRun(runId);
      if (response.data) {
        setSelectedRun(response.data.run);
      }
    } catch (error) {
      console.error('Failed to fetch run details:', error);
    }
  };

  const fetchMetrics = async (runId: number) => {
    try {
      const response = await loadTestAPI.getMetrics(runId);
      if (response.data) {
        setMetrics(response.data.metrics || []);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  const handleQuickBenchmark = async () => {
    try {
      setLoading(true);
      const response = await loadTestAPI.quickBenchmark(quickRPS, quickModel);
      if (response.data) {
        alert('Quick benchmark started!');
        setSelectedRun(response.data.run);
        setActiveTab(2);
        fetchRuns();
      }
    } catch (error) {
      console.error('Failed to start quick benchmark:', error);
      alert('Failed to start benchmark');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateConfig = async () => {
    try {
      setLoading(true);
      await loadTestAPI.createConfig(newConfig);
      alert('Load test configuration created!');
      setShowCreateModal(false);
      fetchConfigs();
      setNewConfig({
        name: '',
        pattern: 'constant',
        target_rps: 100,
        duration: 60,
        concurrency: 50,
        model: 'gpt-4',
        prompt: 'Hello, this is a load test. Please respond briefly.',
        max_tokens: 50,
        enable_cache: true,
      });
    } catch (error) {
      console.error('Failed to create config:', error);
      alert('Failed to create configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTest = async (configId: number) => {
    try {
      setLoading(true);
      const response = await loadTestAPI.startTest(configId);
      if (response.data) {
        alert('Load test started!');
        setSelectedRun(response.data.run);
        setActiveTab(2);
        fetchRuns();
      }
    } catch (error) {
      console.error('Failed to start test:', error);
      alert('Failed to start load test');
    } finally {
      setLoading(false);
    }
  };

  const handleStopTest = async (runId: number) => {
    try {
      await loadTestAPI.stopTest(runId);
      alert('Load test stopped!');
      fetchRuns();
    } catch (error) {
      console.error('Failed to stop test:', error);
      alert('Failed to stop load test');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStatusChip = (status: string) => {
    const colorMap: Record<string, { bg: string; fg: string }> = {
      queued: { bg: 'action.hover', fg: 'text.primary' },
      running: { bg: 'rgba(173,198,255,0.1)', fg: '#adc6ff' },
      completed: { bg: 'rgba(83,225,111,0.1)', fg: '#53e16f' },
      failed: { bg: 'rgba(239,68,68,0.1)', fg: '#ef4444' },
      cancelled: { bg: 'rgba(255,181,149,0.1)', fg: '#ffb595' },
    };
    const colors = colorMap[status] || colorMap.queued;
    return (
      <Chip
        label={status}
        size="small"
        sx={{
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'capitalize',
          backgroundColor: colors.bg,
          color: colors.fg,
        }}
      />
    );
  };

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <PageHeader title="Load Testing & Benchmarks" subtitle="Run performance benchmarks and load tests against your LLM gateway" />

      {/* Tabs */}
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', mb: 3 }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            px: 2,
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 500, minHeight: 48 },
          }}
        >
          <Tab label="Quick Benchmark" />
          <Tab label={`Configurations (${configs.length})`} />
          <Tab label={`Test Runs (${runs.length})`} />
        </Tabs>
      </Paper>

      {/* Quick Benchmark Tab */}
      {activeTab === 0 && (
        <Paper
          elevation={0}
          sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}
        >
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 1 }}>
            Quick 30-Second Benchmark
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
            Run a fast benchmark to test your system's performance under constant load.
          </Typography>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Target RPS (Requests Per Second)"
                type="number"
                value={quickRPS}
                onChange={(e) => setQuickRPS(parseInt(e.target.value))}
                inputProps={{ min: 1, max: 10000 }}
                helperText="Recommended: 100-500 for initial tests"
                size="small"
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Model</InputLabel>
                <Select
                  value={quickModel}
                  label="Model"
                  onChange={(e) => setQuickModel(e.target.value)}
                >
                  {availableModels.map((m) => (
                    <MenuItem key={m.id} value={m.name}>{m.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Button
            variant="contained"
            onClick={handleQuickBenchmark}
            disabled={loading}
            sx={{ textTransform: 'none', borderRadius: '8px', px: 4, py: 1.25 }}
          >
            {loading ? 'Starting...' : 'Start Quick Benchmark'}
          </Button>

          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              What gets tested:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              <li>Duration: 30 seconds</li>
              <li>Pattern: Constant load</li>
              <li>Concurrency: 50 workers</li>
              <li>Metrics: Latency (P50/P95/P99), RPS, Error Rate</li>
            </Box>
          </Alert>
        </Paper>
      )}

      {/* Configurations Tab */}
      {activeTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
              Load Test Configurations
            </Typography>
            <Button
              variant="contained"
              onClick={() => setShowCreateModal(true)}
              sx={{ textTransform: 'none', borderRadius: '8px' }}
            >
              + Create Configuration
            </Button>
          </Box>

          {configs.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                border: '1px solid', borderColor: 'divider',
                borderRadius: '8px',
                p: 6,
                textAlign: 'center',
              }}
            >
              <Typography sx={{ color: 'text.secondary' }}>
                No configurations yet. Create one to get started!
              </Typography>
            </Paper>
          ) : (
            <Grid container spacing={3}>
              {configs.map((config) => (
                <Grid size={{ xs: 12, md: 6 }} key={config.id}>
                  <Paper
                    elevation={0}
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
                          {config.name}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Created {new Date(config.created_at).toLocaleDateString()}
                        </Typography>
                      </Box>
                      <Chip
                        label={config.pattern}
                        size="small"
                        sx={{
                          textTransform: 'capitalize',
                          backgroundColor: 'action.hover',
                          color: 'text.primary',
                          fontWeight: 500,
                          fontSize: '0.75rem',
                        }}
                      />
                    </Box>

                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Target RPS</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>{config.target_rps}</Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Duration</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>{config.duration}s</Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Concurrency</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>{config.concurrency}</Typography>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>Model</Typography>
                        <Typography variant="body1" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {config.model}
                        </Typography>
                      </Grid>
                    </Grid>

                    <Button
                      variant="contained"
                      color="success"
                      fullWidth
                      onClick={() => handleStartTest(config.id)}
                      disabled={loading}
                      sx={{ textTransform: 'none', borderRadius: '8px' }}
                    >
                      Start Test
                    </Button>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* Test Runs Tab */}
      {activeTab === 2 && (
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 3 }}>
            Test Runs
          </Typography>

          {runs.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                border: '1px solid', borderColor: 'divider',
                borderRadius: '8px',
                p: 6,
                textAlign: 'center',
              }}
            >
              <Typography sx={{ color: 'text.secondary' }}>
                No test runs yet. Start a benchmark to see results!
              </Typography>
            </Paper>
          ) : (
            <Paper
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', overflow: 'hidden' }}
            >
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase' }}>ID</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase' }}>Config</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase' }}>Requests</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase' }}>Avg Latency</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase' }}>P95</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase' }}>RPS</TableCell>
                      <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase' }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {runs.map((run) => (
                      <TableRow key={run.id} hover>
                        <TableCell sx={{ fontWeight: 500, fontSize: '0.875rem' }}>#{run.id}</TableCell>
                        <TableCell sx={{ fontSize: '0.875rem' }}>
                          {run.config?.name || `Config #${run.config_id}`}
                        </TableCell>
                        <TableCell>{getStatusChip(run.status)}</TableCell>
                        <TableCell sx={{ fontSize: '0.875rem' }}>
                          {run.total_requests.toLocaleString()}
                          <Typography component="span" sx={{ color: 'text.secondary', ml: 0.5, fontSize: '0.875rem' }}>
                            ({run.failed_requests > 0 ? `${run.failed_requests} failed` : 'all ok'})
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.875rem' }}>
                          {run.avg_latency_ms?.toFixed(2) || 'N/A'} ms
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.875rem' }}>
                          {run.p95_latency_ms?.toFixed(2) || 'N/A'} ms
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.875rem' }}>
                          {run.actual_rps?.toFixed(2) || 'N/A'}
                        </TableCell>
                        <TableCell>
                          {run.status === 'running' ? (
                            <Button
                              size="small"
                              color="error"
                              onClick={() => handleStopTest(run.id)}
                              sx={{ textTransform: 'none', fontWeight: 500 }}
                            >
                              Stop
                            </Button>
                          ) : (
                            <Button
                              size="small"
                              onClick={() => {
                                setSelectedRun(run);
                                fetchMetrics(run.id);
                              }}
                              sx={{ textTransform: 'none', fontWeight: 500 }}
                            >
                              View Details
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}

          {/* Selected Run Details */}
          {selectedRun && (
            <Paper
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, mt: 3 }}
            >
              <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary', mb: 3 }}>
                Test Run #{selectedRun.id} Details
              </Typography>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid size={{ xs: 6, md: 3 }}>
                  <StatCard
                    icon={<SpeedIcon fontSize="small" />}
                    label="Total Requests"
                    value={selectedRun.total_requests.toLocaleString()}
                    color="blue"
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <StatCard
                    icon={<CheckCircleIcon fontSize="small" />}
                    label="Success Rate"
                    value={`${((selectedRun.successful_requests / selectedRun.total_requests) * 100).toFixed(1)}%`}
                    color="green"
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <StatCard
                    icon={<TimerIcon fontSize="small" />}
                    label="Avg Latency"
                    value={`${selectedRun.avg_latency_ms?.toFixed(2)} ms`}
                    color="purple"
                  />
                </Grid>
                <Grid size={{ xs: 6, md: 3 }}>
                  <StatCard
                    icon={<TrendingUpIcon fontSize="small" />}
                    label="Actual RPS"
                    value={selectedRun.actual_rps?.toFixed(2) || 'N/A'}
                    color="orange"
                  />
                </Grid>
              </Grid>

              {metrics.length > 0 && (
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary', mb: 2 }}>
                    Real-Time Metrics
                  </Typography>
                  <Paper
                    elevation={0}
                    sx={{
                      border: '1px solid', borderColor: 'divider',
                      borderRadius: '8px',
                      p: 2,
                      maxHeight: 384,
                      overflow: 'auto',
                      backgroundColor: 'background.default',
                    }}
                  >
                    {metrics.map((metric, index) => (
                      <Box
                        key={index}
                        sx={{
                          borderBottom: '1px solid', borderColor: 'divider',
                          py: 1,
                          '&:last-child': { borderBottom: 'none' },
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          T+{metric.elapsed_seconds}s
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          RPS: {metric.current_rps.toFixed(2)} | Latency: {metric.avg_latency_ms.toFixed(2)}ms |
                          Errors: {metric.error_rate.toFixed(1)}%
                        </Typography>
                      </Box>
                    ))}
                  </Paper>
                </Box>
              )}
            </Paper>
          )}
        </Box>
      )}

      {/* Create Config Modal */}
      <Dialog
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Create Load Test Configuration</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField
              fullWidth
              label="Name"
              value={newConfig.name}
              onChange={(e) => setNewConfig({ ...newConfig, name: e.target.value })}
              placeholder="My Load Test"
              size="small"
            />

            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Pattern</InputLabel>
                  <Select
                    value={newConfig.pattern}
                    label="Pattern"
                    onChange={(e) => setNewConfig({ ...newConfig, pattern: e.target.value })}
                  >
                    <MenuItem value="constant">Constant</MenuItem>
                    <MenuItem value="rampup">Ramp Up</MenuItem>
                    <MenuItem value="spike">Spike</MenuItem>
                    <MenuItem value="wave">Wave</MenuItem>
                    <MenuItem value="burst">Burst</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Model</InputLabel>
                  <Select
                    value={newConfig.model}
                    label="Model"
                    onChange={(e) => setNewConfig({ ...newConfig, model: e.target.value })}
                  >
                    {availableModels.map((m) => (
                      <MenuItem key={m.id} value={m.name}>{m.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 4 }}>
                <TextField
                  fullWidth
                  label="Target RPS"
                  type="number"
                  value={newConfig.target_rps}
                  onChange={(e) => setNewConfig({ ...newConfig, target_rps: parseInt(e.target.value) })}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 4 }}>
                <TextField
                  fullWidth
                  label="Duration (s)"
                  type="number"
                  value={newConfig.duration}
                  onChange={(e) => setNewConfig({ ...newConfig, duration: parseInt(e.target.value) })}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 4 }}>
                <TextField
                  fullWidth
                  label="Concurrency"
                  type="number"
                  value={newConfig.concurrency}
                  onChange={(e) => setNewConfig({ ...newConfig, concurrency: parseInt(e.target.value) })}
                  size="small"
                />
              </Grid>
            </Grid>

            <TextField
              fullWidth
              label="Test Prompt"
              multiline
              rows={3}
              value={newConfig.prompt}
              onChange={(e) => setNewConfig({ ...newConfig, prompt: e.target.value })}
              size="small"
            />

            <FormControlLabel
              control={
                <Switch
                  checked={newConfig.enable_cache}
                  onChange={(e) => setNewConfig({ ...newConfig, enable_cache: e.target.checked })}
                  size="small"
                />
              }
              label={<Typography variant="body2">Enable caching</Typography>}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setShowCreateModal(false)}
            sx={{ textTransform: 'none', borderRadius: '8px' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateConfig}
            disabled={loading || !newConfig.name}
            sx={{ textTransform: 'none', borderRadius: '8px' }}
          >
            Create Configuration
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
