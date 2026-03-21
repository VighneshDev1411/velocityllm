'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Zap } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useTheme } from '@mui/material/styles';

interface MonitoringChartsProps {
  metricsSnapshot: any;
}

export default function MonitoringCharts({ metricsSnapshot }: MonitoringChartsProps) {
  const theme = useTheme();
  const tooltipStyle = { backgroundColor: '#201f1f', border: '1px solid rgba(65,71,85,0.3)', borderRadius: '6px', fontSize: '11px', color: '#e5e2e1' };

  return (
    <Box sx={{ pt: 2, mt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 1 }}>Latency Percentiles</Typography>
      <Box sx={{ height: 128 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={[
            { name: 'P50', value: metricsSnapshot?.latency?.p50_ms || 0 },
            { name: 'P90', value: metricsSnapshot?.latency?.p90_ms || 0 },
            { name: 'P95', value: metricsSnapshot?.latency?.p95_ms || 0 },
            { name: 'P99', value: metricsSnapshot?.latency?.p99_ms || 0 },
          ]}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(65,71,85,0.2)" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#c1c6d7' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#c1c6d7' }} axisLine={false} tickLine={false} unit="ms" />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="value" fill="#adc6ff" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}
