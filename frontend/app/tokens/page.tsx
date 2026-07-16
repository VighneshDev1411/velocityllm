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
              <Skeleton variant="rounded" height={128} sx={{ borderRadius: '8px' }} />
            </Grid>
          ))}
        </Grid>
        <Skeleton variant="rounded" height={384} sx={{ borderRadius: '8px' }} />
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
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
            <Typography variant="h6" sx={{ fontSize: '0.625rem', fontWeight: 600, color: 'text.secondary', mb: 2.5, textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'var(--font-mono)' }}>
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
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
            <Typography variant="h6" sx={{ fontSize: '0.625rem', fontWeight: 600, color: 'text.secondary', mb: 2.5, textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'var(--font-mono)' }}>
              Token Processing
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>Total Messages</Typography>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'text.primary' }}>
                    {formatNumber(stats.total_messages || 0)}
                  </Typography>
                </Box>
              </Box>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>Messages Truncated</Typography>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'text.primary' }}>
                    {stats.messages_truncated || 0}
                  </Typography>
                </Box>
              </Box>
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>Total Tokens</Typography>
                  <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'text.primary' }}>
                    {formatNumber(stats.total_tokens || 0)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Active Contexts */}
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '8px', p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5 }}>
          <Typography variant="h6" sx={{ fontSize: '0.625rem', fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'var(--font-mono)' }}>
            Active Contexts
          </Typography>
          <Chip
            label={`${contexts.length} contexts`}
            size="small"
            sx={{ backgroundColor: 'rgba(173,198,255,0.15)', color: '#adc6ff', fontWeight: 600, fontSize: '0.75rem' }}
          />
        </Box>

        {contexts.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6, color: 'text.disabled' }}>
            <Database size={48} style={{ margin: '0 auto 12px', display: 'block', color: 'text.disabled' }} />
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
                  border: '1px solid', borderColor: 'divider',
                  borderRadius: '10px',
                  transition: 'background-color 0.15s',
                  '&:hover': { backgroundColor: 'background.default' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Database size={20} style={{ color: '#adc6ff' }} />
                  <Box>
                    <Typography sx={{ fontWeight: 500, color: 'text.primary', fontSize: '0.9rem' }}>
                      {contextId}
                    </Typography>
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Active context</Typography>
                  </Box>
                </Box>
                <Chip
                  label="Active"
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(16,185,129,0.1)',
                    color: '#53e16f',
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
    blue: '#adc6ff',
    green: '#53e16f',
    yellow: '#eab308',
    red: '#ef4444',
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 500, color: 'text.primary' }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'text.primary' }}>{value}</Typography>
      </Box>
      {max && (
        <LinearProgress
          variant="determinate"
          value={percentage}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: 'divider',
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
