'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsAPI } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import {
  Server, Cpu, Route, Database, Shield,
  Gauge, Layers, AlertCircle, RefreshCw, CheckCircle, XCircle,
  Loader2, Clock, Zap, HardDrive, Activity, ChevronDown,
} from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUptime(seconds: number): string {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function maskKey(key: string): string {
  if (!key) return 'Not configured';
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

function formatDuration(val: string | number): string {
  if (typeof val === 'number') return `${val}s`;
  return String(val || '-');
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function InfoItem({ label, value, children }: {
  label: string;
  value?: string | number;
  children?: React.ReactNode;
}) {
  return (
    <Box>
      <Typography sx={{ fontSize: '0.75rem', color: '#6b7280', mb: 0.25 }}>{label}</Typography>
      {children || (
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
          {String(value ?? '-')}
        </Typography>
      )}
    </Box>
  );
}

function FeatureBadge({ label, enabled }: { label: string; enabled?: boolean }) {
  return (
    <Chip
      icon={
        enabled
          ? <CheckCircle style={{ width: 12, height: 12 }} />
          : <XCircle style={{ width: 12, height: 12 }} />
      }
      label={label}
      size="small"
      sx={{
        backgroundColor: enabled ? '#ecfdf5' : '#f3f4f6',
        color: enabled ? '#15803d' : '#6b7280',
        fontWeight: 500,
        fontSize: '0.75rem',
        '& .MuiChip-icon': { color: 'inherit' },
      }}
    />
  );
}

function ProviderCard({ name, provider, providerKey, testing, testResult, onTest }: {
  name: string;
  provider: any;
  providerKey: string;
  testing: boolean;
  testResult: any;
  onTest: () => void;
}) {
  const configured = !!provider?.api_key;
  const models: string[] = provider?.models || provider?.supported_models || [];

  return (
    <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '10px', p: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: configured ? '#22c55e' : '#f87171',
          }} />
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{name}</Typography>
        </Box>
        <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: configured ? '#16a34a' : '#ef4444' }}>
          {configured ? 'Configured' : 'Not Configured'}
        </Typography>
      </Box>

      <Box sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: '0.75rem', color: '#6b7280', mb: 0.25 }}>API Key</Typography>
        <Typography sx={{ fontSize: '0.875rem', fontFamily: 'monospace', color: '#374151' }}>
          {maskKey(provider?.api_key)}
        </Typography>
      </Box>

      {models.length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <Typography sx={{ fontSize: '0.75rem', color: '#6b7280', mb: 0.75 }}>Supported Models</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {models.map((m: string) => (
              <Chip
                key={m}
                label={m}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      <Button
        variant="contained"
        size="small"
        onClick={onTest}
        disabled={testing || !configured}
        startIcon={
          testing
            ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
            : <Zap style={{ width: 14, height: 14 }} />
        }
        sx={{
          textTransform: 'none',
          borderRadius: '8px',
          fontSize: '0.75rem',
          mt: 0.5,
        }}
      >
        {testing ? 'Testing...' : 'Test Connection'}
      </Button>

      {testResult && (
        <Alert
          severity={testResult.success ? 'success' : 'error'}
          sx={{ mt: 1.5, borderRadius: '8px', fontSize: '0.75rem' }}
          icon={
            testResult.success
              ? <CheckCircle style={{ width: 16, height: 16 }} />
              : <XCircle style={{ width: 16, height: 16 }} />
          }
        >
          <Typography sx={{ fontWeight: 600, fontSize: '0.75rem', mb: 0.5 }}>
            {testResult.success ? 'Connection Successful' : 'Connection Failed'}
          </Typography>
          {testResult.success ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, fontSize: '0.7rem', color: '#4b5563' }}>
              {testResult.model && <Typography sx={{ fontSize: '0.7rem' }}>Model: <strong>{testResult.model}</strong></Typography>}
              {testResult.latency != null && <Typography sx={{ fontSize: '0.7rem' }}>Latency: <strong>{testResult.latency}ms</strong></Typography>}
              {testResult.status && <Typography sx={{ fontSize: '0.7rem' }}>Status: <strong>{testResult.status}</strong></Typography>}
              {testResult.tokens != null && <Typography sx={{ fontSize: '0.7rem' }}>Tokens: <strong>{testResult.tokens}</strong></Typography>}
              {testResult.response && (
                <Typography sx={{ fontSize: '0.7rem', fontStyle: 'italic', color: '#6b7280', mt: 0.5 }} title={testResult.response}>
                  &quot;{testResult.response}&quot;
                </Typography>
              )}
            </Box>
          ) : (
            <Typography sx={{ fontSize: '0.7rem', color: '#dc2626' }}>{testResult.error || 'Unknown error'}</Typography>
          )}
        </Alert>
      )}
    </Paper>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const r = await settingsAPI.getSettings();
      return r.data?.data;
    },
    refetchInterval: 30000,
  });

  // Routing strategy mutation
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [strategyMsg, setStrategyMsg] = useState('');

  const strategyMutation = useMutation({
    mutationFn: (strategy: string) => settingsAPI.updateRoutingStrategy(strategy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setStrategyMsg('Strategy updated successfully!');
      setTimeout(() => setStrategyMsg(''), 3000);
    },
    onError: () => {
      setStrategyMsg('Failed to update strategy.');
      setTimeout(() => setStrategyMsg(''), 3000);
    },
  });

  // Provider test state
  const [testResults, setTestResults] = useState<Record<string, any>>({});
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  const testProviderMutation = useMutation({
    mutationFn: (provider: string) => settingsAPI.testProvider(provider),
    onSuccess: (res, provider) => {
      setTestResults((prev) => ({ ...prev, [provider]: { ...res.data?.data, success: true } }));
      setTestingProvider(null);
    },
    onError: (err: any, provider) => {
      setTestResults((prev) => ({
        ...prev,
        [provider]: { success: false, error: err?.message || 'Connection failed' },
      }));
      setTestingProvider(null);
    },
  });

  const handleTestProvider = (provider: string) => {
    setTestingProvider(provider);
    setTestResults((prev) => ({ ...prev, [provider]: undefined }));
    testProviderMutation.mutate(provider);
  };

  // Set selected strategy from settings once loaded
  const currentStrategy = settings?.routing?.strategy || 'round-robin';
  const activeStrategy = selectedStrategy || currentStrategy;

  // Loading
  if (isLoading) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 }, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={40} />
          <Typography sx={{ mt: 2, color: '#6b7280' }}>Loading settings...</Typography>
        </Box>
      </Box>
    );
  }

  // Error
  if (error) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 }, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Alert
          severity="error"
          sx={{ maxWidth: 400, borderRadius: '12px' }}
          action={
            <Button
              size="small"
              onClick={() => refetch()}
              startIcon={<RefreshCw style={{ width: 14, height: 14 }} />}
              sx={{ textTransform: 'none' }}
            >
              Retry
            </Button>
          }
        >
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Connection Error</Typography>
          <Typography sx={{ fontSize: '0.85rem' }}>
            Failed to load settings. Make sure the backend is running.
          </Typography>
        </Alert>
      </Box>
    );
  }

  const sys = settings?.system || {};
  const srv = settings?.server || {};
  const providers = settings?.providers || {};
  const routing = settings?.routing || {};
  const workerPool = settings?.worker_pool || {};
  const cache = settings?.cache || {};
  const rateLimiting = settings?.rate_limiting || {};
  const backpressure = settings?.backpressure || {};
  const database = settings?.database || {};
  const redis = settings?.redis || {};

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <PageHeader title="Settings" subtitle="System configuration and preferences" />

      {/* System Information */}
      <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
          <Server style={{ width: 16, height: 16, color: '#2563eb' }} />
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
            System Information
          </Typography>
        </Box>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 6, md: 3 }}><InfoItem label="App Name" value={sys.app_name || 'VelocityLLM'} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><InfoItem label="Version" value={sys.version || '-'} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <InfoItem label="Environment">
              <Chip
                label={sys.environment || 'development'}
                size="small"
                sx={{
                  backgroundColor: sys.environment === 'production' ? '#ecfdf5' : '#fefce8',
                  color: sys.environment === 'production' ? '#15803d' : '#a16207',
                  fontWeight: 500,
                  fontSize: '0.75rem',
                }}
              />
            </InfoItem>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}><InfoItem label="Log Level" value={sys.log_level || '-'} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><InfoItem label="Host" value={srv.host || '-'} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><InfoItem label="Port" value={srv.port || '-'} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><InfoItem label="Read Timeout" value={formatDuration(srv.read_timeout)} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><InfoItem label="Write Timeout" value={formatDuration(srv.write_timeout)} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><InfoItem label="Idle Timeout" value={formatDuration(srv.idle_timeout)} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><InfoItem label="Uptime" value={formatUptime(sys.uptime_seconds || 0)} /></Grid>
        </Grid>
      </Paper>

      {/* LLM Providers */}
      <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
          <Cpu style={{ width: 16, height: 16, color: '#7c3aed' }} />
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
            LLM Providers
          </Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <ProviderCard
              name="OpenAI"
              provider={providers.openai}
              providerKey="openai"
              testing={testingProvider === 'openai'}
              testResult={testResults.openai}
              onTest={() => handleTestProvider('openai')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ProviderCard
              name="Anthropic"
              provider={providers.anthropic}
              providerKey="anthropic"
              testing={testingProvider === 'anthropic'}
              testResult={testResults.anthropic}
              onTest={() => handleTestProvider('anthropic')}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Routing Configuration */}
      <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
          <Route style={{ width: 16, height: 16, color: '#4f46e5' }} />
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
            Routing Configuration
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>Strategy</Typography>
          <Select
            size="small"
            value={activeStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value)}
            sx={{ minWidth: 160, borderRadius: '8px', fontSize: '0.875rem' }}
          >
            {['round-robin', 'least-cost', 'least-latency', 'best-quality', 'smart'].map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
          <Button
            variant="contained"
            size="small"
            onClick={() => strategyMutation.mutate(activeStrategy)}
            disabled={strategyMutation.isPending}
            startIcon={strategyMutation.isPending ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> : undefined}
            sx={{ textTransform: 'none', borderRadius: '8px' }}
          >
            Apply
          </Button>
          {strategyMsg && (
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: strategyMsg.includes('success') ? '#16a34a' : '#dc2626' }}>
              {strategyMsg}
            </Typography>
          )}
        </Box>
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 6, md: 2.4 }}><InfoItem label="Fallback Enabled" value={routing.fallback_enabled != null ? String(routing.fallback_enabled) : '-'} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><InfoItem label="Circuit Breaker" value={routing.circuit_breaker_enabled != null ? String(routing.circuit_breaker_enabled) : '-'} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><InfoItem label="Max Retries" value={routing.max_retries ?? '-'} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><InfoItem label="Retry Delay" value={formatDuration(routing.retry_delay)} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><InfoItem label="Health Check Interval" value={formatDuration(routing.health_check_interval)} /></Grid>
        </Grid>
      </Paper>

      {/* Worker Pool */}
      <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
          <Activity style={{ width: 16, height: 16, color: '#ea580c' }} />
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
            Worker Pool
          </Typography>
        </Box>
        <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
          <Grid size={{ xs: 6, md: 3 }}><InfoItem label="Min Workers" value={workerPool.min_workers ?? '-'} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><InfoItem label="Max Workers" value={workerPool.max_workers ?? '-'} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><InfoItem label="Queue Size" value={workerPool.queue_size ?? '-'} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><InfoItem label="Job Timeout" value={formatDuration(workerPool.job_timeout)} /></Grid>
        </Grid>

        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', mb: 1.5 }}>
          Scaling Thresholds
        </Typography>
        <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
          <Grid size={{ xs: 6, md: 4 }}><InfoItem label="Scale Up" value={`${workerPool.scale_up_threshold ?? 80}%`} /></Grid>
          <Grid size={{ xs: 6, md: 4 }}><InfoItem label="Scale Down" value={`${workerPool.scale_down_threshold ?? 20}%`} /></Grid>
          <Grid size={{ xs: 6, md: 4 }}><InfoItem label="Scale Interval" value={formatDuration(workerPool.scale_interval)} /></Grid>
        </Grid>

        {workerPool.status && (
          <>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', mb: 1.5 }}>
              Current Status
            </Typography>
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 6, md: 4 }}><InfoItem label="Active Workers" value={workerPool.status?.active_workers ?? '-'} /></Grid>
              <Grid size={{ xs: 6, md: 4 }}><InfoItem label="Busy Workers" value={workerPool.status?.busy_workers ?? '-'} /></Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Box>
                  <Typography sx={{ fontSize: '0.75rem', color: '#6b7280', mb: 0.5 }}>Queue Utilization</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <LinearProgress
                      variant="determinate"
                      value={Math.min(workerPool.status?.queue_utilization ?? 0, 100)}
                      sx={{
                        flex: 1,
                        height: 8,
                        borderRadius: '4px',
                        maxWidth: 120,
                        backgroundColor: '#f3f4f6',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: '4px',
                          backgroundColor:
                            (workerPool.status?.queue_utilization ?? 0) > 80 ? '#ef4444' :
                            (workerPool.status?.queue_utilization ?? 0) > 50 ? '#eab308' : '#22c55e',
                        },
                      }}
                    />
                    <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                      {workerPool.status?.queue_utilization ?? 0}%
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </>
        )}
      </Paper>

      {/* Cache Configuration */}
      <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
          <Layers style={{ width: 16, height: 16, color: '#0d9488' }} />
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
            Cache Configuration
          </Typography>
        </Box>
        <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
          <Grid size={{ xs: 6, md: 2.4 }}><InfoItem label="Default TTL" value={formatDuration(cache.default_ttl)} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><InfoItem label="L1 Max Size" value={cache.l1_max_size ?? '-'} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><InfoItem label="L1 Max Memory" value={cache.l1_max_memory || '-'} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><InfoItem label="L1 TTL" value={formatDuration(cache.l1_ttl)} /></Grid>
          <Grid size={{ xs: 6, md: 2.4 }}><InfoItem label="L2 TTL" value={formatDuration(cache.l2_ttl)} /></Grid>
        </Grid>

        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', mb: 1.5 }}>
          Features
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <FeatureBadge label="Multi-Level Cache" enabled={cache.multi_level} />
          <FeatureBadge label="Semantic Cache" enabled={cache.semantic_cache} />
          <FeatureBadge label="Write-Through" enabled={cache.write_through} />
        </Box>
        {cache.semantic_threshold != null && (
          <Typography sx={{ mt: 1.5, fontSize: '0.75rem', color: '#6b7280' }}>
            Semantic threshold: <Box component="span" sx={{ fontWeight: 600, color: '#374151' }}>{cache.semantic_threshold}</Box>
          </Typography>
        )}
      </Paper>

      {/* Rate Limiting */}
      <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
          <Gauge style={{ width: 16, height: 16, color: '#d97706' }} />
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
            Rate Limiting
          </Typography>
        </Box>
        <Grid container spacing={2.5} sx={{ mb: 2.5, maxWidth: 300 }}>
          <Grid size={{ xs: 6 }}><InfoItem label="Default RPM" value={rateLimiting.default_rpm ?? '-'} /></Grid>
          <Grid size={{ xs: 6 }}><InfoItem label="Burst Size" value={rateLimiting.default_burst ?? '-'} /></Grid>
        </Grid>

        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', mb: 1.5 }}>
          Tier Limits
        </Typography>
        {Object.keys(rateLimiting.tiers || {}).length === 0 ? (
          <Typography sx={{ fontSize: '0.875rem', color: '#9ca3af', fontStyle: 'italic' }}>
            No rate limiting tiers configured
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>Tier</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>RPM</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>Burst</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(rateLimiting.tiers || {}).map(([name, tier]: [string, any], i: number) => (
                  <TableRow key={name} sx={{ backgroundColor: i % 2 === 1 ? '#f9fafb' : 'transparent' }}>
                    <TableCell sx={{ fontWeight: 500, textTransform: 'capitalize', fontSize: '0.85rem', color: '#111827' }}>{name}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.85rem', color: '#374151' }}>{tier.rpm?.toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ fontSize: '0.85rem', color: '#374151' }}>{tier.burst?.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Backpressure & Load Shedding */}
      <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
          <Shield style={{ width: 16, height: 16, color: '#dc2626' }} />
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
            Backpressure & Load Shedding
          </Typography>
        </Box>
        <Grid container spacing={2.5} sx={{ mb: 2 }}>
          <Grid size={{ xs: 6, md: 3 }}><InfoItem label="Queue Threshold" value={backpressure.queue_threshold ?? '-'} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><InfoItem label="Reject Low Priority" value={backpressure.reject_low_priority != null ? String(backpressure.reject_low_priority) : '-'} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><InfoItem label="Adaptive Threshold" value={backpressure.adaptive_threshold != null ? String(backpressure.adaptive_threshold) : '-'} /></Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <InfoItem label="Status">
              <Chip
                label={backpressure.active ? 'Active' : 'Inactive'}
                size="small"
                sx={{
                  backgroundColor: backpressure.active ? '#fef2f2' : '#ecfdf5',
                  color: backpressure.active ? '#b91c1c' : '#15803d',
                  fontWeight: 500,
                  fontSize: '0.75rem',
                }}
              />
            </InfoItem>
          </Grid>
        </Grid>
        {backpressure.load_shedding && (
          <Box sx={{ mt: 1, p: 2, backgroundColor: '#f9fafb', borderRadius: '8px' }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', mb: 1 }}>
              Load Shedding Tiers
            </Typography>
            <Grid container spacing={1}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#facc15' }} />
                  <Typography sx={{ fontSize: '0.75rem', color: '#4b5563' }}>Warning: Shed low-priority traffic</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#f97316' }} />
                  <Typography sx={{ fontSize: '0.75rem', color: '#4b5563' }}>Critical: Shed medium-priority traffic</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#dc2626' }} />
                  <Typography sx={{ fontSize: '0.75rem', color: '#4b5563' }}>Emergency: Only high-priority allowed</Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>

      {/* Database & Redis */}
      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <Database style={{ width: 16, height: 16, color: '#2563eb' }} />
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>Database</Typography>
            </Box>
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 6 }}><InfoItem label="Host" value={database.host || '-'} /></Grid>
              <Grid size={{ xs: 6 }}><InfoItem label="Port" value={database.port ?? '-'} /></Grid>
              <Grid size={{ xs: 6 }}><InfoItem label="Database" value={database.database || database.name || '-'} /></Grid>
              <Grid size={{ xs: 6 }}><InfoItem label="SSL Mode" value={database.ssl_mode || '-'} /></Grid>
            </Grid>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <HardDrive style={{ width: 16, height: 16, color: '#dc2626' }} />
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>Redis</Typography>
            </Box>
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 6 }}><InfoItem label="Host" value={redis.host || '-'} /></Grid>
              <Grid size={{ xs: 6 }}><InfoItem label="Port" value={redis.port ?? '-'} /></Grid>
              <Grid size={{ xs: 6 }}><InfoItem label="DB Index" value={redis.db ?? '-'} /></Grid>
              <Grid size={{ xs: 6 }}><InfoItem label="Pool Size" value={redis.pool_size ?? '-'} /></Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
