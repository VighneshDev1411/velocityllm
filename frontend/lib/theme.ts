'use client';

import { createTheme } from '@mui/material/styles';

// ─── Kinetic Console: Surface Hierarchy ─────────────────────────────────────
const surface = {
  base:             '#131313',
  containerLow:     '#1c1b1b',
  container:        '#201f1f',
  containerHigh:    '#2a2a2a',
  containerHighest: '#353534',
  containerLowest:  '#0e0e0e',
  bright:           '#393939',
};

// ─── Kinetic Console: Accent Palette ────────────────────────────────────────
const kinetic = {
  primary:          '#adc6ff',
  primaryContainer: '#4b8eff',
  secondary:        '#53e16f',
  secondaryContainer:'#05b046',
  tertiary:         '#ffb595',
  tertiaryContainer:'#ef6719',
  error:            '#ef4444',
  errorLight:       '#f87171',
  onSurface:        '#e5e2e1',
  onSurfaceVariant: '#c1c6d7',
  outlineVariant:   '#414755',
};

export const kineticTokens = { surface, ...kinetic };

// Data font — apply to ALL numeric/ID/stat/table-data text (never Inter for data).
// Usage: sx={{ fontFamily: monoFontFamily }} or the `.font-mono` utility class.
export const monoFontFamily = 'var(--font-mono), "JetBrains Mono", monospace';

