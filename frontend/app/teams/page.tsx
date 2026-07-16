'use client';

import { useState, useEffect, useCallback } from 'react';
import { userManagementAPI } from '@/lib/api';
import {
  Users, Plus, Trash2, UserPlus, UserMinus, Crown, Shield,
  User, ChevronDown, ChevronRight, Search, RefreshCw
} from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Collapse from '@mui/material/Collapse';
import Avatar from '@mui/material/Avatar';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';

/* ─────────────── Types ─────────────── */
interface Team {
  id: string;
  name: string;
  description: string;
  created_by: string;
  created_at: string;
}

interface TeamMember {
  member_id: string;
  team_role: string;
  joined_at: string;
  user: {
    id: string;
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
    role: string;
  };
}

interface UserOption {
  id: string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

/* ─────────────── Helpers ─────────────── */
const ROLE_CONFIG = {
  owner:  { label: 'Owner',  icon: Crown,  bg: 'rgba(255,181,149,0.1)', color: '#ffb595' },
  admin:  { label: 'Admin',  icon: Shield, bg: 'rgba(173,198,255,0.1)', color: '#adc6ff' },
  member: { label: 'Member', icon: User,   bg: 'action.hover', color: 'text.primary' },
};

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG] ?? ROLE_CONFIG.member;
  const Icon = cfg.icon;
  return (
    <Chip
      icon={<Icon size={12} />}
      label={cfg.label}
      size="small"
      sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 600, fontSize: '0.72rem', height: 22, '& .MuiChip-icon': { color: cfg.color } }}
    />
  );
}

function initials(u: TeamMember['user']) {
  if (u.first_name || u.last_name) return `${u.first_name?.[0] ?? ''}${u.last_name?.[0] ?? ''}`.toUpperCase();
  return u.username?.[0]?.toUpperCase() ?? '?';
}

