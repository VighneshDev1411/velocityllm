'use client';

import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { Rocket, CheckCircle, XCircle, AlertTriangle, Circle, Server, Shield, Activity, BookOpen, FlaskConical, Clock } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const MONO = '"JetBrains Mono", monospace';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const statusColor = (s: string) => {
  switch (s) { case 'operational': return '#22c55e'; case 'degraded': return '#ffb595'; case 'outage': return '#ef4444'; case 'maintenance': return '#4b8eff'; default: return '#6b7280'; }
};

const checkStatusIcon = (s: string) => {
  switch (s) {
    case 'passed': return <CheckCircle className="w-4 h-4" />;
    case 'failed': return <XCircle className="w-4 h-4" />;
    case 'warning': return <AlertTriangle className="w-4 h-4" />;
    default: return <Circle className="w-4 h-4" />;
  }
};

const checkStatusColor = (s: string) => {
  switch (s) { case 'passed': return '#22c55e'; case 'failed': return '#ef4444'; case 'warning': return '#ffb595'; case 'skipped': return '#6b7280'; default: return '#6b7280'; }
};

const categoryIcon = (c: string) => {
  switch (c) { case 'infrastructure': return Server; case 'security': return Shield; case 'monitoring': return Activity; case 'documentation': return BookOpen; case 'testing': return FlaskConical; default: return Server; }
};

const incidentSeverityColor = (s: string) => {
  switch (s) { case 'critical': return '#ef4444'; case 'major': return '#f97316'; case 'minor': return '#ffb595'; default: return '#6b7280'; }
};

