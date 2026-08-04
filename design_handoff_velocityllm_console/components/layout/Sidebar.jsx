import React from 'react';
import { Icon } from '../core/Icon.jsx';

/**
 * Sidebar — collapsible app navigation rail, matches frontend/components/Sidebar.tsx.
 * `sections` is an array of { title, links: [{ href, label, icon }] }.
 */
export function Sidebar({ sections, activeHref, collapsed = false, onToggleCollapse, onLinkClick, brand = 'VelocityLLM' }) {
  const width = collapsed ? 72 : 260;
  return (
    <div style={{
      width, height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)',
      overflow: 'hidden', transition: 'width 0.2s ease-in-out', fontFamily: 'var(--font-sans)',
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: collapsed ? '16px 0' : '16px 20px', justifyContent: collapsed ? 'center' : 'flex-start', minHeight: 64, boxSizing: 'border-box' }}>
        <div style={{ width: 28, height: 28, borderRadius: 4, background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-container))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ color: 'var(--text-on-accent)', fontWeight: 800, fontSize: 12, fontFamily: 'var(--font-mono)' }}>V</span>
        </div>
        {!collapsed && (
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{brand}</div>
            <div style={{ fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', color: 'rgba(229,226,225,0.3)', letterSpacing: '0.1em' }}>v1.0.0</div>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {sections.map((section, si) => (
          <div key={si} style={{ marginBottom: 4 }}>
            {!collapsed && section.title && (
              <div style={{ padding: '16px 20px 4px', fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 'var(--tracking-widest)', fontFamily: 'var(--font-mono)', color: 'rgba(229,226,225,0.3)' }}>
                {section.title}
              </div>
            )}
            {section.links.map(link => {
              const active = link.href === activeHref;
              return (
                <div
                  key={link.href}
                  onClick={() => onLinkClick && onLinkClick(link.href)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 12,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    margin: '0 8px 2px', padding: collapsed ? '9px 0' : '9px 12px',
                    borderRadius: 'var(--sidebar-item-radius)', cursor: 'pointer',
                    background: active ? 'var(--sidebar-bg-active)' : 'transparent',
                    boxShadow: active ? `inset 3px 0 0 0 var(--sidebar-text-active)` : 'none',
                    transition: 'var(--transition-all-fast)',
                  }}
                >
                  <Icon name={link.icon} size={18} color={active ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)'} />
                  {!collapsed && (
                    <span style={{ fontSize: '0.8125rem', fontWeight: active ? 600 : 400, color: active ? 'var(--sidebar-text-active)' : 'var(--sidebar-text)' }}>
                      {link.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 12px' }}>
        <button onClick={onToggleCollapse} style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', cursor: 'pointer', padding: 6, borderRadius: 6 }}>
          <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={16} />
        </button>
      </div>
    </div>
  );
}
