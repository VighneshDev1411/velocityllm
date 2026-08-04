import React from 'react';

/** Alert — inline banner, matches frontend/components/ui/alert.tsx. */
const VARIANTS = {
  default:     { border: 'var(--border-default)', color: 'var(--text-primary)' },
  destructive: { border: 'var(--color-error)', color: 'var(--color-error-light)' },
};

export function Alert({ variant = 'default', icon, title, children, style = {} }) {
  const v = VARIANTS[variant] || VARIANTS.default;
  return (
    <div style={{
      position: 'relative', width: '100%', borderRadius: 'var(--radius-lg)',
      border: `1px solid ${v.border}`, padding: '12px 16px 12px', color: v.color,
      background: 'var(--bg-surface)', fontFamily: 'var(--font-sans)', fontSize: 'var(--text-body)',
      display: 'flex', gap: 10, ...style,
    }}>
      {icon && <div style={{ flexShrink: 0, marginTop: 2 }}>{icon}</div>}
      <div>
        {title && <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>}
        <div style={{ color: 'var(--text-secondary)' }}>{children}</div>
      </div>
    </div>
  );
}
