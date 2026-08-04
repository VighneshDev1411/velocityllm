import React from 'react';

/** StatusChip — colored status pill, matches frontend/components/StatusChip.tsx. */
const STATUS_COLORS = {
  success: { bg: 'var(--status-healthy-bg)', fg: 'var(--status-healthy-fg)' },
  error:   { bg: 'var(--status-critical-bg)', fg: 'var(--status-critical-fg)' },
  warning: { bg: 'var(--status-degraded-bg)', fg: 'var(--status-degraded-fg)' },
  info:    { bg: 'var(--status-busy-bg)', fg: 'var(--status-busy-fg)' },
  default: { bg: 'var(--status-idle-bg)', fg: 'var(--status-idle-fg)' },
};

export function StatusChip({ label, status = 'default', size = 'small' }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.default;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', borderRadius: 'var(--radius-sm)',
      background: c.bg, color: c.fg, fontWeight: 600, fontFamily: 'var(--font-sans)',
      fontSize: size === 'small' ? 'var(--text-caption)' : 'var(--text-body)',
      padding: size === 'small' ? '2px 10px' : '4px 12px',
    }}>
      {label}
    </span>
  );
}
