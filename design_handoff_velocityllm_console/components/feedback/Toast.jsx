import React from 'react';

/** Toast — transient notification card, matches frontend/components/ui/toast.tsx. */
const VARIANTS = {
  default: { bg: 'var(--bg-surface)', border: 'var(--border-default)', color: 'var(--text-primary)' },
  success: { bg: 'rgba(83,225,111,0.08)', border: 'var(--status-healthy-border)', color: 'var(--status-healthy-fg)' },
  error:   { bg: 'rgba(239,68,68,0.08)', border: 'var(--status-critical-border)', color: 'var(--status-critical-fg)' },
  warning: { bg: 'rgba(255,181,149,0.08)', border: 'var(--status-degraded-border)', color: 'var(--status-degraded-fg)' },
};

export function Toast({ variant = 'default', children, style = {} }) {
  const v = VARIANTS[variant] || VARIANTS.default;
  return (
    <div style={{
      display: 'flex', width: '100%', maxWidth: 380, borderRadius: 'var(--radius-lg)',
      border: `1px solid ${v.border}`, background: v.bg, color: v.color, padding: 16,
      boxShadow: 'var(--shadow-floating)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)',
      ...style,
    }}>
      {children}
    </div>
  );
}
