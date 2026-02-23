'use client';

import React, { useState, useEffect } from 'react';
import { webhookAPI } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import LinkIcon from '@mui/icons-material/Link';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SendIcon from '@mui/icons-material/Send';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';

interface WebhookEndpoint {
  id: number;
  name: string;
  url: string;
  secret?: string;
  events: string;
  active: boolean;
  description: string;
  created_at: string;
}

interface WebhookDelivery {
  id: number;
  endpoint_id: number;
  event_type: string;
  status_code: number;
  success: boolean;
  latency_ms: number;
  attempt: number;
  error?: string;
  delivered_at: string;
}

interface EventDef {
  type: string;
  description: string;
}

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [availableEvents, setAvailableEvents] = useState<EventDef[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: '',
    url: '',
    secret: '',
    events: [] as string[],
    description: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [epRes, evtRes, statRes] = await Promise.all([
        webhookAPI.list(),
        webhookAPI.availableEvents(),
        webhookAPI.stats(),
      ]);
      if (epRes.data) setEndpoints(epRes.data.endpoints || []);
      if (evtRes.data) setAvailableEvents(evtRes.data.events || []);
      if (statRes.data) setStats(statRes.data);
    } catch (e) {
      console.error('Failed to fetch webhook data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await webhookAPI.create(form);
      setShowCreate(false);
      setForm({ name: '', url: '', secret: '', events: [], description: '' });
      fetchData();
    } catch (e) {
      alert('Failed to create webhook');
    }
  };

  const handleToggle = async (id: number, active: boolean) => {
    try {
      await webhookAPI.toggle(id, !active);
      fetchData();
    } catch (e) {
      alert('Failed to toggle webhook');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this webhook endpoint?')) return;
    try {
      await webhookAPI.delete(id);
      fetchData();
    } catch (e) {
      alert('Failed to delete webhook');
    }
  };

  const viewDeliveries = async (endpointId: number) => {
    setSelectedEndpoint(endpointId);
    try {
      const res = await webhookAPI.deliveries(endpointId, 50);
      if (res.data) setDeliveries(res.data.deliveries || []);
    } catch (e) {
      console.error('Failed to fetch deliveries:', e);
    }
  };

  const toggleEvent = (eventType: string) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(eventType)
        ? prev.events.filter((e) => e !== eventType)
        : [...prev.events, eventType],
    }));
  };

  if (loading) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <PageHeader
        title="Webhooks & Events"
        subtitle="Configure webhook endpoints and monitor event deliveries"
        action={
          <Button
            variant="contained"
            onClick={() => setShowCreate(true)}
            sx={{ textTransform: 'none', borderRadius: '8px' }}
          >
            + Create Webhook
          </Button>
        }
      />

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<LinkIcon fontSize="small" />}
              label="Endpoints"
              value={stats.total_endpoints || 0}
              color="blue"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<CheckCircleOutlineIcon fontSize="small" />}
              label="Active"
              value={stats.active_endpoints || 0}
              color="green"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<SendIcon fontSize="small" />}
              label="Deliveries"
              value={stats.total_deliveries || 0}
              color="purple"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<ErrorOutlineIcon fontSize="small" />}
              label="Failed"
              value={stats.failed_deliveries || 0}
              color="red"
            />
          </Grid>
        </Grid>
      )}

      {/* Endpoints List */}
      <Paper
        elevation={0}
        sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', mb: 3 }}
      >
        <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#111827' }}>
            Webhook Endpoints
          </Typography>
        </Box>

        {endpoints.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <Typography sx={{ color: '#6b7280' }}>
              No webhook endpoints configured. Create one to start receiving events!
            </Typography>
          </Box>
        ) : (
          <Box>
            {endpoints.map((ep, idx) => (
              <Box key={ep.id}>
                <Box
                  sx={{
                    p: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#111827' }}>
                        {ep.name}
                      </Typography>
                      <Chip
                        label={ep.active ? 'Active' : 'Inactive'}
                        size="small"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.7rem',
                          backgroundColor: ep.active ? '#dcfce7' : '#f3f4f6',
                          color: ep.active ? '#166534' : '#6b7280',
                        }}
                      />
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{ color: '#6b7280', mt: 0.5, fontFamily: 'monospace', fontSize: '0.8rem' }}
                    >
                      {ep.url}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
                      {ep.events.split(',').map((evt) => (
                        <Chip
                          key={evt}
                          label={evt.trim()}
                          size="small"
                          sx={{
                            fontSize: '0.7rem',
                            height: 22,
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button
                      size="small"
                      onClick={() => viewDeliveries(ep.id)}
                      sx={{ textTransform: 'none', fontWeight: 500 }}
                    >
                      Deliveries
                    </Button>
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => handleToggle(ep.id, ep.active)}
                      sx={{ textTransform: 'none', fontWeight: 500, color: '#6b7280' }}
                    >
                      {ep.active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      onClick={() => handleDelete(ep.id)}
                      sx={{ textTransform: 'none', fontWeight: 500 }}
                    >
                      Delete
                    </Button>
                  </Box>
                </Box>
                {idx < endpoints.length - 1 && <Divider />}
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      {/* Deliveries Panel */}
      {selectedEndpoint && (
        <Paper
          elevation={0}
          sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', mb: 3 }}
        >
          <Box
            sx={{
              p: 3,
              borderBottom: '1px solid #e5e7eb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#111827' }}>
              Recent Deliveries (Endpoint #{selectedEndpoint})
            </Typography>
            <IconButton onClick={() => setSelectedEndpoint(null)} size="small">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {deliveries.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography sx={{ color: '#6b7280' }}>No deliveries yet.</Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Time</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Event</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Latency</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Attempt</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#6b7280', fontSize: '0.75rem', textTransform: 'uppercase' }}>Error</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deliveries.map((d) => (
                    <TableRow key={d.id} hover>
                      <TableCell sx={{ fontSize: '0.875rem' }}>
                        {new Date(d.delivered_at).toLocaleString()}
                      </TableCell>
                      <TableCell sx={{ fontSize: '0.875rem' }}>{d.event_type}</TableCell>
                      <TableCell>
                        <Chip
                          label={d.success ? `${d.status_code} OK` : `${d.status_code || 'ERR'} Failed`}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            backgroundColor: d.success ? '#dcfce7' : '#fef2f2',
                            color: d.success ? '#166534' : '#991b1b',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ color: '#6b7280', fontSize: '0.875rem' }}>{d.latency_ms}ms</TableCell>
                      <TableCell sx={{ color: '#6b7280', fontSize: '0.875rem' }}>{d.attempt}/3</TableCell>
                      <TableCell
                        sx={{
                          color: '#dc2626',
                          fontSize: '0.875rem',
                          maxWidth: 200,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {d.error || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}

      {/* Create Modal */}
      <Dialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Create Webhook Endpoint</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField
              fullWidth
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="My Webhook"
              size="small"
            />

            <TextField
              fullWidth
              label="URL"
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://example.com/webhook"
              size="small"
              InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.875rem' } }}
            />

            <TextField
              fullWidth
              label="Secret (optional, for HMAC-SHA256 signing)"
              value={form.secret}
              onChange={(e) => setForm({ ...form, secret: e.target.value })}
              placeholder="whsec_..."
              size="small"
              InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.875rem' } }}
            />

            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, color: '#374151', mb: 1 }}>
                Events ({form.events.length} selected)
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  maxHeight: 240,
                  overflow: 'auto',
                  borderRadius: '8px',
                }}
              >
                <Grid container>
                  {availableEvents.map((evt) => (
                    <Grid size={{ xs: 6 }} key={evt.type}>
                      <Box
                        onClick={() => toggleEvent(evt.type)}
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1,
                          p: 1.5,
                          cursor: 'pointer',
                          borderRadius: '4px',
                          '&:hover': { backgroundColor: '#f9fafb' },
                        }}
                      >
                        <Checkbox
                          checked={form.events.includes(evt.type)}
                          onChange={() => toggleEvent(evt.type)}
                          size="small"
                          sx={{ mt: -0.5 }}
                        />
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 500, color: '#111827' }}>
                            {evt.type}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#6b7280' }}>
                            {evt.description}
                          </Typography>
                        </Box>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            </Box>

            <TextField
              fullWidth
              label="Description"
              multiline
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What this webhook is for..."
              size="small"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setShowCreate(false)}
            sx={{ textTransform: 'none', borderRadius: '8px' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!form.name || !form.url || form.events.length === 0}
            sx={{ textTransform: 'none', borderRadius: '8px' }}
          >
            Create Webhook
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
