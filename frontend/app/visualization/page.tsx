'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsAPI } from '@/lib/api';
import dynamic from 'next/dynamic';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import { PageHeader } from '@/components/PageHeader';
import ChartLoadingFallback from '@/components/ChartLoadingFallback';

const VisualizationCharts = dynamic(() => import('./VisualizationCharts'), {
  ssr: false,
  loading: () => <ChartLoadingFallback />,
});

// ---------------------------------------------------------------------------
// Data hooks
// ---------------------------------------------------------------------------

function useAnalyticsSummary() {
  return useQuery({
    queryKey: ['viz-analytics-summary'],
    queryFn: async () => {
      const r = await analyticsAPI.getAnalyticsSummary();
      return r.data?.data;
    },
    refetchInterval: 30000,
  });
}

function useCostBreakdown() {
  return useQuery({
    queryKey: ['viz-cost-breakdown'],
    queryFn: async () => {
      const r = await analyticsAPI.getCostBreakdown();
      return r.data?.data;
    },
    refetchInterval: 30000,
  });
}

function useTimeSeries(period: string) {
  return useQuery({
    queryKey: ['viz-timeseries', period],
    queryFn: async () => {
      const r = await analyticsAPI.getTimeSeries(period);
      return r.data?.data;
    },
    refetchInterval: 30000,
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function VisualizationPage() {
  const [period, setPeriod] = useState('24h');

  const { data: summary, isLoading: summaryLoading, error: summaryError } = useAnalyticsSummary();
  const { data: costBreakdown, isLoading: costLoading } = useCostBreakdown();
  const { data: timeSeries, isLoading: tsLoading } = useTimeSeries(period);

  // Loading
  if (summaryLoading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress size={48} sx={{ color: '#adc6ff' }} />
          <Typography sx={{ mt: 2, color: 'text.secondary' }}>Loading visualization data...</Typography>
        </Box>
      </Box>
    );
  }

  // Error
  if (summaryError) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Alert severity="error" sx={{ maxWidth: 400, borderRadius: '8px' }}>
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>Connection Error</Typography>
          <Typography sx={{ fontSize: '0.875rem' }}>Failed to load data. Make sure the backend is running.</Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 } }}>
      <PageHeader
        title="Visualization"
        subtitle="Advanced charts — radar, treemap, heatmap — with PNG and PDF export"
        action={
          <ToggleButtonGroup
            value={period}
            exclusive
            onChange={(_, val) => { if (val) setPeriod(val); }}
            size="small"
            sx={{
              '& .MuiToggleButton-root': {
                textTransform: 'none',
                fontSize: '0.75rem',
                fontWeight: 500,
                px: 2,
                py: 0.75,
                border: '1px solid', borderColor: 'divider',
                color: 'text.secondary',
                '&.Mui-selected': {
                  backgroundColor: 'background.paper',
                  color: '#adc6ff',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  '&:hover': { backgroundColor: 'rgba(173,198,255,0.1)' },
                },
                '&:hover': { backgroundColor: 'background.default' },
              },
            }}
          >
            {['1h', '6h', '24h', '7d'].map((r) => (
              <ToggleButton key={r} value={r}>{r}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        }
      />

      <VisualizationCharts
        summary={summary}
        costBreakdown={costBreakdown}
        costLoading={costLoading}
        summaryLoading={summaryLoading}
        timeSeries={timeSeries}
        tsLoading={tsLoading}
      />
    </Box>
  );
}
