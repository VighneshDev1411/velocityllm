'use client';

import { useState } from 'react';
import { useContexts, useContextStats, useTokenCache } from '@/hooks/useTokens';
import { Activity, Database, Zap, TrendingUp } from 'lucide-react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';
import Skeleton from '@mui/material/Skeleton';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';

export default function TokensPage() {
  const { data: contextsData, isLoading: contextsLoading } = useContexts();
  const { data: statsData, isLoading: statsLoading } = useContextStats();
  const { data: cacheData, isLoading: cacheLoading } = useTokenCache();

  const stats = statsData?.data || {};
  const contexts = contextsData?.data?.contexts || [];
  const cache = cacheData?.data || {};

  if (contextsLoading || statsLoading || cacheLoading) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Skeleton variant="text" width={256} height={48} sx={{ mb: 2 }} />
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {[...Array(4)].map((_, i) => (
            <Grid size={{ xs: 12, md: 3 }} key={i}>
              <Skeleton variant="rounded" height={128} sx={{ borderRadius: '12px' }} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={384} sx={{ borderRadius: '12px' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <PageHeader
        title="Token Management"
        subtitle="Context windows, token counting, and budget allocation"
      />

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <StatCard
            icon={<Database size={20} />}
            label="Total Contexts"
            value={stats.total_contexts || 0}
            subtext={`${stats.active_contexts || 0} active`}
            color="blue"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <StatCard
            icon={<Activity size={20} />}
            label="Total Messages"
            value={formatNumber(stats.total_messages || 0)}
            subtext={`${stats.messages_truncated || 0} truncated`}
            color="green"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <StatCard
            icon={<Zap size={20} />}
            label="Total Tokens"
            value={formatNumber(stats.total_tokens || 0)}
            subtext="processed"
            color="purple"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <StatCard
            icon={<TrendingUp size={20} />}
            label="Cache Size"
            value={cache.cache_size || 0}
            subtext="entries"
            color="orange"
          />
        </Grid>
      </Grid>

      {/* Context Statistics & Token Processing */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3 }}>
            <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600, color: '#111827', mb: 2.5 }}>
              Context Statistics
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <MetricRow
                label="Contexts Created"
                value={stats.contexts_created || 0}
                color="blue"
              />
              <MetricRow
                label="Active Contexts"
                value={stats.active_contexts || 0}
                max={stats.contexts_created || 1}
                color="green"
              />
              <MetricRow
                label="Expired Contexts"
                value={stats.contexts_expired || 0}
                max={stats.contexts_created || 1}
                color="yellow"
              />
            </Box>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3 }}>
            <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600, color: '#111827', mb: 2.5 }}>
              Token Processing
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography sx={{ fontSize: '0.875rem', color: '#6b7280' }}>Total Messages</Typography>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>
                    {formatNumber(stats.total_messages || 0)}
                  </Typography>
                </Box>
              </Box>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography sx={{ fontSize: '0.875rem', color: '#6b7280' }}>Messages Truncated</Typography>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>
                    {stats.messages_truncated || 0}
                  </Typography>
                </Box>
              </Box>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography sx={{ fontSize: '0.875rem', color: '#6b7280' }}>Total Tokens</Typography>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>
                    {formatNumber(stats.total_tokens || 0)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Active Contexts */}
      <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600, color: '#111827' }}>
            Active Contexts
          </Typography>
          <Chip
            label={`${contexts.length} contexts`}
            size="small"
            sx={{ backgroundColor: '#eff6ff', color: '#2563eb', fontWeight: 600, fontSize: '0.75rem' }}
          />
        </Box>

        {contexts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: '#9ca3af' }}>
            <Database size={48} style={{ margin: '0 auto 12px', display: 'block', color: '#d1d5db' }} />
            <Typography>No active contexts</Typography>
            <Typography sx={{ fontSize: '0.875rem', mt: 0.5 }}>Create a context to get started</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {contexts.slice(0, 10).map((contextId: string) => (
              <Paper
                key={contextId}
                elevation={0}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: 1.5,
                  border: '1px solid #e5e7eb',
                  borderRadius: '10px',
                  transition: 'background-color 0.15s',
                  '&:hover': { backgroundColor: '#f9fafb' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Database size={20} style={{ color: '#3b82f6' }} />
                  <Box>
                    <Typography sx={{ fontWeight: 500, color: '#111827', fontSize: '0.9rem' }}>
                      {contextId}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: '#6b7280' }}>Active context</Typography>
                  </Box>
                </Box>
                <Chip
                  label="Active"
                  size="small"
                  sx={{
                    backgroundColor: '#ecfdf5',
                    color: '#059669',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                  }}
                />
              </Paper>
            ))}
          </Box>
        )}
      </Paper>
    </Box>
  );
}

function MetricRow({ label, value, max, color = 'blue' }: any) {
  const percentage = max ? (value / max) * 100 : 0;

  const colorMap: Record<string, string> = {
    blue: '#3b82f6',
    green: '#10b981',
    yellow: '#eab308',
    red: '#ef4444',
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>{value}</Typography>
      </Box>
      {max && (
        <LinearProgress
          variant="determinate"
          value={percentage}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: '#e5e7eb',
            '& .MuiLinearProgress-bar': {
              backgroundColor: colorMap[color] || colorMap.blue,
              borderRadius: 4,
            },
          }}
        />
      )}
    </Box>
  );
}

function formatNumber(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}
