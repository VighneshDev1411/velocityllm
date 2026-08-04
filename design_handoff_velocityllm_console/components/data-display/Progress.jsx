import React from 'react';

/** Progress — linear progress bar, matches frontend/components/ui/progress.tsx. */
export function Progress({ value = 0, style = {} }) {
  return (
    <div style={{ position: 'relative', height: 8, width: '100%', overflow: 'hidden', borderRadius: 999, background: 'var(--bg-surface-hover)', ...style }}>
      <div style={{
        height: '100%', borderRadius: 999, background: 'var(--color-primary)',
        width: `${Math.max(0, Math.min(100, value))}%`, transition: 'width 0.3s ease',
      }} />
    </div>
  );
}
