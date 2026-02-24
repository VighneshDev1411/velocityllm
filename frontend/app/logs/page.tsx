'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { logsAPI } from '@/lib/api';
import {
  Search, RefreshCw, Download, ChevronDown, ChevronRight,
  Activity, Shield, Zap, Webhook, AlertCircle, CheckCircle,
  Clock, Database, Terminal, Filter
} from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tooltip from '@mui/material/Tooltip';
import Collapse from '@mui/material/Collapse';
import { PageHeader } from '@/components/PageHeader';

/* ─────────────────── Types ─────────────────── */
interface RequestLog {
  id: string;
  timestamp: string;
  model: string;
  provider: string;
  prompt: string;
  latency: number;
  cost: number;
  tokens: number;
  status: string;
  cache_hit: boolean;
}

interface ActivityLog {
  id: string;
  user_id: string;
  username: string;
  action: string;
  details: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

interface EventLog {
  id: number;
  user_id: number;
  event_type: string;
  source: string;
  payload: string;
  metadata: string;
  created_at: string;
}

interface WebhookEndpoint {
  id: number;
  name: string;
  url: string;
  active: boolean;
}

interface WebhookDelivery {
  id: number;
  endpoint_id: number;
  event_type: string;
  status_code: number;
  success: boolean;
  latency_ms: number;
  attempt: number;
  error: string;
  delivered_at: string;
}

/* ─────────────────── Helpers ─────────────────── */
const thSx = {
  fontWeight: 600,
  color: '#6b7280',
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  py: 1.5,
} as const;

const fmtTime = (s: string) =>
  s ? new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--';

const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`);

function StatusChip({ status }: { status: string }) {
  const s = status?.toLowerCase();
  const map: Record<string, { bg: string; color: string; label: string }> = {
    success: { bg: '#ecfdf5', color: '#059669', label: 'Success' },
    completed: { bg: '#ecfdf5', color: '#059669', label: 'Completed' },
    failed: { bg: '#fef2f2', color: '#dc2626', label: 'Failed' },
    error: { bg: '#fef2f2', color: '#dc2626', label: 'Error' },
    pending: { bg: '#fffbeb', color: '#d97706', label: 'Pending' },
    warning: { bg: '#fffbeb', color: '#d97706', label: 'Warning' },
  };
  const style = map[s] ?? { bg: '#f3f4f6', color: '#6b7280', label: status };
  return (
    <Chip
      label={style.label}
      size="small"
      sx={{ bgcolor: style.bg, color: style.color, fontWeight: 600, fontSize: '0.7rem', height: 22 }}
    />
  );
}

function ExpandableRow({ children, detail }: { children: React.ReactNode; detail: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow
        hover
        onClick={() => setOpen(!open)}
        sx={{ cursor: 'pointer', '& td': { borderBottom: open ? 0 : undefined } }}
      >
        <TableCell sx={{ width: 24, pr: 0, py: 1 }}>
          {open ? <ChevronDown size={14} color="#9ca3af" /> : <ChevronRight size={14} color="#9ca3af" />}
        </TableCell>
        {children}
      </TableRow>
      <TableRow>
        <TableCell colSpan={99} sx={{ py: 0, bgcolor: '#f9fafb' }}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2 }}>{detail}</Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="caption" sx={{ color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, fontSize: '0.65rem' }}>
        {label}
      </Typography>
      <Box
        component="pre"
        sx={{
          mt: 0.25, p: 1, bgcolor: '#111827', color: '#e5e7eb', borderRadius: '6px',
          fontSize: '0.75rem', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', m: 0,
        }}
      >
        {value || '—'}
      </Box>
    </Box>
  );
}

/* ─────────────────── Main Page ─────────────────── */
export default function LogsPage() {
  const [tab, setTab] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Request Logs state
  const [requestLogs, setRequestLogs] = useState<RequestLog[]>([]);
  const [reqModel, setReqModel] = useState('');
  const [reqStatus, setReqStatus] = useState('');
  const [reqSearch, setReqSearch] = useState('');

  // Activity Logs state
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [actSearch, setActSearch] = useState('');

  // Event Logs state
  const [eventLogs, setEventLogs] = useState<EventLog[]>([]);
  const [evtType, setEvtType] = useState('');

  // Webhook Deliveries state
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [selectedWebhook, setSelectedWebhook] = useState<number | ''>('');
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);

  /* ─── Fetch functions ─── */
  const fetchRequestLogs = useCallback(async () => {
    try {
      const res = await logsAPI.getRequestLogs({ model: reqModel || undefined, status: reqStatus || undefined, limit: 100 });
      const logs = res.data?.data?.logs || res.data?.data || [];
      setRequestLogs(Array.isArray(logs) ? logs : []);
    } catch { setRequestLogs([]); }
  }, [reqModel, reqStatus]);

  const fetchActivityLogs = useCallback(async () => {
    try {
      const res = await logsAPI.getActivityLogs({ limit: 100 });
      const logs = res.data?.data?.logs || res.data?.data || [];
      setActivityLogs(Array.isArray(logs) ? logs : []);
    } catch { setActivityLogs([]); }
  }, []);

  const fetchEventLogs = useCallback(async () => {
    try {
      const res = await logsAPI.getEventLogs(100);
      const logs = res.data?.data?.logs || res.data?.data || [];
      setEventLogs(Array.isArray(logs) ? logs : []);
    } catch { setEventLogs([]); }
  }, []);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await logsAPI.listWebhooks();
      const list = res.data?.data?.endpoints || res.data?.data || [];
      setWebhooks(Array.isArray(list) ? list : []);
    } catch { setWebhooks([]); }
  }, []);

  const fetchDeliveries = useCallback(async (endpointId: number) => {
    try {
      const res = await logsAPI.getWebhookDeliveries(endpointId, 100);
      const list = res.data?.data?.deliveries || res.data?.data || [];
      setDeliveries(Array.isArray(list) ? list : []);
    } catch { setDeliveries([]); }
  }, []);

  /* ─── Tab-based fetch ─── */
  const fetchCurrentTab = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (tab === 0) await fetchRequestLogs();
      if (tab === 1) await fetchActivityLogs();
      if (tab === 2) await fetchEventLogs();
      if (tab === 3) {
        await fetchWebhooks();
        if (selectedWebhook) await fetchDeliveries(selectedWebhook as number);
      }
    } catch {
      setError('Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [tab, fetchRequestLogs, fetchActivityLogs, fetchEventLogs, fetchWebhooks, fetchDeliveries, selectedWebhook]);

  useEffect(() => { fetchCurrentTab(); }, [tab, reqModel, reqStatus]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchCurrentTab, 10000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchCurrentTab]);

  useEffect(() => {
    if (tab === 3 && selectedWebhook) fetchDeliveries(selectedWebhook as number);
  }, [selectedWebhook, tab, fetchDeliveries]);

  /* ─── Export ─── */
  const handleExport = () => {
    const dataMap: Record<number, unknown[]> = {
      0: requestLogs,
      1: activityLogs,
      2: eventLogs,
      3: deliveries,
    };
    const data = dataMap[tab] || [];
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-tab${tab}-${Date.now()}.json`;
    a.click();
  };

  /* ─── Filtered views ─── */
  const filteredRequests = requestLogs.filter(r =>
    (!reqSearch || r.model?.toLowerCase().includes(reqSearch.toLowerCase()) || r.prompt?.toLowerCase().includes(reqSearch.toLowerCase()))
  );

  const filteredActivity = activityLogs.filter(r =>
    (!actSearch || r.username?.toLowerCase().includes(actSearch.toLowerCase()) || r.action?.toLowerCase().includes(actSearch.toLowerCase()))
  );

  const filteredEvents = eventLogs.filter(r =>
    (!evtType || r.event_type === evtType)
  );

  const uniqueEventTypes = [...new Set(eventLogs.map(e => e.event_type))];
  const uniqueModels = [...new Set(requestLogs.map(r => r.model).filter(Boolean))];

  /* ─── Render ─── */
  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: '1400px', mx: 'auto' }}>
      <PageHeader
        title="Logs & Debugging"
        subtitle="Request history, activity audit trail, system events, and webhook deliveries"
      />

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2, borderRadius: '10px' }}>
          {error}
        </Alert>
      )}

      <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
        {/* Toolbar */}
        <Box sx={{ px: 2, pt: 1.5, pb: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            sx={{
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.85rem', minHeight: 44, py: 1 },
              '& .MuiTabs-indicator': { height: 2 },
            }}
          >
            <Tab label="Request Logs" icon={<Terminal size={15} />} iconPosition="start" />
            <Tab label="Activity Logs" icon={<Shield size={15} />} iconPosition="start" />
            <Tab label="Event Logs" icon={<Zap size={15} />} iconPosition="start" />
            <Tab label="Webhook Deliveries" icon={<Webhook size={15} />} iconPosition="start" />
          </Tabs>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControlLabel
              control={<Switch checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} size="small" />}
              label={<Typography variant="caption" sx={{ color: '#6b7280' }}>Auto-refresh (10s)</Typography>}
              sx={{ mr: 0 }}
            />
            <Tooltip title="Refresh now">
              <IconButton size="small" onClick={fetchCurrentTab} disabled={loading} sx={{ color: '#6b7280' }}>
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Export as JSON">
              <IconButton size="small" onClick={handleExport} sx={{ color: '#6b7280' }}>
                <Download size={16} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* ─── Tab 0: Request Logs ─── */}
        {tab === 0 && (
          <>
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <TextField
                size="small"
                placeholder="Search prompt or model…"
                value={reqSearch}
                onChange={e => setReqSearch(e.target.value)}
                InputProps={{ startAdornment: <Search size={14} style={{ marginRight: 6, color: '#9ca3af' }} /> }}
                sx={{ width: 260, '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.85rem' } }}
              />
              <Select
                size="small"
                value={reqModel}
                onChange={e => setReqModel(e.target.value)}
                displayEmpty
                sx={{ minWidth: 160, borderRadius: '8px', fontSize: '0.85rem' }}
              >
                <MenuItem value="">All Models</MenuItem>
                {uniqueModels.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </Select>
              <Select
                size="small"
                value={reqStatus}
                onChange={e => setReqStatus(e.target.value)}
                displayEmpty
                sx={{ minWidth: 130, borderRadius: '8px', fontSize: '0.85rem' }}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="success">Success</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
              </Select>
              <Typography variant="caption" sx={{ color: '#9ca3af', alignSelf: 'center', ml: 1 }}>
                {filteredRequests.length} entries
              </Typography>
            </Box>

            {loading ? (
              <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={28} /></Box>
            ) : filteredRequests.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Terminal size={40} color="#d1d5db" />
                <Typography sx={{ color: '#9ca3af', mt: 1 }}>No request logs found</Typography>
                <Typography variant="caption" sx={{ color: '#d1d5db' }}>Logs appear here after API calls are made</Typography>
              </Box>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f9fafb' }}>
                      <TableCell sx={{ width: 24 }} />
                      <TableCell sx={thSx}>Timestamp</TableCell>
                      <TableCell sx={thSx}>Model</TableCell>
                      <TableCell sx={thSx}>Status</TableCell>
                      <TableCell align="right" sx={thSx}>Latency</TableCell>
                      <TableCell align="right" sx={thSx}>Tokens</TableCell>
                      <TableCell align="right" sx={thSx}>Cost</TableCell>
                      <TableCell sx={thSx}>Cache</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredRequests.map((r) => (
                      <ExpandableRow
                        key={r.id}
                        detail={
                          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                            <DetailBlock label="Prompt" value={r.prompt || '—'} />
                            <Box>
                              <DetailBlock label="Request ID" value={r.id} />
                              <DetailBlock label="Provider" value={r.provider || '—'} />
                            </Box>
                          </Box>
                        }
                      >
                        <TableCell sx={{ color: '#6b7280', fontSize: '0.8rem' }}>{fmtTime(r.timestamp)}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500, color: '#111827', fontSize: '0.82rem' }}>
                            {r.model || '—'}
                          </Typography>
                        </TableCell>
                        <TableCell><StatusChip status={r.status} /></TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: r.latency > 2000 ? '#d97706' : '#374151' }}>
                            {r.latency ? fmtMs(r.latency) : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right" sx={{ color: '#374151', fontSize: '0.82rem' }}>
                          {r.tokens?.toLocaleString() || '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#374151' }}>
                          {r.cost != null ? `$${r.cost.toFixed(5)}` : '—'}
                        </TableCell>
                        <TableCell>
                          {r.cache_hit ? (
                            <Chip label="HIT" size="small" sx={{ bgcolor: '#ecfdf5', color: '#059669', fontWeight: 700, fontSize: '0.65rem', height: 18 }} />
                          ) : (
                            <Chip label="MISS" size="small" sx={{ bgcolor: '#f3f4f6', color: '#9ca3af', fontWeight: 600, fontSize: '0.65rem', height: 18 }} />
                          )}
                        </TableCell>
                      </ExpandableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </>
        )}

        {/* ─── Tab 1: Activity Logs ─── */}
        {tab === 1 && (
          <>
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <TextField
                size="small"
                placeholder="Search user or action…"
                value={actSearch}
                onChange={e => setActSearch(e.target.value)}
                InputProps={{ startAdornment: <Search size={14} style={{ marginRight: 6, color: '#9ca3af' }} /> }}
                sx={{ width: 280, '& .MuiOutlinedInput-root': { borderRadius: '8px', fontSize: '0.85rem' } }}
              />
              <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                {filteredActivity.length} entries
              </Typography>
            </Box>

            {loading ? (
              <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={28} /></Box>
            ) : filteredActivity.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Shield size={40} color="#d1d5db" />
                <Typography sx={{ color: '#9ca3af', mt: 1 }}>No activity logs</Typography>
                <Typography variant="caption" sx={{ color: '#d1d5db' }}>Requires admin role to view all activity</Typography>
              </Box>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f9fafb' }}>
                      <TableCell sx={{ width: 24 }} />
                      <TableCell sx={thSx}>Timestamp</TableCell>
                      <TableCell sx={thSx}>User</TableCell>
                      <TableCell sx={thSx}>Action</TableCell>
                      <TableCell sx={thSx}>IP Address</TableCell>
                      <TableCell sx={thSx}>Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredActivity.map((a) => (
                      <ExpandableRow
                        key={a.id}
                        detail={
                          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                            <DetailBlock label="User Agent" value={a.user_agent || '—'} />
                            <DetailBlock label="Full Details" value={a.details || '—'} />
                          </Box>
                        }
                      >
                        <TableCell sx={{ color: '#6b7280', fontSize: '0.8rem' }}>{fmtTime(a.created_at)}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 500, color: '#111827', fontSize: '0.82rem' }}>
                            {a.username || a.user_id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={a.action}
                            size="small"
                            sx={{
                              bgcolor: a.action?.includes('delete') || a.action?.includes('revoke') ? '#fef2f2' : '#eff6ff',
                              color: a.action?.includes('delete') || a.action?.includes('revoke') ? '#dc2626' : '#2563eb',
                              fontWeight: 600,
                              fontSize: '0.7rem',
                              height: 22,
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: '#6b7280', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                          {a.ip_address || '—'}
                        </TableCell>
                        <TableCell sx={{ color: '#374151', fontSize: '0.82rem', maxWidth: 280 }}>
                          <Typography noWrap variant="body2" sx={{ fontSize: '0.8rem', color: '#374151', maxWidth: 260 }}>
                            {a.details || '—'}
                          </Typography>
                        </TableCell>
                      </ExpandableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </>
        )}

        {/* ─── Tab 2: Event Logs ─── */}
        {tab === 2 && (
          <>
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Select
                size="small"
                value={evtType}
                onChange={e => setEvtType(e.target.value)}
                displayEmpty
                sx={{ minWidth: 200, borderRadius: '8px', fontSize: '0.85rem' }}
              >
                <MenuItem value="">All Event Types</MenuItem>
                {uniqueEventTypes.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
              <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                {filteredEvents.length} entries
              </Typography>
            </Box>

            {loading ? (
              <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={28} /></Box>
            ) : filteredEvents.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Zap size={40} color="#d1d5db" />
                <Typography sx={{ color: '#9ca3af', mt: 1 }}>No system events</Typography>
                <Typography variant="caption" sx={{ color: '#d1d5db' }}>Events are emitted on API calls, quota warnings, model changes, etc.</Typography>
              </Box>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f9fafb' }}>
                      <TableCell sx={{ width: 24 }} />
                      <TableCell sx={thSx}>Timestamp</TableCell>
                      <TableCell sx={thSx}>Event Type</TableCell>
                      <TableCell sx={thSx}>Source</TableCell>
                      <TableCell sx={thSx}>Payload Preview</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredEvents.map((e) => {
                      const isAlert = e.event_type?.includes('fail') || e.event_type?.includes('down') || e.event_type?.includes('exceeded');
                      const isWarning = e.event_type?.includes('warning');
                      return (
                        <ExpandableRow
                          key={e.id}
                          detail={
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                              <DetailBlock label="Payload" value={(() => { try { return JSON.stringify(JSON.parse(e.payload), null, 2); } catch { return e.payload || '—'; } })()} />
                              <DetailBlock label="Metadata" value={(() => { try { return JSON.stringify(JSON.parse(e.metadata), null, 2); } catch { return e.metadata || '—'; } })()} />
                            </Box>
                          }
                        >
                          <TableCell sx={{ color: '#6b7280', fontSize: '0.8rem' }}>{fmtTime(e.created_at)}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              {isAlert ? <AlertCircle size={14} color="#dc2626" /> : isWarning ? <AlertCircle size={14} color="#d97706" /> : <CheckCircle size={14} color="#059669" />}
                              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.82rem', color: isAlert ? '#dc2626' : isWarning ? '#d97706' : '#111827' }}>
                                {e.event_type}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip label={e.source || 'system'} size="small" sx={{ bgcolor: '#f3f4f6', color: '#374151', fontSize: '0.7rem', height: 20 }} />
                          </TableCell>
                          <TableCell sx={{ maxWidth: 320 }}>
                            <Typography noWrap variant="body2" sx={{ fontSize: '0.8rem', color: '#6b7280', fontFamily: 'monospace', maxWidth: 300 }}>
                              {e.payload?.slice(0, 80) || '—'}
                            </Typography>
                          </TableCell>
                        </ExpandableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Box>
            )}
          </>
        )}

        {/* ─── Tab 3: Webhook Deliveries ─── */}
        {tab === 3 && (
          <>
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <Select
                size="small"
                value={selectedWebhook}
                onChange={e => setSelectedWebhook(e.target.value as number)}
                displayEmpty
                sx={{ minWidth: 240, borderRadius: '8px', fontSize: '0.85rem' }}
              >
                <MenuItem value="">Select a webhook endpoint…</MenuItem>
                {webhooks.map(w => (
                  <MenuItem key={w.id} value={w.id}>
                    {w.name} {!w.active && <Chip label="inactive" size="small" sx={{ ml: 1, height: 16, fontSize: '0.65rem' }} />}
                  </MenuItem>
                ))}
              </Select>
              {selectedWebhook !== '' && (
                <Typography variant="caption" sx={{ color: '#9ca3af' }}>
                  {deliveries.length} deliveries
                </Typography>
              )}
            </Box>

            {!selectedWebhook ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Webhook size={40} color="#d1d5db" />
                <Typography sx={{ color: '#9ca3af', mt: 1 }}>Select a webhook endpoint above</Typography>
                <Typography variant="caption" sx={{ color: '#d1d5db' }}>View delivery attempts and HTTP responses for each endpoint</Typography>
              </Box>
            ) : loading ? (
              <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={28} /></Box>
            ) : deliveries.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Clock size={40} color="#d1d5db" />
                <Typography sx={{ color: '#9ca3af', mt: 1 }}>No deliveries yet for this endpoint</Typography>
              </Box>
            ) : (
              <Box sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f9fafb' }}>
                      <TableCell sx={{ width: 24 }} />
                      <TableCell sx={thSx}>Delivered At</TableCell>
                      <TableCell sx={thSx}>Event Type</TableCell>
                      <TableCell sx={thSx}>Status</TableCell>
                      <TableCell align="right" sx={thSx}>HTTP Code</TableCell>
                      <TableCell align="right" sx={thSx}>Latency</TableCell>
                      <TableCell align="right" sx={thSx}>Attempt</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {deliveries.map((d) => (
                      <ExpandableRow
                        key={d.id}
                        detail={
                          <Box>
                            <DetailBlock label="Error" value={d.error || 'None'} />
                          </Box>
                        }
                      >
                        <TableCell sx={{ color: '#6b7280', fontSize: '0.8rem' }}>{fmtTime(d.delivered_at)}</TableCell>
                        <TableCell sx={{ fontWeight: 500, fontSize: '0.82rem', color: '#111827' }}>{d.event_type}</TableCell>
                        <TableCell>
                          {d.success ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <CheckCircle size={14} color="#059669" />
                              <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600 }}>Delivered</Typography>
                            </Box>
                          ) : (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <AlertCircle size={14} color="#dc2626" />
                              <Typography variant="caption" sx={{ color: '#dc2626', fontWeight: 600 }}>Failed</Typography>
                            </Box>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={d.status_code || '—'}
                            size="small"
                            sx={{
                              bgcolor: d.status_code >= 200 && d.status_code < 300 ? '#ecfdf5' : '#fef2f2',
                              color: d.status_code >= 200 && d.status_code < 300 ? '#059669' : '#dc2626',
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              height: 22,
                            }}
                          />
                        </TableCell>
                        <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#374151' }}>
                          {d.latency_ms ? fmtMs(d.latency_ms) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ color: d.attempt > 1 ? '#d97706' : '#9ca3af', fontSize: '0.82rem', fontWeight: d.attempt > 1 ? 600 : 400 }}>
                          #{d.attempt}
                        </TableCell>
                      </ExpandableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </>
        )}
      </Paper>
    </Box>
  );
}
