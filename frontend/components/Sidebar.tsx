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
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import {
  LayoutDashboard, FlaskConical, BarChart3, Activity,
  Cpu, Briefcase, Radio, Coins, Key, CreditCard, Gauge, Zap, Webhook,
  Shield, Users, ChevronLeft, ChevronRight, Settings,
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
  { href: '/playground', label: 'Playground', icon: FlaskConical },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/monitoring', label: 'Monitoring', icon: Activity },
];

const infraLinks: NavItem[] = [
  { href: '/workers', label: 'Workers', icon: Cpu },
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/streams', label: 'Streams', icon: Radio },
  { href: '/tokens', label: 'Tokens', icon: Coins },
  { href: '/keys', label: 'API Keys', icon: Key },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/quota', label: 'Quota', icon: Gauge },
  { href: '/loadtest', label: 'Load Test', icon: Zap },
  { href: '/webhooks', label: 'Webhooks', icon: Webhook },
];

const adminLinks: NavItem[] = [
  { href: '/admin/dashboard', label: 'Admin Dashboard', icon: Shield },
  { href: '/admin/users', label: 'User Management', icon: Users },
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
    <Box sx={{ mb: 1 }}>
      {!collapsed && (
        <Typography
          sx={{
            px: 2.5,
            pt: 2,
            pb: 0.5,
            fontSize: '0.65rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: sidebarTheme.text,
            opacity: 0.5,
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
                borderRadius: '8px',
                minHeight: 40,
                justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                px: collapsed && !isMobile ? 1.5 : 2,
                backgroundColor: active ? sidebarTheme.bgActive : 'transparent',
                '&:hover': {
                  backgroundColor: active ? sidebarTheme.bgActive : sidebarTheme.bgHover,
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: collapsed && !isMobile ? 0 : 36,
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
                    fontSize: '0.835rem',
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
            width: 32,
            height: 32,
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '0.875rem' }}>V</Typography>
        </Box>
        {(!collapsed || isMobile) && (
          <Typography
            sx={{
              fontSize: '1.1rem',
              fontWeight: 700,
              color: '#e0e0e0',
              whiteSpace: 'nowrap',
            }}
          >
            VelocityLLM
          </Typography>
        )}
      </Box>

      <Divider sx={{ borderColor: sidebarTheme.border, mx: 1 }} />

      {/* Navigation */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 1, '&::-webkit-scrollbar': { width: 0 } }}>
        {renderNavSection('Main', mainLinks)}
        {renderNavSection('Infrastructure', infraLinks)}
        {renderNavSection('Admin', adminLinks)}
      </Box>

      {/* Bottom */}
      <Box>
        <Divider sx={{ borderColor: sidebarTheme.border, mx: 1 }} />
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
