import React from 'react';
import { Icon } from '../core/Icon.jsx';

/** TopBar — sticky page header bar, matches frontend/components/TopBar.tsx. */
export function TopBar({ title, userInitial = 'U', userName = 'Profile', onMenuClick }) {
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 40, height: 56, display: 'flex', alignItems: 'center',
      padding: '0 24px', background: 'rgba(19,19,19,0.6)', backdropFilter: 'var(--blur-nav)',
      WebkitBackdropFilter: 'var(--blur-nav)', borderBottom: '1px solid var(--border-default)',
      fontFamily: 'var(--font-sans)',
    }}>
      <button onClick={onMenuClick} style={{ display: 'none', background: 'none', border: 'none', color: 'var(--text-primary)', marginRight: 12 }}>
        <Icon name="menu" size={20} />
      </button>
      <div style={{ fontWeight: 600, fontSize: '0.875rem', flexGrow: 1, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 6, cursor: 'pointer' }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-container))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-on-accent)',
        }}>
          {userInitial}
        </div>
        <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--on-surface-variant)' }}>{userName}</span>
      </div>
    </div>
  );
}
