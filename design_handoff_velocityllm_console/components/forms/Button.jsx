import React from 'react';

const VARIANTS = {
  default:      { bg: 'var(--color-primary)', color: 'var(--text-on-accent)', border: 'none' },
  secondary:    { bg: 'var(--color-secondary)', color: 'var(--text-on-accent)', border: 'none' },
  destructive:  { bg: 'var(--color-error)', color: '#fff', border: 'none' },
  outline:      { bg: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-strong)' },
  ghost:        { bg: 'transparent', color: 'var(--text-primary)', border: 'none' },
  link:         { bg: 'transparent', color: 'var(--color-primary)', border: 'none' },
};

const SIZES = {
  default: { height: 36, padding: '0 16px', fontSize: 'var(--text-body)' },
  sm:      { height: 32, padding: '0 12px', fontSize: 'var(--text-caption)' },
  lg:      { height: 40, padding: '0 32px', fontSize: 'var(--text-body)' },
  icon:    { height: 36, width: 36, padding: 0, fontSize: 'var(--text-body)' },
};

/**
 * Button — primary interactive control. Mirrors the shadcn-style `buttonVariants`
 * cva definition from the source repo (frontend/components/ui/button.tsx).
 */
export function Button({ variant = 'default', size = 'default', disabled = false, children, style = {}, onClick, className = '', ...rest }) {
  const v = VARIANTS[variant] || VARIANTS.default;
  const s = SIZES[size] || SIZES.default;
  const [hover, setHover] = React.useState(false);
  const [pressed, setPressed] = React.useState(false);

  const hoverBg = variant === 'outline' || variant === 'ghost'
    ? 'var(--bg-surface-hover)'
    : v.bg !== 'transparent' ? v.bg : undefined;

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className={className}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        whiteSpace: 'nowrap', borderRadius: 'var(--radius-md)', fontWeight: 600,
        fontFamily: 'var(--font-sans)', cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'var(--transition-all-fast)',
        opacity: disabled ? 0.5 : hover && (variant === 'default' || variant === 'secondary' || variant === 'destructive') ? 0.9 : 1,
        transform: pressed && !disabled ? `scale(var(--press-scale))` : 'scale(1)',
        textDecoration: variant === 'link' && hover ? 'underline' : 'none',
        backgroundColor: hover ? hoverBg : v.bg,
        color: v.color, border: v.border,
        ...s, ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
