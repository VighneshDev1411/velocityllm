import React from 'react';
import { Icon } from '../core/Icon.jsx';

/** Dialog — modal, matches frontend/components/ui/dialog.tsx (Radix Dialog visuals). */
export function Dialog({ open, onClose, title, description, children, footer }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'var(--blur-backdrop)', WebkitBackdropFilter: 'var(--blur-backdrop)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', width: '100%', maxWidth: 480, borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-default)', background: 'var(--bg-surface)',
          boxShadow: 'var(--shadow-floating)', padding: 24, fontFamily: 'var(--font-sans)',
        }}
      >
        <button onClick={onClose} style={{
          position: 'absolute', right: 16, top: 16, background: 'none', border: 'none',
          color: 'var(--text-secondary)', cursor: 'pointer', opacity: 0.7,
        }}>
          <Icon name="x" size={16} />
        </button>
        {title && <div style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>{title}</div>}
        {description && <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', marginBottom: 16 }}>{description}</div>}
        <div>{children}</div>
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>{footer}</div>}
      </div>
    </div>
  );
}
