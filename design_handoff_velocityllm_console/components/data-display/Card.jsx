import React from 'react';

/**
 * Card family — matches frontend/components/ui/card.tsx (shadcn primitive,
 * 12px "rounded-xl" radius). Used on lighter/marketing surfaces and for
 * generic content containers; dashboard KPI tiles use StatCard instead.
 */
export function Card({ children, style = {}, className = '', ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      className={className}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        borderRadius: 'var(--radius-card-shadcn)', border: '1px solid var(--border-default)',
        background: hover ? 'var(--bg-surface-hover)' : 'var(--bg-surface)', color: 'var(--text-primary)',
        transition: 'var(--transition-color)', fontFamily: 'var(--font-sans)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, style = {} }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 24, ...style }}>{children}</div>;
}

export function CardTitle({ children, style = {} }) {
  return <div style={{ fontWeight: 600, lineHeight: 1, letterSpacing: '-0.01em', fontSize: '1.05rem', ...style }}>{children}</div>;
}

export function CardDescription({ children, style = {} }) {
  return <div style={{ fontSize: 'var(--text-body)', color: 'var(--text-secondary)', ...style }}>{children}</div>;
}

export function CardContent({ children, style = {} }) {
  return <div style={{ padding: '0 24px 24px', ...style }}>{children}</div>;
}

export function CardFooter({ children, style = {} }) {
  return <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px 24px', ...style }}>{children}</div>;
}
