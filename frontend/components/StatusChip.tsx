'use client';

import Chip from '@mui/material/Chip';

// Semantic status names from the design system + backward-compatible aliases.
type StatusType =
  | 'healthy' | 'degraded' | 'critical' | 'idle' | 'busy'
  | 'success' | 'error' | 'warning' | 'info' | 'default';

interface StatusChipProps {
  label: string;
  status?: StatusType;
  size?: 'small' | 'medium';
}

// Status pill tokens (tokens/colors.css): 10%-alpha bg + solid fg + 20% border.
const TOKENS = {
  healthy:  { bg: 'rgba(83,225,111,0.1)',  fg: '#53e16f', border: 'rgba(83,225,111,0.2)' },
  degraded: { bg: 'rgba(255,181,149,0.1)', fg: '#ffb595', border: 'rgba(255,181,149,0.2)' },
  critical: { bg: 'rgba(239,68,68,0.1)',   fg: '#f87171', border: 'rgba(239,68,68,0.2)' },
  idle:     { bg: 'rgba(53,53,52,0.5)',    fg: '#c1c6d7', border: 'transparent' },
  busy:     { bg: 'rgba(173,198,255,0.1)', fg: '#adc6ff', border: 'rgba(173,198,255,0.2)' },
} as const;

const ALIAS: Record<StatusType, keyof typeof TOKENS> = {
  healthy: 'healthy', degraded: 'degraded', critical: 'critical', idle: 'idle', busy: 'busy',
  success: 'healthy', warning: 'degraded', error: 'critical', default: 'idle', info: 'busy',
};

export function StatusChip({ label, status = 'default', size = 'small' }: StatusChipProps) {
  const t = TOKENS[ALIAS[status]];
  return (
    <Chip
      label={label}
      size={size}
      sx={{
        backgroundColor: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        borderRadius: '2px',
        fontWeight: 500,
        fontSize: '0.75rem',
        height: size === 'small' ? 22 : 26,
        '& .MuiChip-label': { px: 1 },
      }}
    />
  );
}
