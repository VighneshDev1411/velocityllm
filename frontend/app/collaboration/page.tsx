'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import {
  Users, UserPlus, Shield, Eye, Edit3, Crown, Clock,
  FileText, GitBranch, Database, Settings, MessageSquare, Activity,
} from 'lucide-react';
import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Avatar from '@mui/material/Avatar';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';

const MONO = 'var(--font-mono), "JetBrains Mono", monospace';

const sectionLabelSx = {
  fontSize: '0.625rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.2em',
  color: '#c1c6d7',
  fontFamily: MONO,
};

function useCollabStats() {
  return useQuery({
    queryKey: ['collab-stats'],
    queryFn: async () => { const res = await api.get('/api/v1/collab/stats'); return res.data?.data; },
    refetchInterval: 5000,
  });
}

function useWorkspace() {
  return useQuery({
    queryKey: ['collab-workspace'],
    queryFn: async () => { const res = await api.get('/api/v1/collab/workspace?id=ws-1'); return res.data?.data; },
    refetchInterval: 5000,
  });
}

function useSharedResources() {
  return useQuery({
    queryKey: ['collab-resources'],
    queryFn: async () => { const res = await api.get('/api/v1/collab/resources?workspace_id=ws-1'); return res.data?.data; },
  });
}

function useAuditLog() {
  return useQuery({
    queryKey: ['collab-audit'],
    queryFn: async () => { const res = await api.get('/api/v1/collab/audit?workspace_id=ws-1'); return res.data?.data; },
  });
}

/* ── KPI Card ─────────────────────────────────────────── */
function KpiCard({ icon: Icon, label, value, accent = '#4b8eff' }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; accent?: string;
}) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderLeft: `3px solid ${accent}`, borderRadius: '8px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Icon className="w-4 h-4" />
        <Box>
          <Typography sx={{ ...sectionLabelSx, mb: 0.5 }}>{label}</Typography>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: MONO, color: '#e5e2e1' }}>{value}</Typography>
        </Box>
      </Box>
    </Paper>
  );
}