export function buildTheme() {
  return createTheme({
    palette: {
      mode: 'dark',
      primary:   { main: kinetic.primary,   light: kinetic.primary, dark: kinetic.primaryContainer, contrastText: '#131313' },
      secondary: { main: kinetic.secondary, light: kinetic.secondary, dark: kinetic.secondaryContainer, contrastText: '#131313' },
      success:   { main: kinetic.secondary, light: kinetic.secondary, dark: kinetic.secondaryContainer, contrastText: '#131313' },
      error:     { main: kinetic.error,     light: kinetic.errorLight, dark: '#dc2626', contrastText: '#fff' },
      warning:   { main: kinetic.tertiary,  light: kinetic.tertiary, dark: kinetic.tertiaryContainer, contrastText: '#131313' },
      info:      { main: kinetic.primary,   light: kinetic.primary, dark: kinetic.primaryContainer, contrastText: '#131313' },
      background: {
        default: surface.base,
        paper:   surface.container,
      },
      text: {
        primary:   kinetic.onSurface,
        secondary: kinetic.onSurfaceVariant,
        disabled:  'rgba(193,198,215,0.4)',
      },
      divider: `rgba(65,71,85,0.15)`,
      action: {
        hover:              'rgba(229,226,225,0.05)',
        selected:           'rgba(229,226,225,0.08)',
        disabled:           'rgba(229,226,225,0.3)',
        disabledBackground: 'rgba(229,226,225,0.12)',
        focus:              'rgba(173,198,255,0.12)',
        active:             'rgba(229,226,225,0.56)',
      },
    },

    typography: {
      fontFamily: 'var(--font-inter), "Inter", "Helvetica", "Arial", sans-serif',
      h4: { fontWeight: 700, fontSize: '1.75rem', letterSpacing: '-0.04em', color: kinetic.onSurface },
      h5: { fontWeight: 600, fontSize: '1.25rem', letterSpacing: '-0.02em', color: kinetic.onSurface },
      h6: { fontWeight: 600, fontSize: '1rem', color: kinetic.onSurface },
      subtitle1: { fontSize: '0.875rem', fontWeight: 500, color: kinetic.onSurfaceVariant },
      subtitle2: { fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.02em', color: kinetic.onSurfaceVariant },
      body1: { fontSize: '0.875rem', color: kinetic.onSurface },
      body2: { fontSize: '0.8rem', color: kinetic.onSurfaceVariant },
      caption: { fontSize: '0.6875rem', letterSpacing: '0.05em', color: kinetic.onSurfaceVariant },
    },

    shape: { borderRadius: 4 },

    // ─── Component Overrides ──────────────────────────────────────────────────
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            fontFamily: 'var(--font-inter), "Inter", "Helvetica", "Arial", sans-serif',
            backgroundColor: surface.base,
            color: kinetic.onSurface,
            scrollbarWidth: 'thin',
            scrollbarColor: `${surface.containerHighest} ${surface.base}`,
            '&::-webkit-scrollbar': { width: 4, height: 4 },
            '&::-webkit-scrollbar-track': { background: surface.base },
            '&::-webkit-scrollbar-thumb': {
              background: surface.containerHighest,
              borderRadius: 10,
            },
          },
        },
      },

      MuiAppBar: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundColor: 'rgba(19,19,19,0.6)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: `1px solid rgba(65,71,85,0.1)`,
            color: kinetic.onSurface,
          },
        },
      },

      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: surface.container,
            border: `1px solid rgba(65,71,85,0.15)`,
            transition: 'background-color 0.2s ease',
          },
          rounded: { borderRadius: 8 },
        },
      },

      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: 8,
            border: `1px solid rgba(65,71,85,0.15)`,
            backgroundImage: 'none',
            backgroundColor: surface.container,
            transition: 'background-color 0.2s ease',
            '&:hover': { backgroundColor: surface.containerHigh },
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
          root: { borderColor: 'rgba(65,71,85,0.15)' },
        },
      },

      MuiButton: {
        defaultProps: { disableElevation: true, disableRipple: true },
        styleOverrides: {
          // Console buttons: sentence case, flat accent, 4px radius (NOT a pill),
          // 36px default height. The periwinkle→blue gradient is reserved for
          // marketing/auth CTAs only (see README: gradient CTAs are marketing).
          root: {
            textTransform: 'none' as const,
            fontWeight: 600,
            borderRadius: 4,
            height: 36,
            padding: '0 16px',
            fontSize: '0.875rem',
            letterSpacing: 0,
            transition: 'all 0.15s ease',
            '&:active': { transform: 'scale(0.95)' },
          },
          sizeSmall: { height: 32, padding: '0 12px', fontSize: '0.6875rem' },
          sizeLarge: { height: 40, padding: '0 32px', fontSize: '0.875rem' },
          contained: {
            backgroundColor: kinetic.primary,
            color: '#131313',
            '&:hover': {
              backgroundColor: kinetic.primary,
              filter: 'brightness(0.92)',
              boxShadow: 'none',
            },
          },
          containedSecondary: {
            backgroundColor: kinetic.secondary,
            color: '#131313',
            '&:hover': { backgroundColor: kinetic.secondary, filter: 'brightness(0.92)', boxShadow: 'none' },
          },
          containedError: {
            backgroundColor: kinetic.error,
            color: '#fff',
            '&:hover': { backgroundColor: kinetic.error, filter: 'brightness(0.92)', boxShadow: 'none' },
          },
          outlined: {
            borderColor: 'rgba(65,71,85,0.3)',
            color: kinetic.onSurface,
            '&:hover': {
              borderColor: 'rgba(65,71,85,0.4)',
              backgroundColor: surface.containerHigh,
            },
          },
          text: {
            color: kinetic.onSurfaceVariant,
            '&:hover': { backgroundColor: 'rgba(229,226,225,0.05)' },
          },
        },
      },

      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            transition: 'all 0.15s ease',
            '&:hover': { backgroundColor: 'rgba(229,226,225,0.08)' },
            '&:active': { transform: 'scale(0.9)' },
          },
        },
      },

      MuiLink: {
        styleOverrides: {
          root: {
            transition: 'filter 0.15s ease',
            '&:hover': { filter: 'brightness(1.2)' },
          },
        },
      },

      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 500,
            fontSize: '0.75rem',
            borderRadius: 2,
            backgroundColor: surface.containerHighest,
            color: kinetic.onSurfaceVariant,
            textTransform: 'capitalize' as const,
            transition: 'all 0.15s ease',
          },
          colorSuccess:   { backgroundColor: 'rgba(83,225,111,0.1)',  color: kinetic.secondary, border: '1px solid rgba(83,225,111,0.2)' },
          colorError:     { backgroundColor: 'rgba(239,68,68,0.1)',   color: kinetic.errorLight, border: '1px solid rgba(239,68,68,0.2)' },
          colorWarning:   { backgroundColor: 'rgba(255,181,149,0.1)', color: kinetic.tertiary,  border: '1px solid rgba(255,181,149,0.2)' },
          colorInfo:      { backgroundColor: 'rgba(173,198,255,0.1)', color: kinetic.primary,   border: '1px solid rgba(173,198,255,0.2)' },
          colorPrimary:   { backgroundColor: 'rgba(173,198,255,0.1)', color: kinetic.primary,   border: '1px solid rgba(173,198,255,0.2)' },
          colorSecondary: { backgroundColor: 'rgba(83,225,111,0.1)',  color: kinetic.secondary, border: '1px solid rgba(83,225,111,0.2)' },
        },
      },

      MuiTextField: {
        defaultProps: { variant: 'outlined', size: 'small' },
        styleOverrides: {
          root: { '& .MuiOutlinedInput-root': { borderRadius: 6 } },
        },
      },

      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: surface.containerHigh,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: 'transparent',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(65,71,85,0.3)',
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderColor: 'rgba(173,198,255,0.4)',
              borderWidth: 1,
            },
          },
        },
      },

      MuiSelect: {
        styleOverrides: {
          icon: { color: kinetic.onSurfaceVariant },
        },
      },

      MuiInputLabel: {
        styleOverrides: {
          root: { color: kinetic.onSurfaceVariant },
        },
      },

      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
            backgroundColor: `rgba(42,42,42,0.5)`,
            color: kinetic.onSurfaceVariant,
            fontSize: '0.625rem',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.2em',
            fontFamily: 'var(--font-mono), "JetBrains Mono", monospace',
            borderBottom: `1px solid rgba(65,71,85,0.15)`,
            padding: '10px 16px',
          },
          root: {
            borderColor: 'rgba(65,71,85,0.1)',
            padding: '12px 16px',
            fontSize: '0.875rem',
          },
        },
      },

      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color 0.15s ease',
            '&:hover': { backgroundColor: 'rgba(32,31,31,0.3)' },
          },
        },
      },

      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none' as const,
            fontWeight: 600,
            fontSize: '0.875rem',
            minHeight: 44,
            color: kinetic.onSurfaceVariant,
            '&.Mui-selected': { color: kinetic.primary },
          },
        },
      },

      MuiTabs: {
        styleOverrides: {
          indicator: { height: 2, borderRadius: 1 },
        },
      },

      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            transition: 'all 0.15s ease',
            '&:hover': { backgroundColor: 'rgba(229,226,225,0.05)' },
            '&.Mui-selected': {
              backgroundColor: 'rgba(173,198,255,0.1)',
              '&:hover': { backgroundColor: 'rgba(173,198,255,0.15)' },
            },
          },
        },
      },

      MuiMenuItem: {
        styleOverrides: {
          root: {
            fontSize: '0.875rem',
            borderRadius: 4,
            '&:hover': { backgroundColor: 'rgba(229,226,225,0.06)' },
          },
        },
      },

      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 8,
            border: `1px solid rgba(65,71,85,0.15)`,
            backgroundColor: surface.container,
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          },
        },
      },

      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontSize: '0.78rem',
            backgroundColor: surface.containerHighest,
            color: kinetic.onSurface,
            borderRadius: 4,
            border: `1px solid rgba(65,71,85,0.2)`,
          },
          arrow: { color: surface.containerHighest },
        },
      },

      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 8,
            border: `1px solid rgba(65,71,85,0.15)`,
            backgroundColor: surface.container,
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          },
          root: {
            '& .MuiBackdrop-root': {
              backgroundColor: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            },
          },
        },
      },

      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 8, fontSize: '0.875rem' },
          standardSuccess: { backgroundColor: 'rgba(83,225,111,0.08)',  color: kinetic.secondary },
          standardError:   { backgroundColor: 'rgba(239,68,68,0.08)',   color: kinetic.errorLight },
          standardWarning: { backgroundColor: 'rgba(255,181,149,0.08)', color: kinetic.tertiary },
          standardInfo:    { backgroundColor: 'rgba(173,198,255,0.08)', color: kinetic.primary },
        },
      },

      MuiLinearProgress: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            height: 4,
            backgroundColor: surface.containerHigh,
          },
        },
      },

      MuiCircularProgress: {
        styleOverrides: {
          root: { color: kinetic.primary },
        },
      },

      MuiSwitch: {
        styleOverrides: {
          track: { backgroundColor: surface.containerHighest, opacity: 1 },
        },
      },

      MuiSkeleton: {
        defaultProps: { animation: 'wave' },
        styleOverrides: {
          root: {
            backgroundColor: surface.containerHigh,
            '&::after': { background: `linear-gradient(90deg, transparent, ${surface.containerHighest}, transparent)` },
          },
        },
      },

      MuiAvatar: {
        styleOverrides: {
          root: {
            backgroundColor: surface.containerHighest,
            color: kinetic.onSurfaceVariant,
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
            backgroundColor: surface.container,
            border: `1px solid rgba(65,71,85,0.15)`,
            borderRadius: '8px !important',
            '&:before': { display: 'none' },
            '&.Mui-expanded': { margin: 0 },
          },
        },
      },

      MuiToggleButton: {
        styleOverrides: {
          root: {
            borderColor: 'rgba(65,71,85,0.2)',
            color: kinetic.onSurfaceVariant,
            textTransform: 'none' as const,
            '&.Mui-selected': {
              backgroundColor: surface.container,
              color: kinetic.primary,
              borderColor: 'rgba(65,71,85,0.3)',
              '&:hover': { backgroundColor: surface.containerHigh },
            },
            '&:hover': { backgroundColor: 'rgba(229,226,225,0.05)' },
          },
        },
      },
    },
  });
}

// ─── Sidebar tokens ─────────────────────────────────────────────────────────
export const sidebarTheme = {
  bg:            surface.containerLow,
  bgActive:      surface.container,
  bgHover:       surface.container,
  text:          `rgba(229,226,225,0.5)`,
  textActive:    kinetic.primary,
  textHover:     kinetic.onSurface,
  border:        `rgba(53,53,52,0.15)`,
  accent:        kinetic.primary,
  width:         260,
  collapsedWidth:72,
};

export default buildTheme();
