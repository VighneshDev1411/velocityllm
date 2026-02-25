'use client';

import { createTheme, alpha, type PaletteMode } from '@mui/material/styles';

// ─── Brand palette ───────────────────────────────────────────────────────────
const primary   = { main: '#3b82f6', light: '#60a5fa', dark: '#2563eb', contrastText: '#fff' };
const secondary = { main: '#8b5cf6', light: '#a78bfa', dark: '#7c3aed', contrastText: '#fff' };
const success   = { main: '#10b981', light: '#34d399', dark: '#059669', contrastText: '#fff' };
const error     = { main: '#ef4444', light: '#f87171', dark: '#dc2626', contrastText: '#fff' };
const warning   = { main: '#f59e0b', light: '#fbbf24', dark: '#d97706', contrastText: '#fff' };
const info      = { main: '#06b6d4', light: '#22d3ee', dark: '#0891b2', contrastText: '#fff' };

// ─── Slate grey scale (matches Tailwind slate) ───────────────────────────────
const grey = {
  50:  '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
  400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
  800: '#1e293b', 900: '#0f172a', A100: '#cbd5e1', A200: '#94a3b8',
  A400: '#475569', A700: '#1e293b',
};

export function buildTheme(mode: PaletteMode) {
  const isDark = mode === 'dark';

  // Semantic chip backgrounds: work on both light and dark
  const chipAlpha = (color: string) => alpha(color, isDark ? 0.18 : 0.12);

  return createTheme({
    palette: {
      mode,
      primary, secondary, success, error, warning, info, grey,
      background: {
        default: isDark ? '#0f172a' : '#f8fafc',
        paper:   isDark ? '#1e293b' : '#ffffff',
      },
      text: {
        primary:   isDark ? '#f1f5f9' : '#0f172a',
        secondary: isDark ? '#94a3b8' : '#475569',
        disabled:  isDark ? '#475569' : '#94a3b8',
      },
      divider: isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
      action: {
        hover:             isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
        selected:          isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        disabled:          isDark ? 'rgba(255,255,255,0.3)'  : 'rgba(0,0,0,0.26)',
        disabledBackground:isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
        focus:             isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
        active:            isDark ? 'rgba(255,255,255,0.56)' : 'rgba(0,0,0,0.54)',
      },
    },

    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h4: { fontWeight: 700, fontSize: '1.75rem', letterSpacing: '-0.02em' },
      h5: { fontWeight: 700, fontSize: '1.25rem', letterSpacing: '-0.01em' },
      h6: { fontWeight: 600, fontSize: '1rem' },
      subtitle1: { fontSize: '0.875rem', fontWeight: 500 },
      subtitle2: { fontSize: '0.8rem',   fontWeight: 600, letterSpacing: '0.02em' },
      body1: { fontSize: '0.875rem' },
      body2: { fontSize: '0.8rem' },
      caption: { fontSize: '0.72rem', letterSpacing: '0.02em' },
    },

    shape: { borderRadius: 10 },

    // ─── Component overrides ────────────────────────────────────────────────
    components: {

      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: 'thin',
            scrollbarColor: isDark ? '#334155 transparent' : '#cbd5e1 transparent',
            '&::-webkit-scrollbar': { width: 6, height: 6 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': {
              background: isDark ? '#334155' : '#cbd5e1',
              borderRadius: 3,
            },
          },
        },
      },

      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0'}`,
            color: isDark ? '#f1f5f9' : '#0f172a',
          },
        },
      },

      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: 'none' },
          rounded: { borderRadius: 12 },
          elevation1: {
            boxShadow: isDark
              ? '0 1px 3px rgba(0,0,0,0.5), 0 0 0 1px rgba(148,163,184,0.08)'
              : '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
          },
          elevation2: {
            boxShadow: isDark
              ? '0 4px 12px rgba(0,0,0,0.5), 0 0 0 1px rgba(148,163,184,0.08)'
              : '0 4px 12px rgba(0,0,0,0.08)',
          },
        },
      },

      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: 12,
            border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0'}`,
            backgroundImage: 'none',
          },
        },
      },

      MuiCardContent: {
        styleOverrides: {
          root: { '&:last-child': { paddingBottom: 16 } },
        },
      },

      MuiDivider: {
        styleOverrides: {
          root: { borderColor: isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0' },
        },
      },

      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 8,
            padding: '7px 18px',
            fontSize: '0.875rem',
          },
          contained: {
            '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.2)' },
          },
          outlined: {
            borderColor: isDark ? 'rgba(148,163,184,0.25)' : '#e2e8f0',
            '&:hover': {
              borderColor: isDark ? 'rgba(148,163,184,0.4)' : '#cbd5e1',
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            },
          },
        },
      },

      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' },
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: { fontWeight: 500, fontSize: '0.75rem', borderRadius: 6 },
          // Filled semantic chips — proper dark-mode alpha backgrounds
          colorSuccess:  { backgroundColor: chipAlpha(success.main), color: isDark ? success.light  : success.dark,  border: 'none' },
          colorError:    { backgroundColor: chipAlpha(error.main),   color: isDark ? error.light    : error.dark,    border: 'none' },
          colorWarning:  { backgroundColor: chipAlpha(warning.main), color: isDark ? warning.light  : warning.dark,  border: 'none' },
          colorInfo:     { backgroundColor: chipAlpha(info.main),    color: isDark ? info.light     : info.dark,     border: 'none' },
          colorPrimary:  { backgroundColor: chipAlpha(primary.main), color: isDark ? primary.light  : primary.dark,  border: 'none' },
          colorSecondary:{ backgroundColor: chipAlpha(secondary.main),color: isDark ? secondary.light: secondary.dark,border: 'none' },
        },
      },

      MuiTextField: {
        defaultProps: { variant: 'outlined', size: 'small' },
        styleOverrides: {
          root: { '& .MuiOutlinedInput-root': { borderRadius: 8 } },
        },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: isDark ? 'rgba(148,163,184,0.2)' : '#e2e8f0',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: isDark ? 'rgba(148,163,184,0.4)' : '#cbd5e1',
            },
          },
        },
      },

      MuiSelect: {
        styleOverrides: {
          icon: { color: isDark ? '#94a3b8' : '#475569' },
        },
      },

      MuiInputLabel: {
        styleOverrides: {
          root: { color: isDark ? '#94a3b8' : '#475569' },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 600,
            backgroundColor: isDark ? 'rgba(15,23,42,0.8)' : '#f8fafc',
            color: isDark ? '#94a3b8' : '#475569',
            fontSize: '0.72rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            borderBottom: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0'}`,
          },
          root: {
            borderColor: isDark ? 'rgba(148,163,184,0.08)' : '#f1f5f9',
            padding: '12px 16px',
            fontSize: '0.875rem',
          },
        },
      },

      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
            },
          },
        },
      },

      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
            minHeight: 44,
            color: isDark ? '#94a3b8' : '#475569',
            '&.Mui-selected': { color: primary.main },
          },
        },
      },

      MuiTabs: {
        styleOverrides: {
          indicator: { height: 2, borderRadius: 2 },
        },
      },

      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' },
            '&.Mui-selected': {
              backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)',
              '&:hover': { backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : 'rgba(59,130,246,0.12)' },
            },
          },
        },
      },

      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontSize: '0.875rem',
            borderRadius: 6,
            mx: 0.5,
            '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
          },
        },
      },

      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 10,
            border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0'}`,
            boxShadow: isDark
              ? '0 8px 24px rgba(0,0,0,0.6)'
              : '0 8px 24px rgba(0,0,0,0.12)',
          },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontSize: '0.78rem',
            backgroundColor: isDark ? '#334155' : '#1e293b',
            color: '#f1f5f9',
            borderRadius: 6,
          },
          arrow: { color: isDark ? '#334155' : '#1e293b' },
        },
      },

      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 14,
            border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0'}`,
            boxShadow: isDark ? '0 24px 64px rgba(0,0,0,0.7)' : '0 24px 64px rgba(0,0,0,0.15)',
          },
        },
      },

      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 10, fontSize: '0.875rem' },
          standardSuccess: {
            backgroundColor: isDark ? 'rgba(16,185,129,0.12)' : 'rgba(16,185,129,0.08)',
            color: isDark ? '#34d399' : '#059669',
          },
          standardError: {
            backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
            color: isDark ? '#f87171' : '#dc2626',
          },
          standardWarning: {
            backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(245,158,11,0.08)',
            color: isDark ? '#fbbf24' : '#d97706',
          },
          standardInfo: {
            backgroundColor: isDark ? 'rgba(6,182,212,0.12)' : 'rgba(6,182,212,0.08)',
            color: isDark ? '#22d3ee' : '#0891b2',
          },
        },
      },

      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            height: 6,
            backgroundColor: isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0',
          },
        },
      },

      MuiSwitch: {
        styleOverrides: {
          track: { backgroundColor: isDark ? '#334155' : '#cbd5e1', opacity: 1 },
        },
      },

      MuiSkeleton: {
        styleOverrides: {
          root: { backgroundColor: isDark ? 'rgba(148,163,184,0.1)' : 'rgba(0,0,0,0.06)' },
        },
      },

      MuiAvatar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? '#334155' : '#e2e8f0',
            color: isDark ? '#94a3b8' : '#475569',
          },
        },
      },

      MuiBadge: {
        styleOverrides: {
          badge: { fontWeight: 700, fontSize: '0.65rem' },
        },
      },

      MuiAccordion: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${isDark ? 'rgba(148,163,184,0.12)' : '#e2e8f0'}`,
            borderRadius: '10px !important',
            '&:before': { display: 'none' },
            '&.Mui-expanded': { margin: 0 },
          },
        },
      },
    },
  });
}

// ─── Sidebar (always dark regardless of theme mode) ──────────────────────────
export const sidebarTheme = {
  bg:            '#0f172a',
  bgActive:      '#1e293b',
  bgHover:       'rgba(255,255,255,0.05)',
  text:          '#64748b',
  textActive:    '#f1f5f9',
  textHover:     '#cbd5e1',
  border:        'rgba(148,163,184,0.1)',
  width:         260,
  collapsedWidth:72,
};

export default buildTheme('light');
