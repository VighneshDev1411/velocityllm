'use client';

import React, { useState, useEffect } from 'react';
import { adminDashboardAPI } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import {
  Users, Key, Webhook, AlertTriangle, Timer, Activity,
  Server, Cpu, Database,
} from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';

interface SystemHealth {
  status: string;
  uptime_seconds: number;
  uptime_human: string;
  go_version: string;
  goroutines: number;
  cpu_cores: number;
  memory: {
    alloc_mb: number;
    total_alloc_mb: number;
    sys_mb: number;
    gc_cycles: number;
  };
  database: {
    status: string;
    open_connections: number;
    in_use: number;
    idle: number;
    max_open: number;
  };
}

interface DashboardOverview {
  users: { total: number; active: number; tiers: { tier: string; count: number }[] };
  quotas: { over_limit_users: number; rate_limit_events_24h: number };
  webhooks: { total: number; active: number };
  load_tests: { total: number; running: number };
  api_keys: { total: number; active: number };
  recent_activity: any[];
}

interface TableStat {
  table: string;
  count: number;
}

export default function AdminDashboardPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [dbStats, setDbStats] = useState<TableStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchAll = async () => {
    try {
      const [healthRes, overviewRes, dbRes] = await Promise.all([
        adminDashboardAPI.health(),
        adminDashboardAPI.overview(),
        adminDashboardAPI.databaseStats(),
      ]);
      if (healthRes.data) setHealth(healthRes.data);
      if (overviewRes.data) setOverview(overviewRes.data);
      if (dbRes.data) setDbStats(dbRes.data.tables || []);
    } catch (e) {
      console.error('Failed to fetch admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 }, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={40} />
          <Typography sx={{ mt: 2, color: '#6b7280' }}>Loading admin dashboard...</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <PageHeader title="Admin Dashboard" subtitle="System overview and health monitoring" />

      {/* System Health */}
      {health && (
        <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
            <Typography sx={{ fontSize: '1.1rem', fontWeight: 600, color: '#111827' }}>
              System Health
            </Typography>
            <Chip
              label={health.status.toUpperCase()}
              size="small"
              sx={{
                backgroundColor: health.status === 'healthy' ? '#ecfdf5' : '#fef2f2',
                color: health.status === 'healthy' ? '#15803d' : '#b91c1c',
                fontWeight: 600,
                fontSize: '0.75rem',
              }}
            />
          </Box>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ backgroundColor: '#eff6ff', borderRadius: '10px', p: 2 }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: '#2563eb' }}>Uptime</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e3a5f' }}>{health.uptime_human}</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ backgroundColor: '#ecfdf5', borderRadius: '10px', p: 2 }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: '#16a34a' }}>Goroutines</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#14532d' }}>{health.goroutines}</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ backgroundColor: '#f5f3ff', borderRadius: '10px', p: 2 }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: '#7c3aed' }}>Memory (Alloc)</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#3b0764' }}>{health.memory.alloc_mb.toFixed(1)} MB</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ backgroundColor: '#fff7ed', borderRadius: '10px', p: 2 }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: '#ea580c' }}>GC Cycles</Typography>
                <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#7c2d12' }}>{health.memory.gc_cycles}</Typography>
              </Box>
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ backgroundColor: '#f9fafb', borderRadius: '10px', p: 2 }}>
                <Typography sx={{ fontSize: '0.8rem', color: '#6b7280' }}>Go Version</Typography>
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{health.go_version}</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ backgroundColor: '#f9fafb', borderRadius: '10px', p: 2 }}>
                <Typography sx={{ fontSize: '0.8rem', color: '#6b7280' }}>CPU Cores</Typography>
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{health.cpu_cores}</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ backgroundColor: '#f9fafb', borderRadius: '10px', p: 2 }}>
                <Typography sx={{ fontSize: '0.8rem', color: '#6b7280' }}>System Memory</Typography>
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{health.memory.sys_mb.toFixed(1)} MB</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ backgroundColor: '#f9fafb', borderRadius: '10px', p: 2 }}>
                <Typography sx={{ fontSize: '0.8rem', color: '#6b7280' }}>DB Connections</Typography>
                <Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>
                  {health.database?.in_use || 0}/{health.database?.max_open || 0}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Overview Stats */}
      {overview && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, md: 2 }}>
            <StatCard
              icon={<Users style={{ width: 20, height: 20 }} />}
              label="Total Users"
              value={overview.users.total}
              color="blue"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <StatCard
              icon={<Activity style={{ width: 20, height: 20 }} />}
              label="Active Users"
              value={overview.users.active}
              color="green"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <StatCard
              icon={<Key style={{ width: 20, height: 20 }} />}
              label="Active API Keys"
              value={overview.api_keys.active}
              color="purple"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <StatCard
              icon={<Webhook style={{ width: 20, height: 20 }} />}
              label="Active Webhooks"
              value={overview.webhooks.active}
              color="orange"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <StatCard
              icon={<AlertTriangle style={{ width: 20, height: 20 }} />}
              label="Over Limit"
              value={overview.quotas.over_limit_users}
              color="red"
            />
          </Grid>
          <Grid size={{ xs: 6, md: 2 }}>
            <StatCard
              icon={<Timer style={{ width: 20, height: 20 }} />}
              label="Rate Limits (24h)"
              value={overview.quotas.rate_limit_events_24h}
              color="yellow"
            />
          </Grid>
        </Grid>
      )}

      <Grid container spacing={3}>
        {/* Subscription Tiers */}
        {overview && (
          <Grid size={{ xs: 12, lg: 6 }}>
            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3 }}>
              <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: '#111827', mb: 2.5 }}>
                Subscription Distribution
              </Typography>
              {(overview.users.tiers || []).length === 0 ? (
                <Typography sx={{ color: '#6b7280' }}>No subscriptions yet.</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {overview.users.tiers.map((tier) => {
                    const total = overview.users.total || 1;
                    const pct = ((tier.count / total) * 100);
                    const colorMap: Record<string, string> = {
                      free: '#9ca3af',
                      pro: '#3b82f6',
                      enterprise: '#8b5cf6',
                    };
                    return (
                      <Box key={tier.tier}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, textTransform: 'capitalize' }}>
                            {tier.tier}
                          </Typography>
                          <Typography sx={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            {tier.count} ({pct.toFixed(1)}%)
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          sx={{
                            height: 10,
                            borderRadius: '5px',
                            backgroundColor: '#e5e7eb',
                            '& .MuiLinearProgress-bar': {
                              borderRadius: '5px',
                              backgroundColor: colorMap[tier.tier] || '#9ca3af',
                            },
                          }}
                        />
                      </Box>
                    );
                  })}
                </Box>
              )}
            </Paper>
          </Grid>
        )}

        {/* Database Table Stats */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3 }}>
            <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: '#111827', mb: 2.5 }}>
              Database Tables
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 500, fontSize: '0.8rem', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                      Table
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500, fontSize: '0.8rem', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                      Rows
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dbStats.map((stat) => (
                    <TableRow key={stat.table}>
                      <TableCell sx={{ fontSize: '0.85rem', fontFamily: 'monospace', color: '#111827', borderBottom: '1px solid #f3f4f6' }}>
                        {stat.table}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#111827', borderBottom: '1px solid #f3f4f6' }}>
                        {stat.count.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Recent Activity */}
      {overview && overview.recent_activity && overview.recent_activity.length > 0 && (
        <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3, mt: 3 }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 600, color: '#111827', mb: 2.5 }}>
            Recent Activity
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {overview.recent_activity.map((activity: any, index: number) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  py: 1,
                  borderBottom: index < overview.recent_activity.length - 1 ? '1px solid #f3f4f6' : 'none',
                }}
              >
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#3b82f6', flexShrink: 0 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: '0.85rem', color: '#111827' }}>
                    {activity.action || activity.event_type}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>
                    User #{activity.user_id} - {new Date(activity.created_at).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  );
}
