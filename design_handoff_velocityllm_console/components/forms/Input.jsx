import React from 'react';

/** Input — bare text field matching frontend/components/ui/input.tsx. */
export function Input({ placeholder, type = 'text', value, onChange, disabled = false, style = {}, className = '', ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      className={className}
      style={{
        display: 'flex', height: 36, width: '100%', boxSizing: 'border-box',
        borderRadius: 'var(--radius-md)', border: `1px solid ${focus ? 'var(--border-focus)' : 'var(--border-default)'}`,
        background: 'var(--bg-surface-hover)', padding: '0 12px', fontSize: 'var(--text-body)',
        color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', outline: 'none',
        transition: 'var(--transition-all-fast)', opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'text',
        ...style,
      }}
      {...rest}
    />
  );
}
