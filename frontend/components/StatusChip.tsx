'use client';

import Chip from '@mui/material/Chip';

type StatusType = 'success' | 'error' | 'warning' | 'info' | 'default';

interface StatusChipProps {
  label: string;
  status?: StatusType;
  size?: 'small' | 'medium';
}

const statusColors: Record<StatusType, { bg: string; color: string }> = {
  success: { bg: '#ecfdf5', color: '#059669' },
  error: { bg: '#fef2f2', color: '#dc2626' },
  warning: { bg: '#fffbeb', color: '#d97706' },
  info: { bg: '#eff6ff', color: '#2563eb' },
  default: { bg: '#f3f4f6', color: '#4b5563' },
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