/* ── Members Panel ────────────────────────────────────── */
function MembersPanel({ members }: { members: any[] }) {
  const queryClient = useQueryClient();
  const roleColors: Record<string, string> = { owner: '#ffb595', admin: '#adc6ff', editor: '#4b8eff', viewer: '#c1c6d7' };
  const roleIcons: Record<string, React.ComponentType<{ className?: string }>> = { owner: Crown, admin: Shield, editor: Edit3, viewer: Eye };
  const statusColors: Record<string, string> = { online: '#53e16f', away: '#ffb595', offline: '#414755' };

  const updateRole = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: string }) => {
      await api.post('/api/v1/collab/members/role', { workspace_id: 'ws-1', user_id, role });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collab-workspace'] }),
  });

  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Team Members ({members.length})</Typography>
      {members.map((m: any) => {
        const RoleIcon = roleIcons[m.role] || Eye;
        return (
          <Box key={m.user_id} sx={{ p: 1.5, mb: 1, backgroundColor: '#0e0e0e', borderRadius: '6px', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar sx={{ width: 32, height: 32, fontSize: '0.7rem', fontFamily: MONO, backgroundColor: roleColors[m.role] + '30', color: roleColors[m.role] }}>
                  {m.avatar}
                </Avatar>
                <Box sx={{ position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%', backgroundColor: statusColors[m.status] || '#414755', border: '2px solid #0e0e0e' }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.8rem', fontFamily: MONO, color: '#e5e2e1', fontWeight: 600 }}>{m.name}</Typography>
                <Typography sx={{ fontSize: '0.65rem', fontFamily: MONO, color: '#c1c6d7' }}>{m.email}</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                icon={<RoleIcon className="w-3 h-3" />}
                label={m.role.toUpperCase()}
                size="small"
                sx={{ fontFamily: MONO, fontSize: '0.6rem', height: 22, backgroundColor: roleColors[m.role] + '20', color: roleColors[m.role], '& .MuiChip-icon': { color: 'inherit' } }}
              />
              {m.role !== 'owner' && (
                <select
                  value={m.role}
                  onChange={(e) => updateRole.mutate({ user_id: m.user_id, role: e.target.value })}
                  style={{ padding: '2px 6px', backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderRadius: '4px', color: '#c1c6d7', fontFamily: MONO, fontSize: '0.6rem' }}
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              )}
            </Box>
          </Box>
        );
      })}
    </Paper>
  );
}

/* ── Shared Resources ─────────────────────────────────── */
function SharedResourcesPanel({ resources }: { resources: any[] }) {
  const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    prompt: FileText, workflow: GitBranch, dataset: Database, model_config: Settings,
  };
  const typeColors: Record<string, string> = { prompt: '#4b8eff', workflow: '#adc6ff', dataset: '#53e16f', model_config: '#ffb595' };

  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Shared Resources ({resources.length})</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            {['Resource', 'Type', 'Shared By', 'Permission', 'Version', 'Updated'].map(h => (
              <TableCell key={h} sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.65rem', borderColor: '#2a2a2a' }}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {resources.map((r: any) => {
            const Icon = typeIcons[r.type] || FileText;
            return (
              <TableRow key={r.id} sx={{ '&:hover': { backgroundColor: '#201f1f' } }}>
                <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.8rem', borderColor: '#2a2a2a' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ color: typeColors[r.type], display: 'flex' }}><Icon className="w-3 h-3" /></Box>
                    {r.name}
                  </Box>
                </TableCell>
                <TableCell sx={{ borderColor: '#2a2a2a' }}>
                  <Chip label={r.type} size="small" sx={{ fontFamily: MONO, fontSize: '0.6rem', height: 20, backgroundColor: typeColors[r.type] + '20', color: typeColors[r.type] }} />
                </TableCell>
                <TableCell sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.75rem', borderColor: '#2a2a2a' }}>{r.shared_by}</TableCell>
                <TableCell sx={{ borderColor: '#2a2a2a' }}>
                  <Chip label={r.permission} size="small" sx={{ fontFamily: MONO, fontSize: '0.6rem', height: 20, backgroundColor: '#2a2a2a', color: '#c1c6d7' }} />
                </TableCell>
                <TableCell sx={{ color: '#e5e2e1', fontFamily: MONO, fontSize: '0.75rem', borderColor: '#2a2a2a' }}>v{r.version}</TableCell>
                <TableCell sx={{ color: '#c1c6d7', fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a' }}>
                  {new Date(r.updated_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );
}

/* ── Audit Log ────────────────────────────────────────── */
function AuditLogPanel({ entries }: { entries: any[] }) {
  const actionColors: Record<string, string> = {
    created: '#53e16f', shared: '#4b8eff', edited: '#ffb595', commented: '#adc6ff',
    deployed: '#53e16f', invited: '#4b8eff', updated: '#ffb595',
  };

  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Activity Log</Typography>
      {(entries || []).map((e: any) => (
        <Box key={e.id} sx={{ p: 1.5, mb: 0.5, backgroundColor: '#0e0e0e', borderRadius: '4px', border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: actionColors[e.action] || '#c1c6d7', flexShrink: 0 }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.75rem', fontFamily: MONO, color: '#e5e2e1' }}>
              <span style={{ fontWeight: 600 }}>{e.user_name}</span>{' '}
              <span style={{ color: actionColors[e.action] || '#c1c6d7' }}>{e.action}</span>{' '}
              {e.resource}
            </Typography>
            <Typography sx={{ fontSize: '0.6rem', fontFamily: MONO, color: '#c1c6d7' }}>{e.details}</Typography>
          </Box>
          <Typography sx={{ fontSize: '0.6rem', fontFamily: MONO, color: '#414755', whiteSpace: 'nowrap' }}>
            {new Date(e.timestamp).toLocaleTimeString()}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
}

/* ── Add Member Form ──────────────────────────────────── */
function AddMemberForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const addMember = useMutation({
    mutationFn: async () => {
      await api.post('/api/v1/collab/members/add', { workspace_id: 'ws-1', name, email, role: 'viewer' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-workspace'] });
      queryClient.invalidateQueries({ queryKey: ['collab-stats'] });
      setName(''); setEmail('');
    },
  });

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      backgroundColor: '#0e0e0e', color: '#e5e2e1', fontFamily: MONO, fontSize: '0.8rem',
      '& fieldset': { borderColor: '#2a2a2a' },
    },
  };

  return (
    <Paper elevation={0} sx={{ p: 3, backgroundColor: '#201f1f', border: '1px solid #2a2a2a', borderRadius: '8px' }}>
      <Typography sx={{ ...sectionLabelSx, mb: 2 }}>Invite Member</Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField size="small" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} sx={inputSx} />
        <TextField size="small" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ ...inputSx, flex: 1 }} />
        <Button
          size="small" variant="outlined"
          onClick={() => addMember.mutate()}
          disabled={addMember.isPending || !name || !email}
          sx={{ fontFamily: MONO, fontSize: '0.7rem', borderColor: '#2a2a2a', color: '#4b8eff', textTransform: 'none' }}
        >
          <UserPlus className="w-3 h-3" style={{ marginRight: 4 }} /> Invite
        </Button>
      </Box>
      {addMember.isSuccess && <Alert severity="success" sx={{ mt: 1, backgroundColor: '#0e0e0e', border: '1px solid #2a2a2a', '& .MuiAlert-message': { fontFamily: MONO, fontSize: '0.7rem', color: '#53e16f' } }}>Member invited successfully</Alert>}
    </Paper>
  );
}

/* ── Main Page ────────────────────────────────────────── */
export default function CollaborationPage() {
  const { data: stats, isLoading } = useCollabStats();
  const { data: workspace } = useWorkspace();
  const { data: resourceData } = useSharedResources();
  const { data: auditData } = useAuditLog();

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}><CircularProgress size={32} /></Box>;
  }

  const members = workspace?.members || [];
  const resources = resourceData?.resources || [];
  const auditEntries = auditData?.entries || [];

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>      <PageHeader title="Collaboration" subtitle="Team workspaces, shared resources, and activity tracking" />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={Users} label="Members" value={stats?.total_members || 0} accent="#4b8eff" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={Activity} label="Active" value={stats?.active_members || 0} accent="#53e16f" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={FileText} label="Shared Resources" value={stats?.shared_resources || 0} accent="#adc6ff" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><KpiCard icon={MessageSquare} label="Messages" value={stats?.messages_exchanged || 0} accent="#ffb595" /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <MembersPanel members={members} />
          <Box sx={{ mt: 2 }}><AddMemberForm /></Box>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <SharedResourcesPanel resources={resources} />
          <Box sx={{ mt: 2 }}><AuditLogPanel entries={auditEntries} /></Box>
        </Grid>
      </Grid>
    </Box>
  );
}
