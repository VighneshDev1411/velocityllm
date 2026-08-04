import React from 'react';

/** Tabs — segmented tab control, matches frontend/components/ui/tabs.tsx. */
export function Tabs({ tabs, value, onChange }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', height: 36, borderRadius: 'var(--radius-lg)',
      background: 'var(--bg-surface-hover)', padding: 4, gap: 2, fontFamily: 'var(--font-sans)',
    }}>
      {tabs.map(t => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            onClick={() => onChange && onChange(t.value)}
            style={{
              padding: '0 12px', height: 28, borderRadius: 'var(--radius-md)', border: 'none',
              fontSize: 'var(--text-body)', fontWeight: 500, cursor: 'pointer',
              background: active ? 'var(--bg-surface)' : 'transparent',
              color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: active ? 'var(--shadow-floating)' : 'none',
              transition: 'var(--transition-all-fast)',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
