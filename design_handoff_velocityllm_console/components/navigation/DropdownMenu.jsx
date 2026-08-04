import React, { useState, useRef, useEffect } from 'react';

/** DropdownMenu — floating menu triggered by a click, matches frontend/components/ui/dropdown-menu.tsx. */
export function DropdownMenu({ trigger, items, align = 'start' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block', fontFamily: 'var(--font-sans)' }}>
      <div onClick={() => setOpen(o => !o)}>{trigger}</div>
      {open && (
        <div style={{
          position: 'absolute', top: '110%', [align === 'end' ? 'right' : 'left']: 0, zIndex: 50,
          minWidth: 180, background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-floating)', padding: 4,
        }}>
          {items.map((it, i) => it.separator ? (
            <div key={i} style={{ height: 1, background: 'var(--border-default)', margin: '4px -4px' }} />
          ) : (
            <div
              key={i}
              onClick={() => { it.onClick && it.onClick(); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                borderRadius: 'var(--radius-md)', fontSize: 'var(--text-body)',
                color: it.danger ? 'var(--color-error-light)' : 'var(--text-primary)', cursor: 'pointer',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--state-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {it.icon}
              {it.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
