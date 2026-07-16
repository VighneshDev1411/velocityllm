'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import {
  Activity, Zap, DollarSign, Clock, AlertCircle, RefreshCw
} from 'lucide-react';
import { useDashboardOverview, useTimeSeries, useModelComparison, useCostBreakdown, useRequestLog } from '@/hooks/useAnalytics';
import { StatCard } from '@/components/StatCard';
import { PageHeader } from '@/components/PageHeader';
import ChartLoadingFallback from '@/components/ChartLoadingFallback';
import { RecentRequests, ModelMix } from './ConsolePanels';

const DashboardCharts = dynamic(() => import('./DashboardCharts'), {
  ssr: false,
  loading: () => <ChartLoadingFallback />,
});

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState('24h');

  const { data: overview, isLoading: overviewLoading, error: overviewError } = useDashboardOverview();
  const { data: timeSeries, isLoading: tsLoading } = useTimeSeries(timeRange);
  const { data: modelData } = useModelComparison();
  const { data: costData } = useCostBreakdown();
  const { data: requestLog } = useRequestLog(8);

  if (overviewLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <CircularProgress size={40} />
        <Typography sx={{ mt: 2, color: 'text.secondary' }}>Loading dashboard...</Typography>
      </Box>
    );
  }

  if (overviewError) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', p: 3 }}>
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => window.location.reload()} startIcon={<RefreshCw className="w-4 h-4" />}>
              Retry
            </Button>
          }
          sx={{ maxWidth: 500 }}
        >
          Failed to fetch dashboard data. Make sure the backend is running.
        </Alert>
      </Box>
    );
  }

  const ov = overview?.overview || {};
  const latency = overview?.latency || {};

  const formatNumber = (num: number) => {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatCost = (cost: number) => {
    if (!cost && cost !== 0) return '$0.00';
    return `$${cost.toFixed(4)}`;
  };

  const hasData = Number(ov.total_requests || 0) > 0;

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      {/* No data banner */}
      {!hasData && (
        <Alert
          icon={<Zap className="w-5 h-5" />}
          severity="info"
          sx={{ mb: 3, borderRadius: '10px' }}
        >
          <strong>No requests yet.</strong> Send prompts via the Playground or run{' '}
          <code style={{ backgroundColor: 'rgba(173,198,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem' }}>
            ./scripts/demo-load.sh --quick
          </code>{' '}
          to populate dashboards with real data.
        </Alert>
      )}

      {/* Header */}
      <PageHeader
        title="Dashboard"
        subtitle="Real-time system monitoring & analytics"
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: overview?.status === 'healthy' ? '#53e16f' : '#ffb595',
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
                }}
              />
              <Typography sx={{ fontSize: '0.85rem', fontWeight: 500, color: 'text.secondary', textTransform: 'capitalize' }}>
                {overview?.status || 'unknown'}
              </Typography>
            </Box>
            <ToggleButtonGroup
              value={timeRange}
              exclusive
              onChange={(_, val) => val && setTimeRange(val)}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  px: 1.5, py: 0.5, fontSize: '0.75rem', fontWeight: 600,
                  border: '1px solid', borderColor: 'divider', textTransform: 'none',
                  '&.Mui-selected': { backgroundColor: 'background.paper', color: '#adc6ff', boxShadow: '0 1px 2px rgb(0 0 0 / 0.05)' },
                },
              }}
            >
              {['1h', '6h', '24h', '7d'].map((range) => (
                <ToggleButton key={range} value={range}>{range}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        }
      />

      {/* KPI Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={<Activity className="w-5 h-5" />}
            label="Total Requests"
            value={formatNumber(ov.total_requests || 0)}
            subtext={`${ov.requests_per_second || '0.00'} req/s`}
            color="blue"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={<DollarSign className="w-5 h-5" />}
            label="Total Cost"
            value={formatCost(ov.total_cost || 0)}
            subtext={`Avg ${formatCost(ov.avg_cost_per_request || 0)}/req`}
            color="green"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={<Clock className="w-5 h-5" />}
            label="Avg Latency"
            value={`${latency.mean_ms || 0}ms`}
            subtext={`P99: ${latency.p99_ms || 0}ms`}
            color="purple"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard
            icon={<AlertCircle className="w-5 h-5" />}
            label="Error Rate"
            value={`${(ov.error_rate || 0).toFixed(2)}%`}
            subtext={`${ov.total_errors || 0} total errors`}
            color={ov.error_rate > 5 ? 'red' : 'green'}
          />
        </Grid>
      </Grid>

      {/* Recent Requests (2fr) + Model Mix (1fr) — console signature panels */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
          gap: 2,
          mb: 3,
        }}
      >
        <RecentRequests data={requestLog} />
        <ModelMix data={modelData} />
      </Box>

      {/* Charts (dynamically loaded) */}
      <DashboardCharts
        timeSeries={timeSeries}
        tsLoading={tsLoading}
        modelData={modelData}
        costData={costData}
        overview={overview}
      />
    </Box>
  );
}
