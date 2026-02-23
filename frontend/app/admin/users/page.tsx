'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userManagementAPI } from '@/lib/api';
import api from '@/lib/api';
import {
  Users, Shield, Search, Trash2, UserPlus,
  Activity, X, Check,
  AlertTriangle, Crown, Code, Eye, User as UserIcon
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import CircularProgress from '@mui/material/CircularProgress';

interface UserData {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  active: boolean;
  created_at: string;
}

interface ActivityLogEntry {
  id: string;
  user_id: string;
  username: string;
  action: string;
  details: string;
  ip_address: string;
  created_at: string;
}

interface UserStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  admins: number;
  developers: number;
  viewers: number;
  regular_users: number;
  logins_last_24h: number;
}

const ROLE_CONFIG: Record<string, { label: string; chipColor: string; chipBg: string; icon: any }> = {
  admin: { label: 'Admin', chipColor: '#b91c1c', chipBg: '#fef2f2', icon: Crown },
  developer: { label: 'Developer', chipColor: '#1d4ed8', chipBg: '#eff6ff', icon: Code },
  viewer: { label: 'Viewer', chipColor: '#374151', chipBg: '#f9fafb', icon: Eye },
  user: { label: 'User', chipColor: '#15803d', chipBg: '#ecfdf5', icon: UserIcon },
};

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create user modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: '', username: '', password: '', first_name: '', last_name: '', role: 'user',
  });
  const [creating, setCreating] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [usersRes, statsRes, logsRes] = await Promise.all([
        userManagementAPI.listUsers().catch(() => null),
        userManagementAPI.getUserStats().catch(() => null),
        userManagementAPI.getActivityLogs({ limit: 50 }).catch(() => null),
      ]);

      if (usersRes?.data?.data?.users) {
        setUsers(usersRes.data.data.users);
      }
      if (statsRes?.data?.data) {
        setStats(statsRes.data.data);
      }
      if (logsRes?.data?.data?.logs) {
        setActivityLogs(logsRes.data.data.logs);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setError('');
      await userManagementAPI.updateRole(userId, newRole);
      setSuccess(`Role updated to ${newRole}`);
      setEditingRole(null);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      setError('');
      await userManagementAPI.deleteUser(userId);
      setSuccess('User deleted successfully');
      setConfirmDelete(null);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      await userManagementAPI.updateUser({ user_id: userId, active: !currentActive });
      setSuccess(`User ${currentActive ? 'deactivated' : 'activated'}`);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update user');
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchData();
      return;
    }
    try {
      const res = await userManagementAPI.searchUsers(searchQuery);
      if (res.data?.data?.users) {
        setUsers(res.data.data.users);
      }
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await api.post('/api/v1/auth/register', {
        email: createForm.email,
        username: createForm.username,
        password: createForm.password,
        first_name: createForm.first_name,
        last_name: createForm.last_name,
      });

      const newUserId = res.data?.data?.user?.id;

      if (createForm.role !== 'user' && newUserId) {
        await userManagementAPI.updateRole(newUserId, createForm.role);
      }

      setSuccess('User created successfully');
      setShowCreateModal(false);
      setCreateForm({ email: '', username: '', password: '', first_name: '', last_name: '', role: 'user' });
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const getActionChipColor = (action: string): { bg: string; color: string } => {
    if (action.includes('delete')) return { bg: '#fef2f2', color: '#dc2626' };
    if (action.includes('role')) return { bg: '#f5f3ff', color: '#7c3aed' };
    if (action.includes('login')) return { bg: '#ecfdf5', color: '#16a34a' };
    if (action.includes('create')) return { bg: '#eff6ff', color: '#2563eb' };
    return { bg: '#f9fafb', color: '#4b5563' };
  };

  if (!currentUser) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 }, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Shield style={{ width: 64, height: 64, color: '#d1d5db', margin: '0 auto 16px' }} />
          <Typography variant="h5" sx={{ fontWeight: 700, color: '#374151' }}>Access Denied</Typography>
          <Typography sx={{ color: '#6b7280', mt: 1 }}>You must be logged in as an admin to view this page.</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <PageHeader
        title="User Management"
        subtitle="Manage users, roles, and permissions"
        action={
          <Button
            variant="contained"
            startIcon={<UserPlus style={{ width: 18, height: 18 }} />}
            onClick={() => setShowCreateModal(true)}
            sx={{ textTransform: 'none', borderRadius: '8px' }}
          >
            Create User
          </Button>
        }
      />

      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2, borderRadius: '8px' }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: '8px' }}>
          {success}
        </Alert>
      )}

      {/* Stats Cards */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<Users style={{ width: 20, height: 20 }} />}
              label="Total Users"
              value={stats.total_users}
              color="blue"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<Activity style={{ width: 20, height: 20 }} />}
              label="Active Users"
              value={stats.active_users}
              color="green"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<Crown style={{ width: 20, height: 20 }} />}
              label="Admins"
              value={stats.admins}
              color="red"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <StatCard
              icon={<Shield style={{ width: 20, height: 20 }} />}
              label="Logins (24h)"
              value={stats.logins_last_24h}
              color="purple"
            />
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            px: 2,
            borderBottom: '1px solid #e5e7eb',
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.875rem' },
          }}
        >
          <Tab icon={<Users style={{ width: 16, height: 16 }} />} iconPosition="start" label="Users" />
          <Tab icon={<Activity style={{ width: 16, height: 16 }} />} iconPosition="start" label="Activity Log" />
        </Tabs>

        {/* Users Tab */}
        {activeTab === 0 && (
          <>
            {/* Search Bar */}
            <Box sx={{ p: 2, borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 1.5 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Search by email, username, or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search style={{ width: 16, height: 16, color: '#9ca3af' }} />
                    </InputAdornment>
                  ),
                }}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
              />
              <Button
                variant="contained"
                onClick={handleSearch}
                sx={{ textTransform: 'none', borderRadius: '8px', px: 3 }}
              >
                Search
              </Button>
            </Box>

            {/* Users Table */}
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>User</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Role</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Joined</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: 'center', py: 6 }}>
                        <CircularProgress size={24} sx={{ mr: 1 }} />
                        <Typography component="span" sx={{ color: '#9ca3af' }}>Loading users...</Typography>
                      </TableCell>
                    </TableRow>
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} sx={{ textAlign: 'center', py: 6 }}>
                        <Typography sx={{ color: '#9ca3af' }}>No users found</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => {
                      const roleConfig = ROLE_CONFIG[u.role] || ROLE_CONFIG.user;
                      const RoleIcon = roleConfig.icon;
                      const isCurrentUser = currentUser?.email === u.email;

                      return (
                        <TableRow key={u.id} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Avatar
                                sx={{
                                  width: 36,
                                  height: 36,
                                  background: 'linear-gradient(135deg, #3b82f6, #9333ea)',
                                  fontSize: '0.875rem',
                                  fontWeight: 700,
                                }}
                              >
                                {(u.first_name?.[0] || u.username[0]).toUpperCase()}
                              </Avatar>
                              <Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography sx={{ fontWeight: 500, fontSize: '0.875rem', color: '#111827' }}>
                                    {u.first_name} {u.last_name}
                                  </Typography>
                                  {isCurrentUser && (
                                    <Chip
                                      label="You"
                                      size="small"
                                      sx={{ height: 20, fontSize: '0.7rem', backgroundColor: '#dbeafe', color: '#1d4ed8' }}
                                    />
                                  )}
                                </Box>
                                <Typography sx={{ fontSize: '0.8rem', color: '#6b7280' }}>
                                  @{u.username} &middot; {u.email}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            {editingRole === u.id ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Select
                                  size="small"
                                  defaultValue={u.role}
                                  onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                  sx={{ fontSize: '0.8rem', borderRadius: '8px', minWidth: 100 }}
                                >
                                  <MenuItem value="user">User</MenuItem>
                                  <MenuItem value="developer">Developer</MenuItem>
                                  <MenuItem value="viewer">Viewer</MenuItem>
                                  <MenuItem value="admin">Admin</MenuItem>
                                </Select>
                                <IconButton size="small" onClick={() => setEditingRole(null)}>
                                  <X style={{ width: 16, height: 16 }} />
                                </IconButton>
                              </Box>
                            ) : (
                              <Chip
                                icon={<RoleIcon style={{ width: 12, height: 12 }} />}
                                label={roleConfig.label}
                                size="small"
                                onClick={() => !isCurrentUser && setEditingRole(u.id)}
                                title={isCurrentUser ? "Can't change own role" : 'Click to change role'}
                                sx={{
                                  backgroundColor: roleConfig.chipBg,
                                  color: roleConfig.chipColor,
                                  border: '1px solid',
                                  borderColor: roleConfig.chipColor + '30',
                                  fontWeight: 500,
                                  fontSize: '0.75rem',
                                  cursor: isCurrentUser ? 'default' : 'pointer',
                                  '&:hover': isCurrentUser ? {} : { opacity: 0.8 },
                                }}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={u.active ? 'Active' : 'Inactive'}
                              size="small"
                              onClick={() => !isCurrentUser && handleToggleActive(u.id, u.active)}
                              title={isCurrentUser ? "Can't deactivate yourself" : 'Click to toggle'}
                              sx={{
                                backgroundColor: u.active ? '#ecfdf5' : '#fef2f2',
                                color: u.active ? '#15803d' : '#b91c1c',
                                border: '1px solid',
                                borderColor: u.active ? '#bbf7d0' : '#fecaca',
                                fontWeight: 500,
                                fontSize: '0.75rem',
                                cursor: isCurrentUser ? 'default' : 'pointer',
                                '&::before': {
                                  content: '""',
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  backgroundColor: u.active ? '#22c55e' : '#ef4444',
                                  display: 'inline-block',
                                  marginRight: '6px',
                                },
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontSize: '0.8rem', color: '#6b7280' }}>
                              {formatDate(u.created_at)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            {!isCurrentUser && (
                              <>
                                {confirmDelete === u.id ? (
                                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                                    <Typography sx={{ fontSize: '0.75rem', color: '#dc2626', mr: 0.5 }}>Delete?</Typography>
                                    <IconButton size="small" onClick={() => handleDeleteUser(u.id)} sx={{ color: '#dc2626' }}>
                                      <Check style={{ width: 16, height: 16 }} />
                                    </IconButton>
                                    <IconButton size="small" onClick={() => setConfirmDelete(null)}>
                                      <X style={{ width: 16, height: 16 }} />
                                    </IconButton>
                                  </Box>
                                ) : (
                                  <IconButton
                                    size="small"
                                    onClick={() => setConfirmDelete(u.id)}
                                    title="Delete user"
                                    sx={{ color: '#9ca3af', '&:hover': { color: '#dc2626', backgroundColor: '#fef2f2' } }}
                                  >
                                    <Trash2 style={{ width: 16, height: 16 }} />
                                  </IconButton>
                                )}
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Role Legend */}
            <Box
              sx={{
                px: 3,
                py: 1.5,
                borderTop: '1px solid #e5e7eb',
                backgroundColor: '#f9fafb',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: '#6b7280' }}>Roles:</Typography>
              {Object.entries(ROLE_CONFIG).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Icon style={{ width: 12, height: 12, color: config.chipColor }} />
                    <Typography sx={{ fontSize: '0.75rem', color: config.chipColor }}>{config.label}</Typography>
                  </Box>
                );
              })}
            </Box>
          </>
        )}

        {/* Activity Log Tab */}
        {activeTab === 1 && (
          <Box>
            <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #e5e7eb' }}>
              <Typography sx={{ fontWeight: 600, color: '#111827' }}>Recent Activity</Typography>
              <Typography sx={{ fontSize: '0.8rem', color: '#6b7280' }}>
                Audit trail of user actions across the platform
              </Typography>
            </Box>
            {activityLogs.length === 0 ? (
              <Box sx={{ px: 3, py: 6, textAlign: 'center' }}>
                <Activity style={{ width: 48, height: 48, color: '#d1d5db', margin: '0 auto 12px' }} />
                <Typography sx={{ color: '#9ca3af' }}>No activity logs yet</Typography>
                <Typography sx={{ fontSize: '0.8rem', color: '#9ca3af', mt: 0.5 }}>
                  Actions like role changes and user updates will appear here
                </Typography>
              </Box>
            ) : (
              activityLogs.map((log) => {
                const chipColors = getActionChipColor(log.action);
                return (
                  <Box
                    key={log.id}
                    sx={{
                      px: 3,
                      py: 1.5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      borderBottom: '1px solid #f3f4f6',
                      '&:hover': { backgroundColor: '#f9fafb' },
                    }}
                  >
                    <Chip
                      label={log.action.replace(/_/g, ' ')}
                      size="small"
                      sx={{
                        backgroundColor: chipColors.bg,
                        color: chipColors.color,
                        fontWeight: 500,
                        fontSize: '0.7rem',
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 500, color: '#111827' }}>
                        @{log.username}
                      </Typography>
                      {log.details && (
                        <Typography component="span" sx={{ fontSize: '0.8rem', color: '#6b7280', ml: 1 }}>
                          {log.details}
                        </Typography>
                      )}
                    </Box>
                    <Typography sx={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {formatDate(log.created_at)}
                    </Typography>
                  </Box>
                );
              })
            )}
          </Box>
        )}
      </Paper>

      {/* Create User Modal */}
      <Dialog
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <UserPlus style={{ width: 20, height: 20, color: '#2563eb' }} />
          Create New User
        </DialogTitle>
        <form onSubmit={handleCreateUser}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="First Name"
                  value={createForm.first_name}
                  onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                  placeholder="John"
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  size="small"
                  fullWidth
                  label="Last Name"
                  value={createForm.last_name}
                  onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
                  placeholder="Doe"
                />
              </Grid>
            </Grid>
            <TextField
              size="small"
              fullWidth
              label="Email"
              type="email"
              required
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              placeholder="john@example.com"
            />
            <TextField
              size="small"
              fullWidth
              label="Username"
              required
              value={createForm.username}
              onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
              placeholder="johndoe"
            />
            <TextField
              size="small"
              fullWidth
              label="Password"
              type="password"
              required
              inputProps={{ minLength: 8 }}
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              placeholder="Min 8 characters"
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                label="Role"
                value={createForm.role}
                onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
              >
                <MenuItem value="user">User</MenuItem>
                <MenuItem value="developer">Developer</MenuItem>
                <MenuItem value="viewer">Viewer</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => setShowCreateModal(false)}
              sx={{ textTransform: 'none', borderRadius: '8px', flex: 1 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={creating}
              sx={{ textTransform: 'none', borderRadius: '8px', flex: 1 }}
            >
              {creating ? 'Creating...' : 'Create User'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
