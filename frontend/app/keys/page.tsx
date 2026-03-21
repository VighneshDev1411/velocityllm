'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { apiKeyAPI } from '@/lib/api';
import {
  Key, Plus, Copy, Check, X, Trash2, RefreshCw,
  Shield, Clock, Activity, AlertTriangle, Eye, EyeOff, Ban
} from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import FormHelperText from '@mui/material/FormHelperText';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { PageHeader } from '@/components/PageHeader';

interface APIKeyData {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string;
  rate_limit: number;
  active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  total_calls: number;
  total_tokens: number;
  created_at: string;
}

export default function APIKeysPage() {
  const { user } = useAuth();
  const [keys, setKeys] = useState<APIKeyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyRevealed, setNewKeyRevealed] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ type: string; keyId: string } | null>(null);

  // Create form
  const [createForm, setCreateForm] = useState({
    name: '',
    scopes: 'read,write',
    rate_limit: 60,
    expires_in_days: 0,
  });
  const [creating, setCreating] = useState(false);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiKeyAPI.list();
      if (res.data?.data?.keys) {
        setKeys(res.data.data.keys);
      }
    } catch (err) {
      console.error('Failed to fetch keys:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await apiKeyAPI.create({
        name: createForm.name,
        scopes: createForm.scopes,
        rate_limit: createForm.rate_limit,
        expires_in_days: createForm.expires_in_days,
      });
      const fullKey = res.data?.data?.api_key;
      if (fullKey) {
        setNewKeyRevealed(fullKey);
      }
      setShowCreateModal(false);
      setCreateForm({ name: '', scopes: 'read,write', rate_limit: 60, expires_in_days: 0 });
      setSuccess('API key created successfully');
      fetchKeys();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      await apiKeyAPI.revoke(keyId);
      setSuccess('API key revoked');
      setConfirmAction(null);
      fetchKeys();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to revoke key');
    }
  };

  const handleRotate = async (keyId: string) => {
    try {
      const res = await apiKeyAPI.rotate(keyId);
      const fullKey = res.data?.data?.api_key;
      if (fullKey) {
        setNewKeyRevealed(fullKey);
      }
      setConfirmAction(null);
      setSuccess('API key rotated — old key is now revoked');
      fetchKeys();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to rotate key');
    }
  };

  const handleDelete = async (keyId: string) => {
    try {
      await apiKeyAPI.delete(keyId);
      setSuccess('API key deleted');
      setConfirmAction(null);
      fetchKeys();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const activeKeys = keys.filter(k => k.active && !isExpired(k.expires_at));
  const inactiveKeys = keys.filter(k => !k.active || isExpired(k.expires_at));

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: '900px', mx: 'auto' }}>
      <PageHeader
        title="API Keys"
        subtitle="Manage programmatic access to VelocityLLM"
        action={
          <Button
            variant="contained"
            startIcon={<Plus size={16} />}
            onClick={() => setShowCreateModal(true)}
            sx={{ textTransform: 'none', borderRadius: '8px' }}
          >
            Create Key
          </Button>
        }
      />

      {/* Alerts */}
      {error && (
        <Alert
          severity="error"
          onClose={() => setError('')}
          sx={{ mb: 2, borderRadius: '10px' }}
        >
          {error}
        </Alert>
      )}
      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2, borderRadius: '10px' }}
        >
          {success}
        </Alert>
      )}

      {/* New Key Reveal Banner */}
      {newKeyRevealed && (
        <Alert
          severity="warning"
          icon={<AlertTriangle size={20} />}
          onClose={() => setNewKeyRevealed(null)}
          sx={{ mb: 3, borderRadius: '8px' }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
            Save your API key now
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            This key will only be shown once. Copy it and store it securely.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="code"
              sx={{
                flex: 1,
                bgcolor: 'background.paper',
                border: '1px solid #ffb595',
                px: 2,
                py: 1.25,
                borderRadius: '8px',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                color: 'text.primary',
                userSelect: 'all',
              }}
            >
              {newKeyRevealed}
            </Box>
            <IconButton
              onClick={() => copyToClipboard(newKeyRevealed)}
              size="small"
              sx={{
                bgcolor: copiedKey ? 'rgba(83,225,111,0.1)' : 'rgba(255,181,149,0.1)',
                color: copiedKey ? '#53e16f' : '#ffb595',
                '&:hover': { bgcolor: copiedKey ? '#bbf7d0' : 'rgba(255,181,149,0.2)' },
              }}
            >
              {copiedKey ? <Check size={16} /> : <Copy size={16} />}
            </IconButton>
          </Box>
        </Alert>
      )}

      {/* Usage hint */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: 2,
          border: '1px solid', borderColor: 'divider',
          borderRadius: '8px',
          bgcolor: 'background.default',
        }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>Usage:</Box>{' '}
          Include your API key in the{' '}
          <Box
            component="code"
            sx={{
              bgcolor: 'background.paper',
              px: 0.75,
              py: 0.25,
              borderRadius: '4px',
              fontSize: '0.75rem',
              border: '1px solid', borderColor: 'divider',
            }}
          >
            Authorization
          </Box>{' '}
          header:
        </Typography>
        <Box
          component="code"
          sx={{
            display: 'block',
            mt: 1,
            bgcolor: 'background.paper',
            border: '1px solid', borderColor: 'divider',
            px: 1.5,
            py: 1,
            borderRadius: '8px',
            fontSize: '0.75rem',
            fontFamily: 'monospace',
            color: 'text.primary',
          }}
        >
          curl -H &quot;Authorization: Bearer vlm_your_key_here&quot; http://localhost:8080/api/v1/completions
        </Box>
      </Paper>

      {/* Active Keys */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="overline"
          sx={{ fontWeight: 600, color: 'text.secondary', letterSpacing: '0.2em', fontFamily: 'var(--font-mono)', mb: 1.5, display: 'block' }}
        >
          Active Keys ({activeKeys.length})
        </Typography>

        {loading ? (
          <Paper
            elevation={0}
            sx={{
              border: '1px solid', borderColor: 'divider',
              borderRadius: '8px',
              p: 4,
              textAlign: 'center',
            }}
          >
            <CircularProgress size={28} />
            <Typography sx={{ mt: 1, color: 'text.disabled' }}>Loading...</Typography>
          </Paper>
        ) : activeKeys.length === 0 ? (
          <Paper
            elevation={0}
            sx={{
              border: '1px solid', borderColor: 'divider',
              borderRadius: '8px',
              p: 4,
              textAlign: 'center',
            }}
          >
            <Key size={48} color="var(--mui-palette-text-disabled)" style={{ margin: '0 auto 12px' }} />
            <Typography sx={{ color: 'text.secondary' }}>No active API keys</Typography>
            <Typography variant="body2" sx={{ color: 'text.disabled', mt: 0.5 }}>
              Create a key to get started with programmatic access
            </Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {activeKeys.map((k) => (
              <Paper
                key={k.id}
                elevation={0}
                sx={{
                  border: '1px solid', borderColor: 'divider',
                  borderRadius: '8px',
                  p: 2,
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '10px',
                        bgcolor: 'rgba(173,198,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Key size={20} color="#adc6ff" />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 500, color: 'text.primary' }}>{k.name}</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                        {k.key_prefix}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {/* Rotate */}
                    {confirmAction?.type === 'rotate' && confirmAction.keyId === k.id ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="caption" sx={{ color: '#ffb595' }}>Rotate?</Typography>
                        <IconButton size="small" onClick={() => handleRotate(k.id)} sx={{ color: '#ffb595' }}>
                          <Check size={16} />
                        </IconButton>
                        <IconButton size="small" onClick={() => setConfirmAction(null)} sx={{ color: 'text.disabled' }}>
                          <X size={16} />
                        </IconButton>
                      </Box>
                    ) : (
                      <IconButton
                        size="small"
                        onClick={() => setConfirmAction({ type: 'rotate', keyId: k.id })}
                        title="Rotate key"
                        sx={{
                          color: 'text.disabled',
                          '&:hover': { color: '#ffb595', bgcolor: 'rgba(255,181,149,0.1)' },
                        }}
                      >
                        <RefreshCw size={16} />
                      </IconButton>
                    )}
                    {/* Revoke */}
                    {confirmAction?.type === 'revoke' && confirmAction.keyId === k.id ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="caption" sx={{ color: '#dc2626' }}>Revoke?</Typography>
                        <IconButton size="small" onClick={() => handleRevoke(k.id)} sx={{ color: '#dc2626' }}>
                          <Check size={16} />
                        </IconButton>
                        <IconButton size="small" onClick={() => setConfirmAction(null)} sx={{ color: 'text.disabled' }}>
                          <X size={16} />
                        </IconButton>
                      </Box>
                    ) : (
                      <IconButton
                        size="small"
                        onClick={() => setConfirmAction({ type: 'revoke', keyId: k.id })}
                        title="Revoke key"
                        sx={{
                          color: 'text.disabled',
                          '&:hover': { color: '#dc2626', bgcolor: 'rgba(239,68,68,0.1)' },
                        }}
                      >
                        <Ban size={16} />
                      </IconButton>
                    )}
                  </Box>
                </Box>

                {/* Key metadata */}
                <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                  <Chip
                    icon={<Shield size={12} />}
                    label={k.scopes}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 24 }}
                  />
                  <Chip
                    icon={<Activity size={12} />}
                    label={`${k.rate_limit} req/min`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 24 }}
                  />
                  <Chip
                    icon={<Activity size={12} />}
                    label={`${k.total_calls.toLocaleString()} calls`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 24 }}
                  />
                  <Chip
                    icon={<Clock size={12} />}
                    label={`Last used: ${formatDate(k.last_used_at)}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.7rem', height: 24 }}
                  />
                  {k.expires_at && (
                    <Chip
                      icon={<Clock size={12} />}
                      label={`Expires: ${formatDate(k.expires_at)}`}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 24 }}
                    />
                  )}
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </Box>

      {/* Revoked / Expired Keys */}
      {inactiveKeys.length > 0 && (
        <Box>
          <Typography
            variant="overline"
            sx={{ fontWeight: 600, color: 'text.secondary', letterSpacing: '0.2em', fontFamily: 'var(--font-mono)', mb: 1.5, display: 'block' }}
          >
            Revoked / Expired ({inactiveKeys.length})
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {inactiveKeys.map((k) => (
              <Paper
                key={k.id}
                elevation={0}
                sx={{
                  border: '1px solid', borderColor: 'divider',
                  borderRadius: '8px',
                  p: 2,
                  opacity: 0.6,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '10px',
                        bgcolor: 'action.hover',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Key size={20} color="var(--mui-palette-text-disabled)" />
                    </Box>
                    <Box>
                      <Typography sx={{ fontWeight: 500, color: 'text.secondary', textDecoration: 'line-through' }}>
                        {k.name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.disabled', fontFamily: 'monospace' }}>
                        {k.key_prefix}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={isExpired(k.expires_at) ? 'Expired' : 'Revoked'}
                      size="small"
                      sx={{
                        bgcolor: isExpired(k.expires_at) ? 'rgba(255,181,149,0.1)' : 'rgba(239,68,68,0.1)',
                        color: isExpired(k.expires_at) ? '#ffb595' : '#dc2626',
                        fontWeight: 500,
                        fontSize: '0.7rem',
                        height: 24,
                      }}
                    />
                    {confirmAction?.type === 'delete' && confirmAction.keyId === k.id ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="caption" sx={{ color: '#dc2626' }}>Delete?</Typography>
                        <IconButton size="small" onClick={() => handleDelete(k.id)} sx={{ color: '#dc2626' }}>
                          <Check size={16} />
                        </IconButton>
                        <IconButton size="small" onClick={() => setConfirmAction(null)} sx={{ color: 'text.disabled' }}>
                          <X size={16} />
                        </IconButton>
                      </Box>
                    ) : (
                      <IconButton
                        size="small"
                        onClick={() => setConfirmAction({ type: 'delete', keyId: k.id })}
                        title="Delete permanently"
                        sx={{
                          color: 'text.disabled',
                          '&:hover': { color: '#dc2626', bgcolor: 'rgba(239,68,68,0.1)' },
                        }}
                      >
                        <Trash2 size={16} />
                      </IconButton>
                    )}
                  </Box>
                </Box>
                <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    {k.total_calls.toLocaleString()} total calls
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.disabled' }}>
                    Created {formatDate(k.created_at)}
                  </Typography>
                </Box>
              </Paper>
            ))}
          </Box>
        </Box>
      )}

      {/* Create Key Modal */}
      <Dialog
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '8px' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1 }}>
          <Key size={20} color="#adc6ff" />
          <Typography variant="h6" component="span">Create API Key</Typography>
        </DialogTitle>
        <form onSubmit={handleCreate}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
            <TextField
              label="Key Name"
              required
              fullWidth
              size="small"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              placeholder="e.g., Production Backend, CI/CD Pipeline"
            />

            <FormControl fullWidth size="small">
              <InputLabel>Scopes</InputLabel>
              <Select
                label="Scopes"
                value={createForm.scopes}
                onChange={(e) => setCreateForm({ ...createForm, scopes: e.target.value })}
              >
                <MenuItem value="read">Read only</MenuItem>
                <MenuItem value="read,write">Read & Write</MenuItem>
                <MenuItem value="read,write,admin">Full Access (Admin)</MenuItem>
              </Select>
              <FormHelperText>Controls what this key can do</FormHelperText>
            </FormControl>

            <TextField
              label="Rate Limit (req/min)"
              type="number"
              fullWidth
              size="small"
              inputProps={{ min: 1, max: 10000 }}
              value={createForm.rate_limit}
              onChange={(e) => setCreateForm({ ...createForm, rate_limit: parseInt(e.target.value) || 60 })}
            />

            <FormControl fullWidth size="small">
              <InputLabel>Expiration</InputLabel>
              <Select
                label="Expiration"
                value={createForm.expires_in_days}
                onChange={(e) => setCreateForm({ ...createForm, expires_in_days: Number(e.target.value) })}
              >
                <MenuItem value={0}>Never expires</MenuItem>
                <MenuItem value={7}>7 days</MenuItem>
                <MenuItem value={30}>30 days</MenuItem>
                <MenuItem value={90}>90 days</MenuItem>
                <MenuItem value={365}>1 year</MenuItem>
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => setShowCreateModal(false)}
              sx={{ flex: 1, textTransform: 'none', borderRadius: '8px' }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={creating}
              startIcon={creating ? <CircularProgress size={16} color="inherit" /> : null}
              sx={{ flex: 1, textTransform: 'none', borderRadius: '8px' }}
            >
              {creating ? 'Creating...' : 'Create Key'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
