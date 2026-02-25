'use client';

import { useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ColorModeProvider, useColorMode } from '@/contexts/ColorModeContext';
import { buildTheme } from '@/lib/theme';

function ThemedApp({ children }: { children: React.ReactNode }) {
  const { mode } = useColorMode();
  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <MuiThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </MuiThemeProvider>
  );
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ColorModeProvider>
      <ThemedApp>{children}</ThemedApp>
    </ColorModeProvider>
  );
}
