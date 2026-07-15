'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { User, Mail, Calendar, Shield, Lock, LogOut } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import axios from 'axios';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import { API_BASE } from '@/lib/config';

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    username: '',
  });

  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        username: user.username || '',
      });
    }
  }, [user]);

  if (authLoading || !user) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 }, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={40} />
          <Typography sx={{ mt: 2, color: 'text.secondary' }}>Loading profile...</Typography>
        </Box>
      </Box>
    );
  }

  const handleUpdateProfile = async () => {
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      const response = await axios.put(`${API_BASE}/auth/profile/update`, formData);
      setSuccess('Profile updated successfully!');
      setIsEditing(false);

      const updatedUser = response.data.data;
      localStorage.setItem('user', JSON.stringify(updatedUser));

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordData.new_password !== passwordData.confirm_password) {
      setError('New passwords do not match');
      return;
    }

    if (passwordData.new_password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    try {
      await axios.post(`${API_BASE}/auth/password/change`, {
        old_password: passwordData.old_password,
        new_password: passwordData.new_password,
      });

      setSuccess('Password changed successfully!');
      setPasswordData({ old_password: '', new_password: '', confirm_password: '' });

      setTimeout(() => {
        setSuccess('');
        setIsChangingPassword(false);
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password');
    }
  };

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  const getRoleChipProps = (role: string) => {
    switch (role) {
      case 'admin':
        return { bg: 'rgba(239,68,68,0.1)', color: 'error.dark' };
      case 'developer':
        return { bg: 'rgba(139,92,246,0.1)', color: '#8b5cf6' };
      default:
        return { bg: 'rgba(173,198,255,0.1)', color: '#adc6ff' };
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const roleChip = getRoleChipProps(user.role);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 800, mx: 'auto' }}>
      <PageHeader
        title="Profile"
        subtitle="Manage your account settings"
        action={
          <Button
            variant="outlined"
            color="error"
            startIcon={<LogOut style={{ width: 16, height: 16 }} />}
            onClick={handleLogout}
            sx={{ textTransform: 'none', borderRadius: '8px' }}
          >
            Logout
          </Button>
        }
      />

      {/* Alerts */}
      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: '8px' }}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2, borderRadius: '8px' }}>
          {error}
        </Alert>
      )}

      {/* Profile Information Card */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'var(--font-mono)' }}>
            Profile Information
          </Typography>
          {!isEditing ? (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setIsEditing(true)}
              sx={{ textTransform: 'none', borderRadius: '8px' }}
            >
              Edit
            </Button>
          ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    first_name: user.first_name || '',
                    last_name: user.last_name || '',
                    username: user.username || '',
                  });
                }}
                sx={{ textTransform: 'none', borderRadius: '8px' }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={handleUpdateProfile}
                disabled={isSaving}
                sx={{ textTransform: 'none', borderRadius: '8px' }}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </Box>
          )}
        </Box>

        {/* Avatar Section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, pb: 3, mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Avatar
            sx={{
              width: 72,
              height: 72,
              background: 'linear-gradient(135deg, #adc6ff, #8b5cf6)',
              fontSize: '1.75rem',
              fontWeight: 700,
            }}
          >
            {user.first_name?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || 'U'}
          </Avatar>
          <Box>
            <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'var(--font-mono)' }}>
              {user.first_name || user.last_name
                ? `${user.first_name} ${user.last_name}`.trim()
                : user.username}
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>{user.email}</Typography>
            <Chip
              label={user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              size="small"
              sx={{
                mt: 0.5,
                backgroundColor: roleChip.bg,
                color: roleChip.color,
                fontWeight: 500,
                fontSize: '0.75rem',
              }}
            />
          </Box>
        </Box>

        {/* Editable Fields */}
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: 'text.primary', mb: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <User style={{ width: 14, height: 14 }} />
              First Name
            </Typography>
            {isEditing ? (
              <TextField
                size="small"
                fullWidth
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                placeholder="John"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
              />
            ) : (
              <Typography sx={{ color: 'text.primary' }}>{user.first_name || 'Not set'}</Typography>
            )}
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: 'text.primary', mb: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <User style={{ width: 14, height: 14 }} />
              Last Name
            </Typography>
            {isEditing ? (
              <TextField
                size="small"
                fullWidth
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                placeholder="Doe"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
              />
            ) : (
              <Typography sx={{ color: 'text.primary' }}>{user.last_name || 'Not set'}</Typography>
            )}
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: 'text.primary', mb: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Mail style={{ width: 14, height: 14 }} />
              Email
            </Typography>
            <Typography sx={{ color: 'text.primary' }}>{user.email}</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', mt: 0.25 }}>Email cannot be changed</Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: 'text.primary', mb: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Shield style={{ width: 14, height: 14 }} />
              Username
            </Typography>
            <Typography sx={{ color: 'text.primary' }}>{user.username}</Typography>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', mt: 0.25 }}>Username cannot be changed</Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: 'text.primary', mb: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Calendar style={{ width: 14, height: 14 }} />
              Member Since
            </Typography>
            <Typography sx={{ color: 'text.primary' }}>{formatDate(user.created_at)}</Typography>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: 'text.primary', mb: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Shield style={{ width: 14, height: 14 }} />
              Account Status
            </Typography>
            <Chip
              label={user.active ? 'Active' : 'Inactive'}
              size="small"
              sx={{
                backgroundColor: user.active ? 'rgba(83,225,111,0.1)' : 'rgba(239,68,68,0.1)',
                color: user.active ? '#53e16f' : '#ef4444',
                fontWeight: 500,
                fontSize: '0.75rem',
              }}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Change Password Card */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'var(--font-mono)' }}>
              Change Password
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', mt: 0.25 }}>
              Update your password to keep your account secure
            </Typography>
          </Box>
          {!isChangingPassword && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<Lock style={{ width: 14, height: 14 }} />}
              onClick={() => setIsChangingPassword(true)}
              sx={{ textTransform: 'none', borderRadius: '8px' }}
            >
              Change Password
            </Button>
          )}
        </Box>

        {isChangingPassword && (
          <form onSubmit={handleChangePassword}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                size="small"
                fullWidth
                label="Current Password"
                type="password"
                value={passwordData.old_password}
                onChange={(e) => setPasswordData({ ...passwordData, old_password: e.target.value })}
                required
                placeholder="Enter current password"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
              />
              <TextField
                size="small"
                fullWidth
                label="New Password"
                type="password"
                value={passwordData.new_password}
                onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                required
                placeholder="Min 8 characters"
                helperText="Must be at least 8 characters"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
              />
              <TextField
                size="small"
                fullWidth
                label="Confirm New Password"
                type="password"
                value={passwordData.confirm_password}
                onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                required
                placeholder="Re-enter new password"
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
              />
              <Box sx={{ display: 'flex', gap: 1, pt: 1 }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
                    setError('');
                  }}
                  sx={{ textTransform: 'none', borderRadius: '8px' }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  sx={{ textTransform: 'none', borderRadius: '8px' }}
                >
                  Update Password
                </Button>
              </Box>
            </Box>
          </form>
        )}
      </Paper>

      {/* Account Info Card */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
        <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'var(--font-mono)', mb: 2.5 }}>
          Account Information
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>User ID:</Typography>
            <Typography sx={{ fontSize: '0.875rem', fontFamily: 'monospace', color: 'text.primary' }}>{user.id}</Typography>
          </Box>
          <Divider />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>Role:</Typography>
            <Typography sx={{ fontSize: '0.875rem', color: 'text.primary' }}>{user.role}</Typography>
          </Box>
          <Divider />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>Account Created:</Typography>
            <Typography sx={{ fontSize: '0.875rem', color: 'text.primary' }}>{formatDate(user.created_at)}</Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