export default function StatusPage() {
  const { data: statsData } = useQuery({ queryKey: ['status-stats'], queryFn: () => fetcher(`${API}/api/v1/status/stats`), refetchInterval: 10000 });
  const { data: componentsData } = useQuery({ queryKey: ['status-components'], queryFn: () => fetcher(`${API}/api/v1/status/components`), refetchInterval: 15000 });
  const { data: incidentsData } = useQuery({ queryKey: ['status-incidents'], queryFn: () => fetcher(`${API}/api/v1/status/incidents`) });
  const { data: launchData } = useQuery({ queryKey: ['status-launch'], queryFn: () => fetcher(`${API}/api/v1/status/launch`) });

  const stats = statsData?.data;
  const components = componentsData?.data?.components || [];
  const incidents = incidentsData?.data?.incidents || [];
  const launchChecks = launchData?.data?.checks || [];

  const coreComponents = components.filter((c: any) => c.category === 'core');
  const infraComponents = components.filter((c: any) => c.category === 'infrastructure');
  const externalComponents = components.filter((c: any) => c.category === 'external');

  const launchCategories = ['infrastructure', 'security', 'monitoring', 'documentation', 'testing'];
  const launchProgress = stats ? ((stats.checks_passed || 0) / (stats.launch_checks || 1)) * 100 : 0;

  return (
    <Box>
      <PageHeader title="System Status & Launch" subtitle="Platform health, incidents, and launch readiness" />

      {/* Overall Status Banner */}
      {stats && (
        <Card sx={{ backgroundColor: stats.operational === stats.total_components ? '#0e0e0e' : '#1a1207', border: `1px solid ${stats.operational === stats.total_components ? '#22c55e40' : '#ffb59540'}`, mb: 3 }}>
          <CardContent sx={{ py: 2, px: 3, '&:last-child': { pb: 2 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ color: stats.operational === stats.total_components ? '#22c55e' : '#ffb595', display: 'flex' }}>
                <CheckCircle className="w-5 h-5" />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: '#e5e2e1', fontFamily: MONO }}>
                  {stats.operational === stats.total_components ? 'All Systems Operational' : 'Some Systems Degraded'}
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontFamily: MONO }}>
                  {stats.operational}/{stats.total_components} components operational — Uptime: {stats.uptime}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: stats.launch_ready ? '#22c55e' : '#ffb595', fontFamily: MONO }}>{stats.checks_passed}/{stats.launch_checks}</Typography>
                <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontFamily: MONO }}>Launch Checks</Typography>
              </Box>
              <Box sx={{ textAlign: 'center' }}>
                <Chip label={stats.launch_ready ? 'LAUNCH READY' : 'NOT READY'} sx={{ fontFamily: MONO, fontWeight: 700, fontSize: '0.7rem', backgroundColor: stats.launch_ready ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: stats.launch_ready ? '#22c55e' : '#ef4444' }} />
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Components */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { title: 'Core Services', items: coreComponents },
          { title: 'Infrastructure', items: infraComponents },
          { title: 'External Providers', items: externalComponents },
        ].map(({ title, items }) => (
          <Grid key={title} size={{ xs: 12, md: 4 }}>
            <Card sx={{ backgroundColor: '#0e0e0e', border: '1px solid #2a2a2a', height: '100%' }}>
              <CardContent>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#e5e2e1', fontFamily: MONO, mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{title}</Typography>
                {items.map((c: any) => (
                  <Box key={c.name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1, borderBottom: '1px solid #2a2a2a40' }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: statusColor(c.status) }} />
                        <Typography sx={{ fontSize: '0.75rem', color: '#e5e2e1', fontFamily: MONO }}>{c.name}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: MONO, ml: 2 }}>{c.description}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                      <Typography sx={{ fontSize: '0.65rem', color: statusColor(c.status), fontFamily: MONO }}>{c.uptime}%</Typography>
                      <Typography sx={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', fontFamily: MONO }}>{c.latency_ms?.toFixed(0)}ms</Typography>
                    </Box>
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Incidents + Launch Readiness side by side */}
      <Grid container spacing={2}>
        {/* Recent Incidents */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ backgroundColor: '#0e0e0e', border: '1px solid #2a2a2a', height: '100%' }}>
            <CardContent>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#e5e2e1', fontFamily: MONO, mb: 2, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Recent Incidents</Typography>
              {incidents.length === 0 && <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', fontFamily: MONO }}>No recent incidents</Typography>}
              {incidents.map((inc: any) => (
                <Box key={inc.id} sx={{ mb: 2, pb: 2, borderBottom: '1px solid #2a2a2a40' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip label={inc.severity} size="small" sx={{ height: 18, fontSize: '0.55rem', fontFamily: MONO, backgroundColor: `${incidentSeverityColor(inc.severity)}15`, color: incidentSeverityColor(inc.severity) }} />
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#e5e2e1', fontFamily: MONO }}>{inc.title}</Typography>
                    </Box>
                    <Chip label={inc.status} size="small" sx={{ height: 18, fontSize: '0.55rem', fontFamily: MONO, backgroundColor: inc.status === 'resolved' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: inc.status === 'resolved' ? '#22c55e' : '#ef4444' }} />
                  </Box>
                  <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontFamily: MONO, mb: 0.5 }}>{inc.message}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ color: 'rgba(255,255,255,0.2)', display: 'flex' }}><Clock className="w-3 h-3" /></Box>
                    <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: MONO }}>{new Date(inc.created_at).toLocaleDateString()}</Typography>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Launch Readiness Checklist */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ backgroundColor: '#0e0e0e', border: '1px solid #2a2a2a' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ color: '#adc6ff', display: 'flex' }}><Rocket className="w-4 h-4" /></Box>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#e5e2e1', fontFamily: MONO, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Launch Readiness</Typography>
                </Box>
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: launchProgress === 100 ? '#22c55e' : '#ffb595', fontFamily: MONO }}>{launchProgress.toFixed(0)}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={launchProgress} sx={{ height: 6, borderRadius: 3, mb: 2, backgroundColor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { backgroundColor: launchProgress === 100 ? '#22c55e' : '#adc6ff', borderRadius: 3 } }} />

              {launchCategories.map(cat => {
                const checks = launchChecks.filter((c: any) => c.category === cat);
                if (checks.length === 0) return null;
                const CatIcon = categoryIcon(cat);
                const passed = checks.filter((c: any) => c.status === 'passed').length;
                return (
                  <Box key={cat} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Box sx={{ color: '#4b8eff', display: 'flex' }}><CatIcon className="w-3.5 h-3.5" /></Box>
                      <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#e5e2e1', fontFamily: MONO, textTransform: 'uppercase' }}>{cat}</Typography>
                      <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: MONO }}>{passed}/{checks.length}</Typography>
                    </Box>
                    {checks.map((c: any) => (
                      <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75, pl: 2, borderLeft: `2px solid ${checkStatusColor(c.status)}30` }}>
                        <Box sx={{ color: checkStatusColor(c.status), display: 'flex', flexShrink: 0 }}>{checkStatusIcon(c.status)}</Box>
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ fontSize: '0.7rem', color: '#e5e2e1', fontFamily: MONO }}>{c.name}</Typography>
                            {c.required && <Chip label="required" size="small" sx={{ height: 16, fontSize: '0.5rem', fontFamily: MONO, backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }} />}
                          </Box>
                          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: MONO }}>{c.description}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                );
              })}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
