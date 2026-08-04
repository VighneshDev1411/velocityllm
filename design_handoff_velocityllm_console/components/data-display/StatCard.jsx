import React from 'react';

/**
 * StatCard — dashboard KPI tile. Matches frontend/components/StatCard.tsx
 * exactly: icon chip, mono uppercase kicker label, large mono value, subtext,
 * and a colored inset left border that also tints the icon chip.
 */
const COLOR_MAP = {
  blue:   { accent: 'var(--color-primary)', bg: 'rgba(173,198,255,0.08)' },
  green:  { accent: 'var(--color-secondary)', bg: 'rgba(83,225,111,0.08)' },
  purple: { accent: 'var(--color-primary)', bg: 'rgba(173,198,255,0.08)' },
  red:    { accent: 'var(--color-error)', bg: 'rgba(239,68,68,0.08)' },
  orange: { accent: 'var(--color-tertiary)', bg: 'rgba(255,181,149,0.08)' },
};

export function StatCard({ icon, label, value, subtext, color = 'blue', style = {} }) {
  const [hover, setHover] = React.useState(false);
  const c = COLOR_MAP[color] || COLOR_MAP.blue;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: 20, borderRadius: 'var(--radius-lg)', position: 'relative', overflow: 'hidden',
        boxShadow: `inset var(--inset-accent-width) 0 0 0 ${c.accent}`,
        background: hover ? 'var(--surface-high)' : 'var(--bg-surface)',
        transition: 'var(--transition-color)', fontFamily: 'var(--font-sans)',
        ...style,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 'var(--radius-md)', background: c.bg, color: c.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
      }}>
        {icon}
      </div>
      <div style={{
        fontSize: 'var(--text-label)', fontWeight: 700, textTransform: 'uppercase',
        letterSpacing: 'var(--tracking-widest)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)',
      }}>
        {label}
      </div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
        {value}
      </div>
      {subtext && (
        <div style={{ fontSize: 'var(--text-caption)', color: 'rgba(229,226,225,0.4)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
          {subtext}
        </div>
      )}
    </div>
  );
}
