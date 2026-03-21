'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';
import { useAuth } from '@/contexts/AuthContext';
import { sidebarTheme } from '@/lib/theme';

const publicPaths = ['/', '/login', '/register', '/oauth/callback'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isPublicPage = publicPaths.includes(pathname);
  const showChrome = isAuthenticated && !isPublicPage;

  if (!showChrome) {
    return <>{children}</>;
  }

  const sidebarWidth = collapsed ? sidebarTheme.collapsedWidth : sidebarTheme.width;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#131313' }}>
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
      />
      <TopBar
        onMenuClick={() => setMobileOpen(true)}
        sidebarWidth={sidebarWidth}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${sidebarWidth}px)` },
          ml: { md: 0 },
          mt: '56px',
          backgroundColor: '#131313',
          minHeight: 'calc(100vh - 56px)',
          transition: 'width 0.2s ease-in-out',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
