import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '../core/Icon.jsx';

/**
 * Select — dropdown chooser. Visually matches frontend/components/ui/select.tsx
 * (a Radix Select in the source); reimplemented here with plain React state
 * since this system ships no npm dependencies.
 */
export function Select({ options = [], value, placeholder = 'Select…', onChange, style = {} }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div ref={ref} style={{ position: 'relative', fontFamily: 'var(--font-sans)', ...style }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          height: 36, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)',
          background: 'var(--bg-surface-hover)', color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
          padding: '0 12px', fontSize: 'var(--text-body)', cursor: 'pointer',
        }}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <Icon name="chevron-down" size={16} color="var(--text-secondary)" />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 50,
          background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-floating)', padding: 4,
        }}>
          {options.map(o => (
            <div
              key={o.value}
              onClick={() => { onChange && onChange(o.value); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 8px', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-body)',
                color: 'var(--text-primary)', cursor: 'pointer',
                background: o.value === value ? 'var(--state-selected)' : 'transparent',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--state-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = o.value === value ? 'var(--state-selected)' : 'transparent'}
            >
              {o.label}
              {o.value === value && <Icon name="check" size={14} color="var(--color-primary)" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
