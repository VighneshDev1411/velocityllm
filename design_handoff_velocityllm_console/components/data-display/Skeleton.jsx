import React from 'react';

/** Skeleton — loading placeholder block, matches frontend/components/ui/skeleton.tsx (pulse animation). */
export function Skeleton({ style = {}, className = '' }) {
  return (
    <div
      className={className}
      style={{
        borderRadius: 'var(--radius-md)', background: 'var(--bg-surface-hover)',
        animation: 'ds-skeleton-pulse 1.5s ease-in-out infinite',
        ...style,
      }}
    />
  );
}
