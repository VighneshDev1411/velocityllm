'use client';

import Chip from '@mui/material/Chip';

type StatusType = 'success' | 'error' | 'warning' | 'info' | 'default';

interface StatusChipProps {
  label: string;
  status?: StatusType;
  size?: 'small' | 'medium';
}

const statusColors: Record<StatusType, { bg: string; color: string }> = {
  success: { bg: 'rgba(16,185,129,0.1)', color: '#059669' },
  error: { bg: 'rgba(239,68,68,0.1)', color: '#dc2626' },
  warning: { bg: 'rgba(245,158,11,0.1)', color: '#d97706' },
  info: { bg: 'rgba(59,130,246,0.1)', color: '#2563eb' },
  default: { bg: 'action.hover', color: 'text.secondary' },
};

export function StatusChip({ label, status = 'default', size = 'small' }: StatusChipProps) {
  const colors = statusColors[status];
  return (
    <Chip
      label={label}
      size={size}
      sx={{
        backgroundColor: colors.bg,
        color: colors.color,
        fontWeight: 600,
        fontSize: '0.75rem',
        border: 'none',
      }}
    />
  );
}
