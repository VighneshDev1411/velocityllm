import React, { useEffect, useRef } from 'react';

/**
 * Icon — thin wrapper around the Lucide icon set (loaded from CDN by the
 * consumer; see ICONOGRAPHY in readme.md). Renders a <span data-lucide="…">
 * and asks the global `lucide` script to swap it for the real inline SVG.
 * Never hand-draws icon paths — always defers to the real library so glyphs
 * stay pixel-identical to the source product.
 */
export function Icon({ name, size = 18, color = 'currentColor', strokeWidth = 2, className = '', style = {} }) {
  const ref = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.lucide && ref.current) {
      window.lucide.createIcons({ nameAttr: 'data-lucide', root: ref.current.parentNode || document });
    }
  }, [name]);

  return (
    <i
      ref={ref}
      data-lucide={name}
      className={className}
      style={{ width: size, height: size, color, display: 'inline-block', flexShrink: 0, ...style }}
      data-stroke-width={strokeWidth}
    />
  );
}
