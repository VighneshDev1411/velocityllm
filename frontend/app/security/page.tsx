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
import Switch from '@mui/material/Switch';
import LinearProgress from '@mui/material/LinearProgress';
import { Shield, Bug, Eye, FileWarning, Flame, Lock, CheckCircle, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const MONO = '"JetBrains Mono", monospace';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function SecurityPage() {
  const [tab, setTab] = useState(0);
  const qc = useQueryClient();

  const { data: statsData } = useQuery({ queryKey: ['security-stats'], queryFn: () => fetcher(`${API}/api/v1/security/stats`), refetchInterval: 10000 });
  const { data: scansData } = useQuery({ queryKey: ['security-scans'], queryFn: () => fetcher(`${API}/api/v1/security/scans`), enabled: tab === 0 });
  const { data: vulnsData } = useQuery({ queryKey: ['security-vulns'], queryFn: () => fetcher(`${API}/api/v1/security/vulnerabilities`), enabled: tab === 1 });
  const { data: complianceData } = useQuery({ queryKey: ['security-compliance'], queryFn: () => fetcher(`${API}/api/v1/security/compliance`), enabled: tab === 2 });
  const { data: wafData } = useQuery({ queryKey: ['security-waf'], queryFn: () => fetcher(`${API}/api/v1/security/waf`), enabled: tab === 3 });
  const { data: policiesData } = useQuery({ queryKey: ['security-policies'], queryFn: () => fetcher(`${API}/api/v1/security/policies`), enabled: tab === 4 });

  const runScanMut = useMutation({
    mutationFn: (type: string) => fetch(`${API}/api/v1/security/scans/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['security-scans'] }); qc.invalidateQueries({ queryKey: ['security-stats'] }); },
  });

  const togglePolicyMut = useMutation({
    mutationFn: (name: string) => fetch(`${API}/api/v1/security/policies/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['security-policies'] }); qc.invalidateQueries({ queryKey: ['security-stats'] }); },
  });

  const stats = statsData?.data;
  const scans = scansData?.data?.scans || [];
  const vulns = vulnsData?.data?.vulnerabilities || [];
  const compliance = complianceData?.data?.checks || [];
  const wafEvents = wafData?.data?.events || [];
  const policies = policiesData?.data?.policies || [];

  const kpis = stats ? [
    { label: 'Total Scans', value: stats.total_scans, color: '#4b8eff', icon: Shield },
    { label: 'Vulnerabilities', value: stats.vulnerabilities, color: stats.critical_vulns > 0 ? '#ef4444' : '#f97316', icon: Bug },
    { label: 'Critical', value: stats.critical_vulns, color: stats.critical_vulns > 0 ? '#ef4444' : '#22c55e', icon: AlertTriangle },
    { label: 'Secrets Found', value: stats.secrets_detected, color: '#adc6ff', icon: Eye },
    { label: 'Compliance', value: `${stats.compliance_score?.toFixed(0)}%`, color: stats.compliance_score >= 80 ? '#22c55e' : '#f97316', icon: CheckCircle },
    { label: 'WAF Blocked', value: stats.waf_events_blocked, color: '#f97316', icon: Flame },
  ] : [];

  const severityColor = (s: string) => {
    switch (s) { case 'critical': return '#ef4444'; case 'high': return '#f97316'; case 'medium': return '#ffb595'; case 'low': return '#22c55e'; default: return '#6b7280'; }
  };

  const scanStatusColor = (s: string) => {
    switch (s) { case 'passed': return '#22c55e'; case 'failed': return '#ef4444'; case 'warning': return '#f97316'; default: return '#6b7280'; }
  };

  const complianceColor = (s: string) => {
    switch (s) { case 'compliant': return '#22c55e'; case 'non_compliant': return '#ef4444'; case 'partial': return '#ffb595'; default: return '#6b7280'; }
  };

  return (
    <Box>
      <PageHeader title="Security Hardening" subtitle="Vulnerability scanning, compliance, WAF, and security policies" />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Grid key={k.label} size={{ xs: 6, md: 2 }}>
              <Card sx={{ backgroundColor: '#0e0e0e', border: '1px solid #2a2a2a', borderLeft: `3px solid ${k.color}` }}>
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

      <Card sx={{ backgroundColor: '#0e0e0e', border: '1px solid #2a2a2a' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: '1px solid #2a2a2a', '& .MuiTab-root': { color: 'rgba(255,255,255,0.5)', fontFamily: MONO, fontSize: '0.75rem', textTransform: 'none', minHeight: 42 }, '& .Mui-selected': { color: '#4b8eff' }, '& .MuiTabs-indicator': { backgroundColor: '#4b8eff' } }}>
          <Tab label="Scans" />
          <Tab label="Vulnerabilities" />
          <Tab label="Compliance" />
          <Tab label="WAF Events" />
          <Tab label="Policies" />
        </Tabs>

        <CardContent>
          {/* Scans Tab */}
          {tab === 0 && (
            <Box>
              <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                {['vulnerability', 'dependency', 'sast', 'container', 'secret'].map(t => (
                  <Button key={t} size="small" variant="outlined" onClick={() => runScanMut.mutate(t)} disabled={runScanMut.isPending}
                    sx={{ fontSize: '0.65rem', fontFamily: MONO, textTransform: 'none', borderColor: '#2a2a2a', color: '#4b8eff', '&:hover': { borderColor: '#4b8eff' } }}>
                    Run {t} scan
                  </Button>
                ))}
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Type', 'Status', 'Findings', 'Critical', 'High', 'Medium', 'Low', 'Duration', 'Completed'].map(h => (
                        <TableCell key={h} sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {scans.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{s.type}</TableCell>
                        <TableCell sx={{ borderColor: '#2a2a2a' }}><Chip label={s.status} size="small" sx={{ height: 20, fontSize: '0.6rem', fontFamily: MONO, backgroundColor: `${scanStatusColor(s.status)}20`, color: scanStatusColor(s.status) }} /></TableCell>
                        <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a', fontWeight: 600 }}>{s.findings}</TableCell>
                        <TableCell sx={{ color: s.critical > 0 ? '#ef4444' : 'rgba(255,255,255,0.3)', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{s.critical}</TableCell>
                        <TableCell sx={{ color: s.high > 0 ? '#f97316' : 'rgba(255,255,255,0.3)', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{s.high}</TableCell>
                        <TableCell sx={{ color: s.medium > 0 ? '#ffb595' : 'rgba(255,255,255,0.3)', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{s.medium}</TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.3)', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{s.low}</TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.5)', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>{s.duration}</TableCell>
                        <TableCell sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a' }}>{new Date(s.completed_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Vulnerabilities Tab */}
          {tab === 1 && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {['Severity', 'CVE', 'Title', 'Package', 'Version', 'Fixed In', 'CVSS', 'Status'].map(h => (
                      <TableCell key={h} sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {vulns.map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell sx={{ borderColor: '#2a2a2a' }}><Chip label={v.severity} size="small" sx={{ height: 20, fontSize: '0.6rem', fontFamily: MONO, backgroundColor: `${severityColor(v.severity)}20`, color: severityColor(v.severity) }} /></TableCell>
                      <TableCell sx={{ color: '#4b8eff', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a' }}>{v.cve}</TableCell>
                      <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a', maxWidth: 250 }}>{v.title}</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.6)', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a' }}>{v.package}</TableCell>
                      <TableCell sx={{ color: '#ef4444', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a' }}>{v.version}</TableCell>
                      <TableCell sx={{ color: '#22c55e', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a' }}>{v.fixed_in}</TableCell>
                      <TableCell sx={{ color: v.cvss >= 7 ? '#ef4444' : v.cvss >= 4 ? '#ffb595' : '#22c55e', fontFamily: MONO, fontSize: '0.7rem', fontWeight: 700, borderColor: '#2a2a2a' }}>{v.cvss}</TableCell>
                      <TableCell sx={{ borderColor: '#2a2a2a' }}><Chip label={v.status} size="small" sx={{ height: 20, fontSize: '0.6rem', fontFamily: MONO, backgroundColor: v.status === 'fixed' ? 'rgba(34,197,94,0.15)' : v.status === 'ignored' ? 'rgba(255,255,255,0.05)' : 'rgba(239,68,68,0.15)', color: v.status === 'fixed' ? '#22c55e' : v.status === 'ignored' ? 'rgba(255,255,255,0.4)' : '#ef4444' }} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Compliance Tab */}
          {tab === 2 && (
            <Box>
              {['SOC2', 'GDPR', 'PCI-DSS', 'HIPAA'].map(fw => {
                const checks = compliance.filter((c: any) => c.framework === fw);
                if (checks.length === 0) return null;
                const passed = checks.filter((c: any) => c.status === 'compliant').length;
                const pct = (passed / checks.length) * 100;
                return (
                  <Box key={fw} sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#e5e2e1', fontFamily: MONO }}>{fw}</Typography>
                      <LinearProgress variant="determinate" value={pct} sx={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.05)', '& .MuiLinearProgress-bar': { backgroundColor: pct === 100 ? '#22c55e' : '#ffb595', borderRadius: 2 } }} />
                      <Typography sx={{ fontSize: '0.7rem', fontFamily: MONO, color: pct === 100 ? '#22c55e' : '#ffb595' }}>{passed}/{checks.length}</Typography>
                    </Box>
                    {checks.map((c: any) => (
                      <Box key={c.id} sx={{ pl: 2, py: 1, mb: 0.5, backgroundColor: '#141922', borderRadius: 1, border: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pr: 2 }}>
                        <Box>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#4b8eff', fontFamily: MONO }}>{c.control}</Typography>
                            <Typography sx={{ fontSize: '0.7rem', color: '#e5e2e1', fontFamily: MONO }}>{c.description}</Typography>
                          </Box>
                          <Typography sx={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', fontFamily: MONO, mt: 0.25 }}>{c.evidence}</Typography>
                        </Box>
                        <Chip label={c.status.replace('_', ' ')} size="small" sx={{ height: 20, fontSize: '0.55rem', fontFamily: MONO, backgroundColor: `${complianceColor(c.status)}15`, color: complianceColor(c.status), ml: 2, flexShrink: 0 }} />
                      </Box>
                    ))}
                  </Box>
                );
              })}
            </Box>
          )}

          {/* WAF Events Tab */}
          {tab === 3 && (
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {['Time', 'Rule', 'Category', 'Action', 'Source IP', 'Method', 'Path'].map(h => (
                      <TableCell key={h} sx={{ backgroundColor: '#0e0e0e', color: 'rgba(255,255,255,0.4)', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {wafEvents.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.4)', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a', whiteSpace: 'nowrap' }}>{new Date(e.timestamp).toLocaleTimeString()}</TableCell>
                      <TableCell sx={{ color: '#4b8eff', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a' }}>{e.rule}</TableCell>
                      <TableCell sx={{ borderColor: '#2a2a2a' }}><Chip label={e.category} size="small" sx={{ height: 20, fontSize: '0.55rem', fontFamily: MONO, backgroundColor: e.category === 'sqli' || e.category === 'rce' ? 'rgba(239,68,68,0.15)' : 'rgba(249,115,22,0.15)', color: e.category === 'sqli' || e.category === 'rce' ? '#ef4444' : '#f97316' }} /></TableCell>
                      <TableCell sx={{ borderColor: '#2a2a2a' }}><Chip label={e.action} size="small" sx={{ height: 20, fontSize: '0.55rem', fontFamily: MONO, backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }} /></TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.5)', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a' }}>{e.source_ip}</TableCell>
                      <TableCell sx={{ color: 'rgba(255,255,255,0.5)', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a' }}>{e.method}</TableCell>
                      <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a' }}>{e.path}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Policies Tab */}
          {tab === 4 && (
            <Grid container spacing={1.5}>
              {policies.map((p: any) => (
                <Grid key={p.name} size={{ xs: 12, md: 6 }}>
                  <Box sx={{ p: 2, backgroundColor: '#141922', borderRadius: 1, border: '1px solid #2a2a2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                        <Box sx={{ color: p.enabled ? '#22c55e' : 'rgba(255,255,255,0.2)', display: 'flex' }}><Lock className="w-3.5 h-3.5" /></Box>
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#e5e2e1', fontFamily: MONO }}>{p.name}</Typography>
                      </Box>
                      <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontFamily: MONO }}>{p.description}</Typography>
                      <Chip label={p.category} size="small" sx={{ height: 18, fontSize: '0.55rem', fontFamily: MONO, backgroundColor: 'rgba(75,142,255,0.1)', color: '#4b8eff', mt: 0.5 }} />
                    </Box>
                    <Switch checked={p.enabled} onChange={() => togglePolicyMut.mutate(p.name)} size="small" sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#22c55e' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#22c55e' } }} />
                  </Box>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
