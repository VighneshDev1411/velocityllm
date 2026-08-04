import React from 'react';

/** PageHeader — page title + subtitle + right-aligned action slot, matches frontend/components/PageHeader.tsx. */
export function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, fontFamily: 'var(--font-sans)' }}>
      <div>
        <div style={{ fontSize: 'var(--text-h5)', fontWeight: 700, letterSpacing: 'var(--tracking-snug)', color: 'var(--text-primary)' }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ marginTop: 4, fontSize: 'var(--text-subtitle1)', color: 'var(--text-secondary)' }}>
            {subtitle}
          </div>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
