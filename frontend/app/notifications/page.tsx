'use client';

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';
import Badge from '@mui/material/Badge';
import {
  Bell, CheckCheck, Trash2, Send, Info, CheckCircle2,
  AlertTriangle, XCircle, Settings, Filter, BarChart3,
  Mail, Zap, CreditCard, Cpu, Shield, BellOff, ExternalLink,
} from 'lucide-react';
import { notificationAPI } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
  category: string;
  read: boolean;
  action_url?: string;
  created_at: string;
}

interface Stats {
  total: number;
  unread: number;
  by_severity: Record<string, number>;
  by_category: Record<string, number>;
}

const severityConfig = {
  info:    { icon: Info,           color: '#4b8eff', bg: '#4b8eff18' },
  success: { icon: CheckCircle2,  color: '#53e16f', bg: '#53e16f18' },
  warning: { icon: AlertTriangle, color: '#ffb595', bg: '#ffb59518' },
  error:   { icon: XCircle,       color: '#ef4444', bg: '#ef444418' },
};

const categoryIcons: Record<string, React.ComponentType<any>> = {
  system: Cpu, api: Zap, billing: CreditCard, quota: BarChart3,
  model: Settings, job: Settings, alert: Shield,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<any>; label: string; value: number; color: string;
}) {
  return (
    <Paper sx={{ p: 2, textAlign: 'center' }}>
      <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: `${color}18`, display: 'inline-flex', mb: 1 }}>
        <Icon size={20} color={color} />
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, fontFamily: 'var(--font-mono), "JetBrains Mono", monospace' }}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Paper>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0); // 0=all, 1=unread, 2=settings
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [sendOpen, setSendOpen] = useState(false);
  const [sendForm, setSendForm] = useState({ title: '', message: '', severity: 'info', category: 'system' });
  const [snack, setSnack] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [prefs, setPrefs] = useState({
    email_enabled: true, in_app_enabled: true, quota_alerts: true,
    billing_alerts: true, system_alerts: true, job_alerts: true, api_alerts: true,
    email_address: '', slack_webhook_url: '',
  });

  const showSnack = (message: string, severity: 'success' | 'error' = 'success') =>
    setSnack({ open: true, message, severity });

  const fetchData = useCallback(async () => {
    try {
      const [notifRes, statsRes, prefsRes] = await Promise.all([
        notificationAPI.list(tab === 1, 100),
        notificationAPI.getStats(),
        notificationAPI.getPreferences(),
      ]);
      setNotifications(notifRes.data?.data?.notifications || []);
      setStats(statsRes.data?.data || null);
      setPrefs(prefsRes.data?.data || prefs);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleMarkRead = async (id: string) => {
    await notificationAPI.markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    showSnack('Marked as read');
  };

  const handleMarkAllRead = async () => {
    await notificationAPI.markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    showSnack('All marked as read');
  };

  const handleDelete = async (id: string) => {
    await notificationAPI.delete(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    showSnack('Notification deleted');
  };

  const handleSend = async () => {
    if (!sendForm.title || !sendForm.message) return;
    try {
      await notificationAPI.send(sendForm);
      setSendOpen(false);
      setSendForm({ title: '', message: '', severity: 'info', category: 'system' });
      showSnack('Notification sent');
      fetchData();
    } catch {
      showSnack('Failed to send', 'error');
    }
  };

  const handleSavePrefs = async () => {
    try {
      await notificationAPI.updatePreferences(prefs);
      showSnack('Preferences saved');
    } catch {
      showSnack('Failed to save', 'error');
    }
  };

  const filtered = filterCategory
    ? notifications.filter(n => n.category === filterCategory)
    : notifications;

  const unreadCount = notifications.filter(n => !n.read).length;
  const categories = [...new Set(notifications.map(n => n.category))];

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center', pt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Bell size={24} /> Notifications
            {unreadCount > 0 && (
              <Chip label={`${unreadCount} unread`} size="small" color="primary" />
            )}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            In-app alerts, system events, and activity feed
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant="outlined" startIcon={<CheckCheck size={16} />}
            onClick={handleMarkAllRead} disabled={unreadCount === 0}>
            Mark All Read
          </Button>
          <Button size="small" variant="contained" startIcon={<Send size={16} />}
            onClick={() => setSendOpen(true)}>
            Send
          </Button>
        </Box>
      </Box>

      {/* Stats Row */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard icon={Bell} label="Total" value={stats.total} color="#4b8eff" />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard icon={Mail} label="Unread" value={stats.unread} color="#4b8eff" />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard icon={AlertTriangle} label="Warnings" value={stats.by_severity?.warning || 0} color="#ffb595" />
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <StatCard icon={XCircle} label="Errors" value={stats.by_severity?.error || 0} color="#ef4444" />
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="All Notifications" />
          <Tab label={<Badge badgeContent={unreadCount} color="primary" max={99}>Unread</Badge>} />
          <Tab label="Preferences" icon={<Settings size={16} />} iconPosition="start" />
        </Tabs>
      </Paper>

      {tab < 2 ? (
        <>
          {/* Category Filter */}
          {categories.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, mb: 2, flexWrap: 'wrap' }}>
              <Chip label="All" size="small" variant={filterCategory === '' ? 'filled' : 'outlined'}
                onClick={() => setFilterCategory('')} />
              {categories.map(cat => (
                <Chip key={cat} label={cat} size="small"
                  variant={filterCategory === cat ? 'filled' : 'outlined'}
                  onClick={() => setFilterCategory(filterCategory === cat ? '' : cat)} />
              ))}
            </Box>
          )}

          {/* Notification List */}
          <Paper>
            {filtered.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <BellOff size={40} color="#666" />
                <Typography color="text.secondary" sx={{ mt: 1 }}>
                  {tab === 1 ? 'No unread notifications' : 'No notifications yet'}
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {filtered.map((n, i) => {
                  const sev = severityConfig[n.severity] || severityConfig.info;
                  const SevIcon = sev.icon;
                  return (
                    <Box key={n.id}>
                      <ListItem
                        sx={{
                          opacity: n.read ? 0.7 : 1,
                          bgcolor: n.read ? 'transparent' : 'action.hover',
                          '&:hover': { bgcolor: 'action.selected' },
                        }}
                        secondaryAction={
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {n.action_url && (
                              <IconButton size="small" onClick={() => router.push(n.action_url!)}>
                                <ExternalLink size={16} />
                              </IconButton>
                            )}
                            {!n.read && (
                              <IconButton size="small" onClick={() => handleMarkRead(n.id)}>
                                <CheckCheck size={16} />
                              </IconButton>
                            )}
                            <IconButton size="small" onClick={() => handleDelete(n.id)}>
                              <Trash2 size={16} />
                            </IconButton>
                          </Box>
                        }
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          <Box sx={{ p: 0.75, borderRadius: 1, bgcolor: sev.bg, display: 'flex' }}>
                            <SevIcon size={18} color={sev.color} />
                          </Box>
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: n.read ? 400 : 600 }}>
                                {n.title}
                              </Typography>
                              <Chip label={n.category} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                              {!n.read && (
                                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#4b8eff' }} />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ maxWidth: '70%' }}>
                                {n.message}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {timeAgo(n.created_at)}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {i < filtered.length - 1 && <Divider />}
                    </Box>
                  );
                })}
              </List>
            )}
          </Paper>
        </>
      ) : (
        /* Preferences Tab */
        <Paper sx={{ p: 3 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Notification Channels
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel
                control={<Switch checked={prefs.in_app_enabled}
                  onChange={e => setPrefs({ ...prefs, in_app_enabled: e.target.checked })} />}
                label="In-App Notifications"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControlLabel
                control={<Switch checked={prefs.email_enabled}
                  onChange={e => setPrefs({ ...prefs, email_enabled: e.target.checked })} />}
                label="Email Notifications"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField size="small" fullWidth label="Email Address" value={prefs.email_address}
                onChange={e => setPrefs({ ...prefs, email_address: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField size="small" fullWidth label="Slack Webhook URL" value={prefs.slack_webhook_url}
                onChange={e => setPrefs({ ...prefs, slack_webhook_url: e.target.value })} />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Alert Categories
          </Typography>
          <Grid container spacing={1}>
            {[
              { key: 'system_alerts', label: 'System Alerts', icon: Cpu },
              { key: 'api_alerts', label: 'API Alerts', icon: Zap },
              { key: 'quota_alerts', label: 'Quota Alerts', icon: BarChart3 },
              { key: 'billing_alerts', label: 'Billing Alerts', icon: CreditCard },
              { key: 'job_alerts', label: 'Job Alerts', icon: Settings },
            ].map(({ key, label, icon: Icon }) => (
              <Grid size={{ xs: 12, sm: 6 }} key={key}>
                <FormControlLabel
                  control={<Switch checked={(prefs as any)[key]}
                    onChange={e => setPrefs({ ...prefs, [key]: e.target.checked })} />}
                  label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Icon size={16} /> {label}
                  </Box>}
                />
              </Grid>
            ))}
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" onClick={handleSavePrefs}>Save Preferences</Button>
          </Box>
        </Paper>
      )}

      {/* Send Notification Dialog */}
      <Dialog open={sendOpen} onClose={() => setSendOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Send Notification</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
          <TextField size="small" label="Title" fullWidth value={sendForm.title}
            onChange={e => setSendForm({ ...sendForm, title: e.target.value })} />
          <TextField size="small" label="Message" fullWidth multiline rows={3} value={sendForm.message}
            onChange={e => setSendForm({ ...sendForm, message: e.target.value })} />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField size="small" label="Severity" select fullWidth value={sendForm.severity}
              onChange={e => setSendForm({ ...sendForm, severity: e.target.value })}
              slotProps={{ select: { native: true } }}>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </TextField>
            <TextField size="small" label="Category" select fullWidth value={sendForm.category}
              onChange={e => setSendForm({ ...sendForm, category: e.target.value })}
              slotProps={{ select: { native: true } }}>
              <option value="system">System</option>
              <option value="api">API</option>
              <option value="billing">Billing</option>
              <option value="quota">Quota</option>
              <option value="model">Model</option>
              <option value="job">Job</option>
              <option value="alert">Alert</option>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSend} disabled={!sendForm.title || !sendForm.message}>
            Send
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snack.open} autoHideDuration={3000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
