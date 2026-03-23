'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import {
  Inbox, Send, RotateCcw, AlertTriangle, CheckCircle, Clock,
  Activity, Layers, Skull, RefreshCw, Play,
} from 'lucide-react';
import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Alert from '@mui/material/Alert';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';

const MONO = 'var(--font-mono), "JetBrains Mono", monospace';

const sectionLabelSx = {
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.2em',
  color: '#c1c6d7',
  fontFamily: MONO,
};

function useQueueStats() {
  return useQuery({
    queryKey: ['queue-stats'],
    queryFn: async () => {
      const res = await api.get('/api/v1/queues/stats');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useQueueList() {
  return useQuery({
    queryKey: ['queue-list'],
    queryFn: async () => {
      const res = await api.get('/api/v1/queues');
      return res.data?.data;
    },
    refetchInterval: 5000,
  });
}

function useDeadLetterQueue() {
  return useQuery({
    queryKey: ['queue-dlq'],
    queryFn: async () => {
      const res = await api.get('/api/v1/queues/dlq');
      return res.data?.data;
    },
    refetchInterval: 10000,
  });
}

export default function QueuesPage() {
  const { data: stats, isLoading } = useQueueStats();
  const { data: queues } = useQueueList();
  const { data: dlqData } = useDeadLetterQueue();
  const queryClient = useQueryClient();

  const [publishType, setPublishType] = useState('analytics.event');
  const [publishQueue, setPublishQueue] = useState('velocityllm:queue:default');
  const [publishPayload, setPublishPayload] = useState('{"event": "test"}');
  const [actionMsg, setActionMsg] = useState('');

  const publishMutation = useMutation({
    mutationFn: (data: any) => api.post('/api/v1/queues/publish', data),
    onSuccess: (res) => {
      setActionMsg(`Message published: ${res.data?.data?.id}`);
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
      queryClient.invalidateQueries({ queryKey: ['queue-list'] });
    },
    onError: () => setActionMsg('Failed to publish message'),
  });

  const replayMutation = useMutation({
    mutationFn: (streamId: string) => api.post('/api/v1/queues/dlq/replay', { stream_id: streamId }),
    onSuccess: () => {
      setActionMsg('Message replayed from DLQ');
      queryClient.invalidateQueries({ queryKey: ['queue-dlq'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress size={48} sx={{ color: '#adc6ff' }} />
        <Typography sx={{ mt: 2, color: 'text.secondary', fontSize: '0.875rem' }}>Loading queue metrics...</Typography>
      </Box>
    );
  }

  const retryPolicy = stats?.retry_policy || {};

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1400, mx: 'auto' }}>
      <PageHeader
        title="Message Queues"
        subtitle="Redis Streams broker with consumer groups, retries & dead letter queue"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <RefreshCw className="w-3 h-3 animate-spin" style={{ color: '#adc6ff' }} />
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Auto-refresh 5s</Typography>
          </Box>
        }
      />

      {actionMsg && (
        <Alert severity="success" onClose={() => setActionMsg('')} sx={{ mb: 2, borderRadius: '8px' }}>
          {actionMsg}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* ── OVERVIEW ── */}
        <Typography sx={sectionLabelSx}>Broker Overview</Typography>

        <Grid container spacing={2}>
          <Grid size={{ xs: 6, md: 2 }}>
            <KpiCard label="Published" value={(stats?.published || 0).toLocaleString()} color="#adc6ff" icon={<Send className="w-3.5 h-3.5" />} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <KpiCard label="Processed" value={(stats?.processed || 0).toLocaleString()} color="#53e16f" icon={<CheckCircle className="w-3.5 h-3.5" />} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <KpiCard label="Failed" value={(stats?.failed || 0).toLocaleString()} color="#ef4444" icon={<AlertTriangle className="w-3.5 h-3.5" />} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <KpiCard label="Retried" value={(stats?.retried || 0).toLocaleString()} color="#ffb595" icon={<RotateCcw className="w-3.5 h-3.5" />} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <KpiCard label="Dead Lettered" value={(stats?.dead_lettered || 0).toLocaleString()} color="#f472b6" icon={<Skull className="w-3.5 h-3.5" />} />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <KpiCard label="Avg Latency" value={`${(stats?.avg_latency_ms || 0).toFixed(1)}ms`} color="#06b6d4" icon={<Clock className="w-3.5 h-3.5" />} />
          </Grid>
        </Grid>

        {/* ── QUEUE DEPTHS ── */}
        <Typography sx={sectionLabelSx}>Queue Depths</Typography>

        <Grid container spacing={2}>
          {(queues || []).map((q: any) => (
            <Grid key={q.name} size={{ xs: 6, md: 4 }}>
              <Paper elevation={0} sx={{
                p: 2, borderRadius: '8px',
                boxShadow: q.label === 'Dead Letter' ? 'inset 3px 0 0 0 #f472b6' : 'inset 3px 0 0 0 #8b5cf6',
                transition: 'background-color 0.15s',
                '&:hover': { backgroundColor: '#2a2a2a' },
              }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {q.label === 'Dead Letter' ? (
                      <Skull className="w-4 h-4" style={{ color: '#f472b6' }} />
                    ) : (
                      <Inbox className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                    )}
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{q.label}</Typography>
                  </Box>
                  <Chip
                    label={q.depth || 0}
                    size="small"
                    sx={{
                      fontFamily: MONO, fontSize: '0.75rem', fontWeight: 700,
                      backgroundColor: q.depth > 0 ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.05)',
                      color: q.depth > 0 ? '#8b5cf6' : 'text.secondary',
                    }}
                  />
                </Box>
                <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', fontFamily: MONO, mt: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {q.name}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {/* ── RETRY POLICY & CONSUMER ── */}
        <Typography sx={sectionLabelSx}>Configuration</Typography>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, boxShadow: 'inset 3px 0 0 0 #ffb595' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <RotateCcw className="w-4 h-4" style={{ color: '#ffb595' }} />
                <Typography sx={sectionLabelSx}>Retry Policy</Typography>
              </Box>
              <MetricRow label="Max Retries" value={retryPolicy.max_retries || 5} />
              <MetricRow label="Initial Delay" value={retryPolicy.initial_delay || '1s'} />
              <MetricRow label="Max Delay" value={retryPolicy.max_delay || '30s'} />
              <MetricRow label="Backoff Factor" value={`${retryPolicy.backoff_factor || 2}x`} />
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, boxShadow: 'inset 3px 0 0 0 #06b6d4' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Activity className="w-4 h-4" style={{ color: '#06b6d4' }} />
                <Typography sx={sectionLabelSx}>Consumer</Typography>
              </Box>
              <MetricRow label="Consumer Group" value={stats?.consumer_group || 'N/A'} />
              <MetricRow label="Consumer Name" value={stats?.consumer_name || 'N/A'} />
              <MetricRow label="Worker Count" value={stats?.worker_count || 0} />
              <MetricRow label="Acknowledged" value={(stats?.acknowledged || 0).toLocaleString()} color="#53e16f" />
            </Paper>
          </Grid>
        </Grid>

        {/* ── PROCESSED BY TYPE ── */}
        {stats?.processed_by_type && Object.keys(stats.processed_by_type).length > 0 && (
          <>
            <Typography sx={sectionLabelSx}>Processed by Type</Typography>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Message Type</TableCell>
                    <TableCell align="right">Count</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(stats.processed_by_type).map(([type_, count]: [string, any]) => (
                    <TableRow key={type_} sx={{ '&:hover': { backgroundColor: 'rgba(32,31,31,0.3)' } }}>
                      <TableCell sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{type_}</TableCell>
                      <TableCell align="right" sx={{ fontFamily: MONO, fontSize: '0.75rem', color: '#53e16f' }}>{count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </>
        )}

        {/* ── DEAD LETTER QUEUE ── */}
        <Typography sx={sectionLabelSx}>Dead Letter Queue</Typography>

        {dlqData?.messages && dlqData.messages.length > 0 ? (
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Stream ID</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Attempts</TableCell>
                  <TableCell>Error</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dlqData.messages.map((msg: any) => (
                  <TableRow key={msg.stream_id} sx={{ '&:hover': { backgroundColor: 'rgba(32,31,31,0.3)' } }}>
                    <TableCell sx={{ fontFamily: MONO, fontSize: '0.7rem' }}>{msg.stream_id}</TableCell>
                    <TableCell sx={{ fontFamily: MONO, fontSize: '0.75rem' }}>{msg.type}</TableCell>
                    <TableCell sx={{ fontFamily: MONO, fontSize: '0.75rem', color: '#ef4444' }}>{msg.attempts}</TableCell>
                    <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {msg.error}
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Play className="w-3 h-3" />}
                        onClick={() => replayMutation.mutate(msg.stream_id)}
                        disabled={replayMutation.isPending}
                        sx={{ fontFamily: MONO, fontSize: '0.625rem', textTransform: 'uppercase' }}
                      >
                        Replay
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        ) : (
          <Paper elevation={0} sx={{ p: 3, borderRadius: '8px', textAlign: 'center' }}>
            <CheckCircle className="w-6 h-6" style={{ color: '#53e16f', margin: '0 auto 8px' }} />
            <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary' }}>Dead letter queue is empty</Typography>
          </Paper>
        )}

        {/* ── PUBLISH MESSAGE ── */}
        <Typography sx={sectionLabelSx}>Publish Message</Typography>

        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, boxShadow: 'inset 3px 0 0 0 #adc6ff' }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', mb: 0.5 }}>Queue</Typography>
              <Select
                size="small"
                value={publishQueue}
                onChange={(e) => setPublishQueue(e.target.value)}
                fullWidth
                sx={{ fontFamily: MONO, fontSize: '0.8125rem' }}
              >
                <MenuItem value="velocityllm:queue:default">Default</MenuItem>
                <MenuItem value="velocityllm:queue:completions">Completions</MenuItem>
                <MenuItem value="velocityllm:queue:webhooks">Webhooks</MenuItem>
                <MenuItem value="velocityllm:queue:notifications">Notifications</MenuItem>
                <MenuItem value="velocityllm:queue:analytics">Analytics</MenuItem>
              </Select>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', mb: 0.5 }}>Message Type</Typography>
              <TextField
                size="small"
                value={publishType}
                onChange={(e) => setPublishType(e.target.value)}
                fullWidth
                sx={{ '& input': { fontFamily: MONO, fontSize: '0.8125rem' } }}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', mb: 0.5 }}>Payload (JSON)</Typography>
              <TextField
                size="small"
                value={publishPayload}
                onChange={(e) => setPublishPayload(e.target.value)}
                fullWidth
                sx={{ '& input': { fontFamily: MONO, fontSize: '0.8125rem' } }}
              />
            </Grid>
          </Grid>
          <Box sx={{ mt: 2 }}>
            <Button
              variant="outlined"
              size="small"
              disabled={publishMutation.isPending}
              startIcon={publishMutation.isPending ? <CircularProgress size={14} /> : <Send className="w-3.5 h-3.5" />}
              onClick={() => {
                try {
                  const payload = JSON.parse(publishPayload);
                  publishMutation.mutate({ queue: publishQueue, type: publishType, payload });
                } catch {
                  setActionMsg('Invalid JSON payload');
                }
              }}
              sx={{ fontFamily: MONO, textTransform: 'uppercase', fontSize: '0.6875rem', letterSpacing: '0.1em' }}
            >
              Publish
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

function MetricRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5, borderBottom: '1px solid', borderColor: 'divider' }}>
      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.8125rem', fontFamily: MONO, color: color || 'text.primary' }}>{value}</Typography>
    </Box>
  );
}
