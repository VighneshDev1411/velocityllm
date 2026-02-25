'use client';

import React, { useState, useEffect } from 'react';
import { quotaAPI } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import BarChartIcon from '@mui/icons-material/BarChart';
import NotificationsIcon from '@mui/icons-material/Notifications';
import TrafficIcon from '@mui/icons-material/Traffic';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

interface QuotaUsage {
  id: number;
  user_id: number;
  type: string;
  period: string;
  period_start: string;
  period_end: string;
  current_usage: number;
  quota_limit: number;
  is_over_limit: boolean;
  overage_amount: number;
}

interface AlertConfiguration {
  email_enabled: boolean;
  webhook_enabled: boolean;
  webhook_url: string;
  slack_enabled: boolean;
  slack_webhook_url: string;
  threshold_warning: number;
  threshold_critical: number;
  threshold_exceeded: number;
}

interface RateLimitEvent {
  id: number;
  user_id: number;
  quota_type: string;
  request_path: string;
  current_usage: number;
  quota_limit: number;
  blocked: boolean;
  message: string;
  created_at: string;
}

export default function QuotaManagementPage() {
  const [quotaUsage, setQuotaUsage] = useState<QuotaUsage[]>([]);
  const [alertConfig, setAlertConfig] = useState<AlertConfiguration>({
    email_enabled: true,
    webhook_enabled: false,
    webhook_url: '',
    slack_enabled: false,
    slack_webhook_url: '',
    threshold_warning: 80,
    threshold_critical: 90,
    threshold_exceeded: 100,
  });
  const [rateLimitEvents, setRateLimitEvents] = useState<RateLimitEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch quota usage
      const usageResponse = await quotaAPI.getMyUsage();
      if (usageResponse.data) {
        setQuotaUsage(usageResponse.data.usage || []);
      }

      // Fetch alert configuration
      const alertResponse = await quotaAPI.getAlertConfig();
      if (alertResponse.data) {
        setAlertConfig(alertResponse.data);
      }

      // Fetch rate limit events
      const eventsResponse = await quotaAPI.getRateLimitEvents(20);
      if (eventsResponse.data) {
        setRateLimitEvents(eventsResponse.data.events || []);
      }
    } catch (error) {
      console.error('Failed to fetch quota data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAlertConfig = async () => {
    try {
      await quotaAPI.updateAlertConfig(alertConfig);
      alert('Alert configuration updated successfully!');
    } catch (error) {
      console.error('Failed to update alert configuration:', error);
      alert('Failed to update alert configuration');
    }
  };

  const getUsagePercentage = (usage: QuotaUsage) => {
    if (usage.quota_limit === 0) return 0;
    return Math.min(100, (usage.current_usage / usage.quota_limit) * 100);
  };

  const getProgressBarColor = (percentage: number): 'error' | 'warning' | 'info' | 'success' => {
    if (percentage >= 100) return 'error';
    if (percentage >= 90) return 'warning';
    if (percentage >= 80) return 'info';
    return 'success';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <PageHeader title="Quota Management" subtitle="Monitor usage, configure alerts, and review rate limit events" />

      {/* Current Quota Usage */}
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 3, mb: 3 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <BarChartIcon sx={{ color: 'text.secondary' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
            Current Usage
          </Typography>
        </Box>

        {quotaUsage.length === 0 ? (
          <Typography sx={{ color: 'text.secondary' }}>No quota usage data available.</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {quotaUsage.map((usage) => {
              const percentage = getUsagePercentage(usage);
              const progressColor = getProgressBarColor(percentage);

              return (
                <Box
                  key={usage.id}
                  sx={{
                    borderBottom: '1px solid', borderColor: 'divider',
                    pb: 3,
                    '&:last-child': { borderBottom: 'none', pb: 0 },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Box>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 500, color: 'text.primary', textTransform: 'capitalize' }}
                      >
                        {usage.type} Quota ({usage.period})
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Period: {new Date(usage.period_start).toLocaleDateString()} -{' '}
                        {new Date(usage.period_end).toLocaleDateString()}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        {usage.current_usage.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        of {usage.quota_limit.toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ position: 'relative', height: 24 }}>
                    <LinearProgress
                      variant="determinate"
                      value={percentage}
                      color={progressColor}
                      sx={{
                        height: 24,
                        borderRadius: '12px',
                        backgroundColor: 'divider',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: '12px',
                          transition: 'transform 0.5s ease',
                        },
                      }}
                    />
                    <Typography
                      sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: percentage > 40 ? '#fff' : 'text.primary',
                      }}
                    >
                      {percentage.toFixed(1)}%
                    </Typography>
                  </Box>

                  {usage.is_over_limit && (
                    <Alert severity="error" sx={{ mt: 1.5 }}>
                      <strong>Quota Exceeded!</strong> You have exceeded your limit by{' '}
                      {usage.overage_amount.toLocaleString()}.
                    </Alert>
                  )}
                </Box>
              );
            })}
          </Box>
        )}
      </Paper>

      {/* Alert Configuration */}
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 3, mb: 3 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <NotificationsIcon sx={{ color: 'text.secondary' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
            Alert Configuration
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Email Alerts */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 2.5 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontWeight: 500, color: 'text.primary' }}>Email Alerts</Typography>
                <Switch
                  checked={alertConfig.email_enabled}
                  onChange={(e) =>
                    setAlertConfig({ ...alertConfig, email_enabled: e.target.checked })
                  }
                  size="small"
                />
              </Box>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Receive email notifications when quota thresholds are reached.
              </Typography>
            </Paper>
          </Grid>

          {/* Webhook Alerts */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 2.5 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontWeight: 500, color: 'text.primary' }}>Webhook Alerts</Typography>
                <Switch
                  checked={alertConfig.webhook_enabled}
                  onChange={(e) =>
                    setAlertConfig({ ...alertConfig, webhook_enabled: e.target.checked })
                  }
                  size="small"
                />
              </Box>
              {alertConfig.webhook_enabled && (
                <TextField
                  fullWidth
                  size="small"
                  type="url"
                  placeholder="https://example.com/webhook"
                  value={alertConfig.webhook_url}
                  onChange={(e) => setAlertConfig({ ...alertConfig, webhook_url: e.target.value })}
                  sx={{ mt: 1.5 }}
                />
              )}
            </Paper>
          </Grid>

          {/* Slack Alerts */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 2.5 }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography sx={{ fontWeight: 500, color: 'text.primary' }}>Slack Alerts</Typography>
                <Switch
                  checked={alertConfig.slack_enabled}
                  onChange={(e) =>
                    setAlertConfig({ ...alertConfig, slack_enabled: e.target.checked })
                  }
                  size="small"
                />
              </Box>
              {alertConfig.slack_enabled && (
                <TextField
                  fullWidth
                  size="small"
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={alertConfig.slack_webhook_url}
                  onChange={(e) =>
                    setAlertConfig({ ...alertConfig, slack_webhook_url: e.target.value })
                  }
                  sx={{ mt: 1.5 }}
                />
              )}
            </Paper>
          </Grid>

          {/* Threshold Settings */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 2.5 }}
            >
              <Typography sx={{ fontWeight: 500, color: 'text.primary', mb: 2 }}>
                Alert Thresholds
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, px: 1 }}>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                    Warning ({alertConfig.threshold_warning}%)
                  </Typography>
                  <Slider
                    value={alertConfig.threshold_warning}
                    onChange={(_, v) =>
                      setAlertConfig({ ...alertConfig, threshold_warning: v as number })
                    }
                    min={0}
                    max={100}
                    size="small"
                    sx={{ color: '#eab308' }}
                  />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                    Critical ({alertConfig.threshold_critical}%)
                  </Typography>
                  <Slider
                    value={alertConfig.threshold_critical}
                    onChange={(_, v) =>
                      setAlertConfig({ ...alertConfig, threshold_critical: v as number })
                    }
                    min={0}
                    max={100}
                    size="small"
                    sx={{ color: '#f97316' }}
                  />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                    Exceeded ({alertConfig.threshold_exceeded}%)
                  </Typography>
                  <Slider
                    value={alertConfig.threshold_exceeded}
                    onChange={(_, v) =>
                      setAlertConfig({ ...alertConfig, threshold_exceeded: v as number })
                    }
                    min={0}
                    max={100}
                    size="small"
                    sx={{ color: '#ef4444' }}
                  />
                </Box>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        <Box sx={{ mt: 3 }}>
          <Button
            variant="contained"
            onClick={handleSaveAlertConfig}
            sx={{ textTransform: 'none', borderRadius: '8px', px: 3 }}
          >
            Save Alert Configuration
          </Button>
        </Box>
      </Paper>

      {/* Rate Limit Events */}
      <Paper
        elevation={0}
        sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '12px', p: 3 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <TrafficIcon sx={{ color: 'text.secondary' }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
            Recent Rate Limit Events
          </Typography>
        </Box>

        {rateLimitEvents.length === 0 ? (
          <Typography sx={{ color: 'text.secondary' }}>No rate limit events recorded.</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Time
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Type
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Path
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Usage
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Status
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                    Message
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rateLimitEvents.map((event) => (
                  <TableRow key={event.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: '0.875rem' }}>
                      {formatDate(event.created_at)}
                    </TableCell>
                    <TableCell sx={{ textTransform: 'capitalize', fontSize: '0.875rem' }}>
                      {event.quota_type}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                      {event.request_path || 'N/A'}
                    </TableCell>
                    <TableCell sx={{ fontSize: '0.875rem' }}>
                      {event.current_usage} / {event.quota_limit}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={event.blocked ? 'Blocked' : 'Allowed'}
                        size="small"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          backgroundColor: event.blocked ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                          color: event.blocked ? '#991b1b' : '#065f46',
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                      {event.message}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
    </Box>
  );
}
