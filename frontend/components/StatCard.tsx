'use client';

import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  color?: 'blue' | 'green' | 'purple' | 'red' | 'orange' | 'yellow';
}

const colorMap = {
  blue: { bg: 'rgba(59,130,246,0.1)', fg: '#3b82f6' },
  green: { bg: 'rgba(16,185,129,0.1)', fg: '#10b981' },
  purple: { bg: '#f5f3ff', fg: '#8b5cf6' },
  red: { bg: 'rgba(239,68,68,0.1)', fg: '#ef4444' },
  orange: { bg: 'rgba(245,158,11,0.1)', fg: '#f97316' },
  yellow: { bg: '#fefce8', fg: '#eab308' },
};

export function StatCard({ icon, label, value, subtext, color = 'blue' }: StatCardProps) {
  const colors = colorMap[color];
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        border: '1px solid', borderColor: 'divider',
        borderRadius: '12px',
        transition: 'box-shadow 0.2s',
        '&:hover': { boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' },
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '10px',
          backgroundColor: colors.bg,
          color: colors.fg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 1.5,
        }}
      >
        {icon}
      </Box>
      <Typography
        sx={{
          fontSize: '0.7rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: 'text.primary', mt: 0.25 }}>
        {value}
      </Typography>
      {subtext && (
        <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', mt: 0.25 }}>
          {subtext}
        </Typography>
      )}
    </Paper>
  );
}
