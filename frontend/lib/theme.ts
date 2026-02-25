'use client';

import { createTheme, type PaletteMode } from '@mui/material/styles';

const sharedShape = { borderRadius: 10 };

const sharedTypography = {
  fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  h4: { fontWeight: 700, fontSize: '1.75rem' },
  h5: { fontWeight: 700, fontSize: '1.25rem' },
  h6: { fontWeight: 600, fontSize: '1rem' },
  subtitle1: { fontSize: '0.875rem' },
  body2: { fontSize: '0.875rem' },
};

export function buildTheme(mode: PaletteMode) {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#3b82f6',
        light: '#60a5fa',
        dark: '#2563eb',
        contrastText: '#ffffff',
      },
      secondary: {
        main: '#8b5cf6',
        light: '#a78bfa',
        dark: '#7c3aed',
      },
      success: { main: '#10b981', light: '#34d399', dark: '#059669' },
      error:   { main: '#ef4444', light: '#f87171', dark: '#dc2626' },
      warning: { main: '#f59e0b', light: '#fbbf24', dark: '#d97706' },
      background: {
        default: isDark ? '#0f172a' : '#f5f5f5',
        paper:   isDark ? '#1e293b' : '#ffffff',
      },
      text: {
        primary:   isDark ? '#f1f5f9' : '#1a1a2e',
        secondary: isDark ? '#94a3b8' : '#6b7280',
      },
      divider: isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb',
    },
    typography: sharedTypography,
    shape: sharedShape,
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 8,
            padding: '8px 20px',
          },
          contained: {
            boxShadow: 'none',
            '&:hover': { boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          elevation1: {
            boxShadow: isDark
              ? '0 1px 3px 0 rgb(0 0 0 / 0.4)'
              : '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
            boxShadow: isDark
              ? '0 1px 3px 0 rgb(0 0 0 / 0.4)'
              : '0 1px 3px 0 rgb(0 0 0 / 0.1)',
          },
        },
      },
      MuiTextField: {
        defaultProps: { variant: 'outlined', size: 'small' },
        styleOverrides: {
          root: { '& .MuiOutlinedInput-root': { borderRadius: 8 } },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 600,
            backgroundColor: isDark ? '#0f172a' : '#f9fafb',
            color: isDark ? '#94a3b8' : '#374151',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          },
          root: {
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
            padding: '12px 16px',
            fontSize: '0.875rem',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 500, fontSize: '0.75rem' },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 600, fontSize: '0.875rem' },
        },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 12 } },
      },
      MuiLinearProgress: {
        styleOverrides: { root: { borderRadius: 4, height: 6 } },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#e5e7eb'}`,
          },
        },
      },
    },
  });
}

// Sidebar theme constants (sidebar always stays dark)
export const sidebarTheme = {
  bg: '#1a1a2e',
  bgActive: '#16213e',
  bgHover: 'rgba(255,255,255,0.06)',
  text: '#94a3b8',
  textActive: '#ffffff',
  textHover: '#e2e8f0',
  border: 'rgba(255,255,255,0.06)',
  width: 260,
  collapsedWidth: 72,
};

// Default export: light theme (for any static imports)
export default buildTheme('light');
