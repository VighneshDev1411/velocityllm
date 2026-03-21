'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';

interface RealtimeChartsProps {
  chartData: { time: string; rps: number; latency: number; errors: number; connections: number; goroutines: number }[];
}

export default function RealtimeCharts({ chartData }: RealtimeChartsProps) {
  return (
    <>
      {/* Live Requests/sec Chart */}
      <Grid size={{ xs: 12, lg: 8 }}>
        <Paper sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Live Throughput (rolling 60s)
          </Typography>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="rpsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#adc6ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#adc6ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(65,71,85,0.2)" />
              <XAxis dataKey="time" stroke="#c1c6d7" fontSize={11} />
              <YAxis stroke="#c1c6d7" fontSize={11} />
              <Tooltip
                contentStyle={{ backgroundColor: '#201f1f', border: '1px solid rgba(65,71,85,0.3)', borderRadius: 6, color: '#e5e2e1' }}
                labelStyle={{ color: '#e5e2e1' }}
              />
              <Area type="monotone" dataKey="rps" stroke="#adc6ff" strokeWidth={2} fill="url(#rpsGradient)" name="Req/s" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Paper>
      </Grid>

      {/* Latency Chart */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Latency Trend
          </Typography>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(65,71,85,0.2)" />
              <XAxis dataKey="time" stroke="#c1c6d7" fontSize={11} />
              <YAxis stroke="#c1c6d7" fontSize={11} unit="ms" />
              <Tooltip contentStyle={{ backgroundColor: '#201f1f', border: '1px solid rgba(65,71,85,0.3)', borderRadius: 6, color: '#e5e2e1' }} />
              <Line type="monotone" dataKey="latency" stroke="#ffb595" strokeWidth={2} dot={false} name="Avg Latency (ms)" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      </Grid>

      {/* Goroutines Chart */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 2.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
            Goroutines
          </Typography>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="goGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(65,71,85,0.2)" />
              <XAxis dataKey="time" stroke="#c1c6d7" fontSize={11} />
              <YAxis stroke="#c1c6d7" fontSize={11} />
              <Tooltip contentStyle={{ backgroundColor: '#201f1f', border: '1px solid rgba(65,71,85,0.3)', borderRadius: 6, color: '#e5e2e1' }} />
              <Area type="monotone" dataKey="goroutines" stroke="#8b5cf6" strokeWidth={2} fill="url(#goGradient)" name="Goroutines" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Paper>
      </Grid>
    </>
  );
}
