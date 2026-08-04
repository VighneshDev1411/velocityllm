'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import {
  LayoutDashboard, FlaskConical, MessageSquare, Key, Layers,
  ChevronLeft, ChevronRight, Settings,
} from 'lucide-react';
import { sidebarTheme } from '@/lib/theme';

const SIDEBAR_WIDTH = sidebarTheme.width;
const SIDEBAR_COLLAPSED_WIDTH = sidebarTheme.collapsedWidth;

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const mainLinks: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
  { href: '/playground', label: 'Playground', icon: FlaskConical },
  { href: '/caching', label: 'Caching', icon: Layers },
  { href: '/keys', label: 'API Keys', icon: Key },
];

const bottomLinks: NavItem[] = [
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose, collapsed, onToggleCollapse }: SidebarProps) {
  const pathname = usePathname();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const width = collapsed && !isMobile ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  const isActive = (href: string) => pathname === href;

  const renderNavSection = (title: string, links: NavItem[]) => (
    <Box sx={{ mb: 0.5 }}>
      {!collapsed && title && (
        <Typography
          sx={{
            px: 2.5,
            pt: 2,
            pb: 0.5,
            fontSize: '0.625rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            fontFamily: 'var(--font-mono), "JetBrains Mono", monospace',
            color: 'rgba(229,226,225,0.3)',
          }}
        >
          {title}
        </Typography>
      )}
      <List dense disablePadding>
        {links.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.href);
          return (
            <ListItemButton
              key={link.href}
              component={Link}
              href={link.href}
              onClick={isMobile ? onMobileClose : undefined}
              sx={{
                mx: 1,
                mb: 0.3,
                borderRadius: '6px',
                minHeight: 38,
                justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                px: collapsed && !isMobile ? 1.5 : 2,
                backgroundColor: active ? sidebarTheme.bgActive : 'transparent',
                boxShadow: active ? `inset 3px 0 0 0 ${sidebarTheme.accent}` : 'none',
                '&:hover': {
                  backgroundColor: active ? sidebarTheme.bgActive : sidebarTheme.bgHover,
                },
                transition: 'all 0.15s ease',
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: collapsed && !isMobile ? 0 : 34,
                  color: active ? sidebarTheme.textActive : sidebarTheme.text,
                  justifyContent: 'center',
                }}
              >
                <Icon className="w-[18px] h-[18px]" />
              </ListItemIcon>
              {(!collapsed || isMobile) && (
                <ListItemText
                  primary={link.label}
                  primaryTypographyProps={{
                    fontSize: '0.8125rem',
                    fontWeight: active ? 600 : 400,
                    color: active ? sidebarTheme.textActive : sidebarTheme.text,
                  }}
                />
              )}
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );

  const drawerContent = (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: sidebarTheme.bg,
        borderRight: `1px solid ${sidebarTheme.border}`,
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: collapsed && !isMobile ? 0 : 2.5,
          py: 2,
          justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
          minHeight: 64,
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: '4px',
            background: `linear-gradient(135deg, #adc6ff, #4b8eff)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Typography sx={{ color: '#131313', fontWeight: 800, fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>V</Typography>
        </Box>
        {(!collapsed || isMobile) && (
          <Box>
            <Typography
              sx={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#e5e2e1',
                whiteSpace: 'nowrap',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              VelocityLLM
            </Typography>
            <Typography
              sx={{
                fontSize: '0.5625rem',
                fontFamily: 'var(--font-mono), monospace',
                color: 'rgba(229,226,225,0.3)',
                letterSpacing: '0.1em',
              }}
            >
              v1.0.0
            </Typography>
          </Box>
        )}
      </Box>

      {/* Navigation */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 1, '&::-webkit-scrollbar': { width: 0 } }}>
        {renderNavSection('', mainLinks)}
      </Box>

      {/* Bottom */}
      <Box>
        {renderNavSection('', bottomLinks)}

        {/* Collapse button - desktop only */}
        {!isMobile && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1.5 }}>
            <IconButton
              onClick={onToggleCollapse}
              size="small"
              sx={{ color: sidebarTheme.text, '&:hover': { backgroundColor: sidebarTheme.bgHover } }}
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </IconButton>
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <>
      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={onMobileClose}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              width: SIDEBAR_WIDTH,
              border: 'none',
              backgroundColor: sidebarTheme.bg,
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Desktop Drawer */}
      {!isMobile && (
        <Drawer
          variant="permanent"
          sx={{
            width: width,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: width,
              border: 'none',
              backgroundColor: sidebarTheme.bg,
              transition: 'width 0.2s ease-in-out',
              overflowX: 'hidden',
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}
    </>
  );
}
