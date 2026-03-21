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
  blue:   { accent: '#adc6ff', bg: 'rgba(173,198,255,0.08)' },
  green:  { accent: '#53e16f', bg: 'rgba(83,225,111,0.08)' },
  purple: { accent: '#adc6ff', bg: 'rgba(173,198,255,0.08)' },
  red:    { accent: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
  orange: { accent: '#ffb595', bg: 'rgba(255,181,149,0.08)' },
  yellow: { accent: '#ffb595', bg: 'rgba(255,181,149,0.08)' },
};

export function StatCard({ icon, label, value, subtext, color = 'blue' }: StatCardProps) {
  const colors = colorMap[color];
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: '8px',
        transition: 'background-color 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: `inset 3px 0 0 0 ${colors.accent}`,
        '&:hover': { backgroundColor: '#2a2a2a' },
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '6px',
          backgroundColor: colors.bg,
          color: colors.accent,
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
          fontSize: '0.625rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          color: '#c1c6d7',
          fontFamily: 'var(--font-mono), "JetBrains Mono", monospace',
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#e5e2e1',
          mt: 0.25,
          fontFamily: 'var(--font-mono), "JetBrains Mono", monospace',
        }}
      >
        {value}
      </Typography>
      {subtext && (
        <Typography
          sx={{
            fontSize: '0.6875rem',
            color: 'rgba(229,226,225,0.4)',
            mt: 0.25,
            fontFamily: 'var(--font-mono), "JetBrains Mono", monospace',
          }}
        >
          {subtext}
        </Typography>
      )}
    </Paper>
  );
}