function avatarColor(name: string) {
  const colors = ['#adc6ff', '#4b8eff', '#53e16f', '#ffb595', '#ef4444', '#4b8eff'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--';

/* ─────────────── Page ─────────────── */
export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [membersMap, setMembersMap] = useState<Record<string, TeamMember[]>>({});
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create team dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Add member dialog
  const [addMemberTeam, setAddMemberTeam] = useState<Team | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [addRole, setAddRole] = useState('member');
  const [adding, setAdding] = useState(false);

  // Delete confirm
  const [deleteTeam, setDeleteTeam] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ─── Fetch ─── */
  const fetchTeams = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await userManagementAPI.listTeams();
      const list = res.data?.data?.teams || res.data?.data || [];
      setTeams(Array.isArray(list) ? list : []);
    } catch {
      setError('Failed to load teams');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMembers = useCallback(async (teamId: string) => {
    setMembersLoading(teamId);
    try {
      const res = await userManagementAPI.getTeamMembers(teamId);
      const list = res.data?.data?.members || res.data?.data || [];
      setMembersMap(prev => ({ ...prev, [teamId]: Array.isArray(list) ? list : [] }));
    } catch {
      setMembersMap(prev => ({ ...prev, [teamId]: [] }));
    } finally {
      setMembersLoading(null);
    }
  }, []);

  const fetchAllUsers = useCallback(async () => {
    try {
      const res = await userManagementAPI.listUsers({ limit: 200 });
      const list = res.data?.data?.users || res.data?.data || [];
      setAllUsers(Array.isArray(list) ? list : []);
    } catch { setAllUsers([]); }
  }, []);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  /* ─── Toggle expand ─── */
  const handleToggleExpand = (teamId: string) => {
    if (expandedTeam === teamId) {
      setExpandedTeam(null);
    } else {
      setExpandedTeam(teamId);
      if (!membersMap[teamId]) fetchMembers(teamId);
    }
  };

  /* ─── Create team ─── */
  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await userManagementAPI.createTeam(newName.trim(), newDesc.trim());
      setSuccess(`Team "${newName}" created`);
      setCreateOpen(false);
      setNewName('');
      setNewDesc('');
      fetchTeams();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to create team');
    } finally {
      setCreating(false);
    }
  };

  /* ─── Delete team ─── */
  const handleDelete = async () => {
    if (!deleteTeam) return;
    setDeleting(true);
    try {
      await userManagementAPI.deleteTeam(deleteTeam.id);
      setSuccess(`Team "${deleteTeam.name}" deleted`);
      setDeleteTeam(null);
      setExpandedTeam(null);
      setMembersMap(prev => { const next = { ...prev }; delete next[deleteTeam.id]; return next; });
      fetchTeams();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to delete team');
    } finally {
      setDeleting(false);
    }
  };

  /* ─── Add member ─── */
  const handleOpenAddMember = (team: Team) => {
    setAddMemberTeam(team);
    setSelectedUser('');
    setAddRole('member');
    setUserSearch('');
    fetchAllUsers();
  };

  const handleAddMember = async () => {
    if (!addMemberTeam || !selectedUser) return;
    setAdding(true);
    try {
      await userManagementAPI.addTeamMember(addMemberTeam.id, selectedUser, addRole);
      setSuccess('Member added');
      setAddMemberTeam(null);
      fetchMembers(addMemberTeam.id);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  /* ─── Remove member ─── */
  const handleRemoveMember = async (teamId: string, userId: string, username: string) => {
    try {
      await userManagementAPI.removeTeamMember(teamId, userId);
      setSuccess(`Removed ${username} from team`);
      fetchMembers(teamId);
      setTimeout(() => setSuccess(''), 3000);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to remove member');
    }
  };

  /* ─── Stats ─── */
  const totalMembers = Object.values(membersMap).reduce((sum, m) => sum + m.length, 0);
  const filteredUsers = allUsers.filter(u =>
    !userSearch || u.username.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  // Exclude users already in the team
  const currentMembers = addMemberTeam ? (membersMap[addMemberTeam.id] ?? []) : [];
  const currentMemberIds = new Set(currentMembers.map(m => m.user?.id));
  const availableUsers = filteredUsers.filter(u => !currentMemberIds.has(u.id));

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: '1100px', mx: 'auto' }}>
      <PageHeader
        title="Team Management"
        subtitle="Create and manage teams, assign members and roles"
        action={
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => setCreateOpen(true)}
            sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600, bgcolor: '#adc6ff', color: '#131313', '&:hover': { bgcolor: 'primary.dark', color: '#131313' } }}
          >
            New Team
          </Button>
        }
      />

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2, borderRadius: '10px' }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2, borderRadius: '10px' }}>{success}</Alert>}

      {/* Stats */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard label="Total Teams" value={teams.length} icon={<Users size={20} />} color="blue" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard label="Members Loaded" value={totalMembers} icon={<User size={20} />} color="purple" />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <StatCard
            label="Avg Team Size"
            value={teams.length > 0 && totalMembers > 0 ? (totalMembers / teams.length).toFixed(1) : '--'}
            icon={<Shield size={20} />}
            color="green"
          />
        </Grid>
      </Grid>

      {/* Team List */}
      {loading ? (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 4, textAlign: 'center' }}>
          <CircularProgress size={28} />
          <Typography sx={{ mt: 1, color: 'text.disabled' }}>Loading teams…</Typography>
        </Paper>
      ) : teams.length === 0 ? (
        <Paper elevation={0} sx={{ border: '2px dashed var(--mui-palette-divider)', borderRadius: '8px', p: 6, textAlign: 'center' }}>
          <Users size={48} color="var(--mui-palette-text-disabled)" />
          <Typography variant="h6" sx={{ mt: 2, color: 'text.disabled', fontWeight: 500 }}>No teams yet</Typography>
          <Typography variant="body2" sx={{ color: 'text.disabled', mt: 0.5 }}>Create your first team to start collaborating</Typography>
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => setCreateOpen(true)}
            sx={{ mt: 3, textTransform: 'none', borderRadius: '8px', fontWeight: 600 }}
          >
            Create Team
          </Button>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {teams.map((team) => {
            const isExpanded = expandedTeam === team.id;
            const members = membersMap[team.id] ?? [];
            const isLoadingMembers = membersLoading === team.id;

            return (
              <Paper
                key={team.id}
                elevation={0}
                sx={{
                  border: `1px solid ${isExpanded ? 'rgba(173,198,255,0.3)' : 'var(--mui-palette-divider)'}`,
                  borderRadius: '8px',
                  overflow: 'hidden',
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Team Header */}
                <Box
                  onClick={() => handleToggleExpand(team.id)}
                  sx={{
                    p: 2.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    cursor: 'pointer',
                    bgcolor: isExpanded ? 'rgba(173,198,255,0.1)' : '#1c1b1b',
                    transition: 'background-color 0.15s',
                    '&:hover': { bgcolor: isExpanded ? 'rgba(173,198,255,0.1)' : 'background.default' },
                  }}
                >
                  {/* Expand icon */}
                  <Box sx={{ color: 'text.disabled', flexShrink: 0 }}>
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </Box>

                  {/* Team avatar */}
                  <Avatar
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '10px',
                      bgcolor: avatarColor(team.name),
                      fontSize: '1rem',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {team.name[0]?.toUpperCase()}
                  </Avatar>

                  {/* Team info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body1" sx={{ fontWeight: 700, color: 'text.primary' }}>{team.name}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.82rem' }} noWrap>
                      {team.description || 'No description'} · Created {fmtDate(team.created_at)}
                    </Typography>
                  </Box>

                  {/* Member preview avatars */}
                  {membersMap[team.id] && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 1 }}>
                      {membersMap[team.id].slice(0, 4).map((m) => (
                        <Tooltip key={m.member_id} title={m.user?.username}>
                          <Avatar
                            sx={{ width: 28, height: 28, fontSize: '0.7rem', fontWeight: 700, bgcolor: avatarColor(m.user?.username || ''), border: '2px solid #1c1b1b' }}
                          >
                            {initials(m.user)}
                          </Avatar>
                        </Tooltip>
                      ))}
                      {membersMap[team.id].length > 4 && (
                        <Avatar sx={{ width: 28, height: 28, fontSize: '0.65rem', bgcolor: 'divider', color: 'text.secondary', border: '2px solid #1c1b1b' }}>
                          +{membersMap[team.id].length - 4}
                        </Avatar>
                      )}
                      <Typography variant="caption" sx={{ color: 'text.secondary', ml: 0.5 }}>
                        {membersMap[team.id].length} member{membersMap[team.id].length !== 1 ? 's' : ''}
                      </Typography>
                    </Box>
                  )}

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 0.5 }} onClick={e => e.stopPropagation()}>
                    <Tooltip title="Add member">
                      <IconButton
                        size="small"
                        onClick={() => handleOpenAddMember(team)}
                        sx={{ color: '#adc6ff', '&:hover': { bgcolor: 'rgba(173,198,255,0.1)' } }}
                      >
                        <UserPlus size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Refresh members">
                      <IconButton
                        size="small"
                        onClick={() => fetchMembers(team.id)}
                        sx={{ color: 'text.secondary', '&:hover': { bgcolor: 'action.hover' } }}
                      >
                        <RefreshCw size={14} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete team">
                      <IconButton
                        size="small"
                        onClick={() => setDeleteTeam(team)}
                        sx={{ color: '#dc2626', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' } }}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                {/* Member List */}
                <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                  <Divider />
                  <Box sx={{ p: 2.5 }}>
                    {isLoadingMembers ? (
                      <Box sx={{ textAlign: 'center', py: 3 }}>
                        <CircularProgress size={20} />
                      </Box>
                    ) : members.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 3 }}>
                        <Typography sx={{ color: 'text.disabled', fontSize: '0.875rem' }}>No members loaded</Typography>
                        <Button
                          size="small"
                          startIcon={<UserPlus size={14} />}
                          onClick={() => handleOpenAddMember(team)}
                          sx={{ mt: 1, textTransform: 'none', color: '#adc6ff' }}
                        >
                          Add first member
                        </Button>
                      </Box>
                    ) : (
                      <Box>
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.68rem', mb: 1.5, display: 'block' }}>
                          {members.length} Member{members.length !== 1 ? 's' : ''}
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                          {members.map((m) => (
                            <Box
                              key={m.member_id}
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                                p: 1.25,
                                borderRadius: '8px',
                                border: '1px solid', borderColor: 'divider',
                                '&:hover': { bgcolor: 'background.default', '& .remove-btn': { opacity: 1 } },
                              }}
                            >
                              <Avatar
                                sx={{ width: 36, height: 36, fontSize: '0.8rem', fontWeight: 700, bgcolor: avatarColor(m.user?.username || ''), borderRadius: '8px' }}
                              >
                                {initials(m.user)}
                              </Avatar>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                                  {m.user?.first_name && m.user?.last_name
                                    ? `${m.user.first_name} ${m.user.last_name}`
                                    : m.user?.username}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  {m.user?.email} · joined {fmtDate(m.joined_at)}
                                </Typography>
                              </Box>
                              <RoleBadge role={m.team_role} />
                              <Chip
                                label={m.user?.role}
                                size="small"
                                sx={{ bgcolor: 'action.hover', color: 'text.secondary', fontSize: '0.68rem', height: 20 }}
                              />
                              <Tooltip title={`Remove ${m.user?.username}`}>
                                <IconButton
                                  size="small"
                                  className="remove-btn"
                                  onClick={() => handleRemoveMember(team.id, m.user?.id, m.user?.username)}
                                  disabled={m.team_role === 'owner'}
                                  sx={{ opacity: 0, transition: 'opacity 0.15s', color: '#dc2626', '&:hover': { bgcolor: 'rgba(239,68,68,0.1)' }, '&.Mui-disabled': { opacity: 0.3 } }}
                                >
                                  <UserMinus size={14} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          ))}
                        </Box>
                        <Button
                          size="small"
                          startIcon={<UserPlus size={14} />}
                          onClick={() => handleOpenAddMember(team)}
                          sx={{ mt: 1.5, textTransform: 'none', color: '#adc6ff', fontWeight: 600 }}
                        >
                          Add Member
                        </Button>
                      </Box>
                    )}
                  </Box>
                </Collapse>
              </Paper>
            );
          })}
        </Box>
      )}

      {/* ─── Create Team Dialog ─── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '14px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Create New Team</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Team Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            sx={{ mb: 2, mt: 0.5 }}
            onKeyDown={e => e.key === 'Enter' && !creating && handleCreate()}
          />
          <TextField
            fullWidth
            label="Description (optional)"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ textTransform: 'none', borderRadius: '8px' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600, bgcolor: '#adc6ff', color: '#131313', '&:hover': { bgcolor: 'primary.dark', color: '#131313' } }}
          >
            {creating ? <CircularProgress size={18} sx={{ color: '#131313' }} /> : 'Create Team'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Add Member Dialog ─── */}
      <Dialog open={!!addMemberTeam} onClose={() => setAddMemberTeam(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '14px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          Add Member to <span style={{ color: '#adc6ff' }}>{addMemberTeam?.name}</span>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size="small"
            placeholder="Search by username or email…"
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            InputProps={{ startAdornment: <Search size={14} style={{ marginRight: 8, color: 'text.disabled' }} /> }}
            sx={{ mb: 2, mt: 0.5, '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
          />

          {/* User list */}
          <Box sx={{ maxHeight: 220, overflowY: 'auto', mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: '8px' }}>
            {availableUsers.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant="body2" sx={{ color: 'text.disabled' }}>
                  {userSearch ? 'No users match your search' : 'No available users to add'}
                </Typography>
              </Box>
            ) : (
              availableUsers.slice(0, 20).map((u) => (
                <Box
                  key={u.id}
                  onClick={() => setSelectedUser(u.id)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.25,
                    cursor: 'pointer',
                    bgcolor: selectedUser === u.id ? 'rgba(173,198,255,0.1)' : 'transparent',
                    borderLeft: selectedUser === u.id ? '3px solid #adc6ff' : '3px solid transparent',
                    '&:hover': { bgcolor: selectedUser === u.id ? 'rgba(173,198,255,0.1)' : 'background.default' },
                  }}
                >
                  <Avatar sx={{ width: 32, height: 32, fontSize: '0.75rem', fontWeight: 700, bgcolor: avatarColor(u.username), borderRadius: '7px' }}>
                    {u.username?.[0]?.toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{u.username}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{u.email}</Typography>
                  </Box>
                  {selectedUser === u.id && <Chip label="Selected" size="small" sx={{ bgcolor: 'rgba(173,198,255,0.1)', color: '#adc6ff', fontWeight: 600, fontSize: '0.7rem', height: 20 }} />}
                </Box>
              ))
            )}
          </Box>

          <FormControl fullWidth size="small">
            <InputLabel>Team Role</InputLabel>
            <Select
              value={addRole}
              label="Team Role"
              onChange={e => setAddRole(e.target.value)}
              sx={{ borderRadius: '8px' }}
            >
              <MenuItem value="member">Member — standard access</MenuItem>
              <MenuItem value="admin">Admin — can manage members</MenuItem>
              <MenuItem value="owner">Owner — full control</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setAddMemberTeam(null)} sx={{ textTransform: 'none', borderRadius: '8px' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleAddMember}
            disabled={!selectedUser || adding}
            sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600, bgcolor: '#adc6ff', color: '#131313', '&:hover': { bgcolor: 'primary.dark', color: '#131313' } }}
          >
            {adding ? <CircularProgress size={18} sx={{ color: '#131313' }} /> : 'Add Member'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Delete Confirm Dialog ─── */}
      <Dialog open={!!deleteTeam} onClose={() => setDeleteTeam(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '14px' } }}>
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>Delete Team?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.primary' }}>
            Are you sure you want to delete <strong>{deleteTeam?.name}</strong>? This will remove all members and cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteTeam(null)} sx={{ textTransform: 'none', borderRadius: '8px' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleDelete}
            disabled={deleting}
            sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 600, bgcolor: '#dc2626', '&:hover': { bgcolor: 'error.dark' } }}
          >
            {deleting ? <CircularProgress size={18} sx={{ color: '#131313' }} /> : 'Delete Team'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
