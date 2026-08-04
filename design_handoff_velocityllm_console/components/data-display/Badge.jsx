import React from 'react';

const VARIANTS = {
  default:      { bg: 'var(--color-primary)', color: 'var(--text-on-accent)' },
  secondary:    { bg: 'var(--color-secondary)', color: 'var(--text-on-accent)' },
  destructive:  { bg: 'var(--color-error)', color: '#fff' },
  outline:      { bg: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-strong)' },
};

/** Badge — small status/tag pill, matches frontend/components/ui/badge.tsx. */
export function Badge({ variant = 'default', children, style = {} }) {
  const v = VARIANTS[variant] || VARIANTS.default;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', borderRadius: 'var(--radius-md)',
      padding: '2px 10px', fontSize: 'var(--text-caption)', fontWeight: 600,
      fontFamily: 'var(--font-sans)', background: v.bg, color: v.color,
      border: v.border || 'none', ...style,
    }}>
      {children}
    </span>
  );
}
