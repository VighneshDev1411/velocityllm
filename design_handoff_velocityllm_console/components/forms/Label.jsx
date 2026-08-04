import React from 'react';

/** Label — form field label, matches frontend/components/ui/label.tsx. */
export function Label({ children, htmlFor, style = {}, className = '' }) {
  return (
    <label
      htmlFor={htmlFor}
      className={className}
      style={{
        fontSize: 'var(--text-body)', fontWeight: 600, lineHeight: 1,
        color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
        display: 'inline-block', marginBottom: 6,
        ...style,
      }}
    >
      {children}
    </label>
  );
}
