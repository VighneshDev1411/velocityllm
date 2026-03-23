'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import LinearProgress from '@mui/material/LinearProgress';
import { Activity, AlertTriangle, ScrollText, GitBranch, Target, CheckCircle, XCircle, Clock } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const MONO = '"JetBrains Mono", monospace';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ObservabilityPage() {
  const [tab, setTab] = useState(0);
  const qc = useQueryClient();

  const { data: statsData } = useQuery({ queryKey: ['monitoring-stats'], queryFn: () => fetcher(`${API}/api/v1/monitoring/stats`), refetchInterval: 10000 });
  const { data: metricsData } = useQuery({ queryKey: ['monitoring-metrics'], queryFn: () => fetcher(`${API}/api/v1/monitoring/metrics`), enabled: tab === 0 });
  const { data: alertsData } = useQuery({ queryKey: ['monitoring-alerts'], queryFn: () => fetcher(`${API}/api/v1/monitoring/alerts`), enabled: tab === 1 });
  const { data: logsData } = useQuery({ queryKey: ['monitoring-logs'], queryFn: () => fetcher(`${API}/api/v1/monitoring/logs`), enabled: tab === 2 });
  const { data: tracesData } = useQuery({ queryKey: ['monitoring-traces'], queryFn: () => fetcher(`${API}/api/v1/monitoring/traces`), enabled: tab === 3 });
  const { data: slosData } = useQuery({ queryKey: ['monitoring-slos'], queryFn: () => fetcher(`${API}/api/v1/monitoring/slos`), enabled: tab === 4 });

  const resolveMut = useMutation({
    mutationFn: (id: string) => fetch(`${API}/api/v1/monitoring/alerts/resolve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monitoring-alerts'] }),
  });

  const toggleRuleMut = useMutation({
    mutationFn: (id: string) => fetch(`${API}/api/v1/monitoring/alerts/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['monitoring-alerts'] }),
  });

  const stats = statsData?.data;
  const metrics = metricsData?.data?.metrics || [];
  const alerts = alertsData?.data?.alerts || [];
  const alertRules = alertsData?.data?.rules || [];
  const logs = logsData?.data?.logs || [];
  const traces = tracesData?.data?.traces || [];
  const slos = slosData?.data?.slos || [];

  const kpis = stats ? [
    { label: 'Active Metrics', value: stats.active_metrics || 0, color: '#4b8eff', icon: Activity },
    { label: 'Active Alerts', value: stats.active_alerts || 0, color: stats.active_alerts > 0 ? '#f97316' : '#22c55e', icon: AlertTriangle },
    { label: 'Log Entries', value: stats.log_entries || 0, color: '#a78bfa', icon: ScrollText },
    { label: 'Active Traces', value: stats.active_traces || 0, color: '#06b6d4', icon: GitBranch },
    { label: 'SLOs Tracked', value: stats.slo_count || 0, color: '#22c55e', icon: Target },
    { label: 'Alert Rules', value: stats.alert_rules || 0, color: '#f59e0b', icon: AlertTriangle },
  ] : [];

  const severityColor = (s: string) => {
    switch (s) { case 'critical': return '#ef4444'; case 'warning': return '#f97316'; case 'info': return '#3b82f6'; default: return '#6b7280'; }
  };

  const levelColor = (l: string) => {
    switch (l) { case 'ERROR': return '#ef4444'; case 'WARN': return '#f97316'; case 'INFO': return '#3b82f6'; case 'DEBUG': return '#6b7280'; default: return '#9ca3af'; }
  };

  return (
    <Box>
      <PageHeader title="Monitoring & Observability" subtitle="Metrics, alerts, logs, traces, and SLOs" />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Grid key={k.label} size={{ xs: 6, md: 2 }}>
              <Card sx={{ backgroundColor: '#0d1117', border: '1px solid #1e2736', borderLeft: `3px solid ${k.color}` }}>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Box sx={{ color: k.color, display: 'flex' }}><Icon className="w-3.5 h-3.5" /></Box>
                    <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontFamily: MONO, textTransform: 'uppercase' }}>{k.label}</Typography>
                  </Box>
                  <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#e5e2e1', fontFamily: MONO }}>{k.value}</Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Card sx={{ backgroundColor: '#0d1117', border: '1px solid #1e2736' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid #1e2736', '& .MuiTab-root': { color: 'rgba(255,255,255,0.5)', fontFamily: MONO, fontSize: '0.75rem', textTransform: 'none', minHeight: 42 }, '& .Mui-selected': { color: '#4b8eff' }, '& .MuiTabs-indicator': { backgroundColor: '#4b8eff' } }}>
          <Tab label="Metrics" />
          <Tab label="Alerts" />
          <Tab label="Logs" />
          <Tab label="Traces" />
          <Tab label="SLOs" />
        </Tabs>

        <CardContent>
          {/* Metrics Tab */}
          {tab === 0 && (
            <Grid container spacing={2}>
              {metrics.map((m: any) => (
                <Grid key={m.name} size={{ xs: 12, md: 6 }}>
                  <Box sx={{ p: 2, backgroundColor: '#141922', borderRadius: 1, border: '1px solid #1e2736' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#e5e2e1', fontFamily: MONO }}>{m.name}</Typography>
                      <Chip label={m.type} size="small" sx={{ height: 20, fontSize: '0.6rem', fontFamily: MONO, backgroundColor: 'rgba(75,142,255,0.15)', color: '#4b8eff' }} />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 3, mb: 1 }}>
                      <Box>
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontFamily: MONO }}>Current</Typography>
                        <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#4b8eff', fontFamily: MONO }}>{typeof m.current === 'number' ? m.current.toFixed(2) : m.current}{m.unit}</Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontFamily: MONO }}>Min / Max</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', fontFamily: MONO }}>{typeof m.min === 'number' ? m.min.toFixed(1) : m.min} / {typeof m.max === 'number' ? m.max.toFixed(1) : m.max}{m.unit}</Typography>
                      </Box>
                    </Box>
                    {m.datapoints && m.datapoints.length > 0 && (
                      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '1px', height: 30 }}>
                        {m.datapoints.slice(-30).map((d: number, i: number) => {
                          const max = Math.max(...m.datapoints.slice(-30));
                          const h = max > 0 ? (d / max) * 100 : 0;
                          return <Box key={i} sx={{ flex: 1, backgroundColor: '#4b8eff', opacity: 0.4 + (i / 30) * 0.6, height: `${h}%`, borderRadius: '1px 1px 0 0', minHeight: 1 }} />;
                        })}
                      </Box>
                    )}
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Alerts Tab */}
          {tab === 1 && (
            <Box>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#e5e2e1', fontFamily: MONO, mb: 1.5 }}>Active Alerts</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Severity', 'Message', 'Metric', 'Value', 'Status', 'Actions'].map(h => (
                        <TableCell key={h} sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#1e2736' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {alerts.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell sx={{ borderColor: '#1e2736' }}><Chip label={a.severity} size="small" sx={{ height: 20, fontSize: '0.6rem', fontFamily: MONO, backgroundColor: `${severityColor(a.severity)}20`, color: severityColor(a.severity) }} /></TableCell>
                        <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#1e2736' }}>{a.message}</TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.6)', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#1e2736' }}>{a.metric}</TableCell>
                        <TableCell sx={{ color: '#f97316', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#1e2736' }}>{typeof a.value === 'number' ? a.value.toFixed(2) : a.value}</TableCell>
                        <TableCell sx={{ borderColor: '#1e2736' }}><Chip label={a.resolved ? 'Resolved' : 'Active'} size="small" sx={{ height: 20, fontSize: '0.6rem', fontFamily: MONO, backgroundColor: a.resolved ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: a.resolved ? '#22c55e' : '#ef4444' }} /></TableCell>
                        <TableCell sx={{ borderColor: '#1e2736' }}>{!a.resolved && <Button size="small" onClick={() => resolveMut.mutate(a.id)} sx={{ fontSize: '0.6rem', fontFamily: MONO, textTransform: 'none', color: '#22c55e' }}>Resolve</Button>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#e5e2e1', fontFamily: MONO, mt: 3, mb: 1.5 }}>Alert Rules</Typography>
              <Grid container spacing={1.5}>
                {alertRules.map((rule: any) => (
                  <Grid key={rule.id} size={{ xs: 12, md: 4 }}>
                    <Box sx={{ p: 2, backgroundColor: '#141922', borderRadius: 1, border: '1px solid #1e2736' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#e5e2e1', fontFamily: MONO }}>{rule.name}</Typography>
                        <Chip label={rule.enabled ? 'Enabled' : 'Disabled'} size="small" sx={{ height: 18, fontSize: '0.55rem', fontFamily: MONO, backgroundColor: rule.enabled ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)', color: rule.enabled ? '#22c55e' : 'rgba(255,255,255,0.3)' }} />
                      </Box>
                      <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontFamily: MONO, mb: 1 }}>{rule.metric} {rule.condition} {rule.threshold}</Typography>
                      <Button size="small" onClick={() => toggleRuleMut.mutate(rule.id)} sx={{ fontSize: '0.6rem', fontFamily: MONO, textTransform: 'none', color: '#4b8eff' }}>{rule.enabled ? 'Disable' : 'Enable'}</Button>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {/* Logs Tab */}
          {tab === 2 && (
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {['Time', 'Level', 'Service', 'Message'].map(h => (
                      <TableCell key={h} sx={{ backgroundColor: '#0d1117', color: 'rgba(255,255,255,0.4)', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#1e2736' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#1e2736', whiteSpace: 'nowrap' }}>{new Date(log.timestamp).toLocaleTimeString()}</TableCell>
                      <TableCell sx={{ borderColor: '#1e2736' }}><Chip label={log.level} size="small" sx={{ height: 18, fontSize: '0.55rem', fontFamily: MONO, backgroundColor: `${levelColor(log.level)}20`, color: levelColor(log.level) }} /></TableCell>
                      <TableCell sx={{ color: '#4b8eff', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#1e2736' }}>{log.service}</TableCell>
                      <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#1e2736' }}>{log.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Traces Tab */}
          {tab === 3 && (
            <Box>
              {traces.map((t: any) => (
                <Box key={t.trace_id} sx={{ mb: 2, p: 2, backgroundColor: '#141922', borderRadius: 1, border: '1px solid #1e2736' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#e5e2e1', fontFamily: MONO }}>{t.name}</Typography>
                      <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: MONO }}>{t.trace_id}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b8eff', fontFamily: MONO }}>{t.duration}</Typography>
                      <Chip label={t.status} size="small" sx={{ height: 18, fontSize: '0.55rem', fontFamily: MONO, backgroundColor: t.status === 'ok' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: t.status === 'ok' ? '#22c55e' : '#ef4444' }} />
                    </Box>
                  </Box>
                  {t.spans && t.spans.map((s: any, i: number) => (
                    <Box key={i} sx={{ ml: i * 2, pl: 1.5, borderLeft: '2px solid #1e2736', py: 0.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', fontFamily: MONO }}>{s.name} <span style={{ color: 'rgba(255,255,255,0.3)' }}>({s.service})</span></Typography>
                        <Typography sx={{ fontSize: '0.65rem', color: '#f97316', fontFamily: MONO }}>{s.duration}</Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          )}

          {/* SLOs Tab */}
          {tab === 4 && (
            <Grid container spacing={2}>
              {slos.map((slo: any) => {
                const met = slo.current >= slo.target;
                return (
                  <Grid key={slo.id} size={{ xs: 12, md: 6 }}>
                    <Box sx={{ p: 2, backgroundColor: '#141922', borderRadius: 1, border: '1px solid #1e2736' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#e5e2e1', fontFamily: MONO }}>{slo.name}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Box sx={{ color: met ? '#22c55e' : '#ef4444', display: 'flex' }}>
                            {met ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                          </Box>
                          <Typography sx={{ fontSize: '0.65rem', fontFamily: MONO, color: met ? '#22c55e' : '#ef4444' }}>{met ? 'Met' : 'Breached'}</Typography>
                        </Box>
                      </Box>
                      <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontFamily: MONO, mb: 1 }}>{slo.description}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
                        <Box sx={{ flex: 1 }}>
                          <LinearProgress variant="determinate" value={Math.min(slo.current, 100)} sx={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { backgroundColor: met ? '#22c55e' : '#ef4444', borderRadius: 3 } }} />
                        </Box>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: met ? '#22c55e' : '#ef4444', fontFamily: MONO, minWidth: 50 }}>{slo.current?.toFixed(2)}%</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: MONO }}>Target: {slo.target}%</Typography>
                        <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: MONO }}>Error Budget: {slo.error_budget_remaining?.toFixed(2)}%</Typography>
                      </Box>
                    </Box>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
