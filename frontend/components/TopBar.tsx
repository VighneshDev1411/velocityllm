'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import { Menu as MenuIcon, User, LogOut, Settings, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useColorMode } from '@/contexts/ColorModeContext';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/playground': 'Playground',
  '/analytics': 'Analytics',
  '/monitoring': 'Monitoring',
  '/workers': 'Workers',
  '/jobs': 'Jobs',
  '/streams': 'Streams',
  '/tokens': 'Tokens',
  '/keys': 'API Keys',
  '/billing': 'Billing',
  '/quota': 'Quota',
  '/loadtest': 'Load Test',
  '/webhooks': 'Webhooks',
  '/settings': 'Settings',
  '/profile': 'Profile',
  '/docs': 'API Docs',
  '/admin/dashboard': 'Admin Dashboard',
  '/admin/users': 'User Management',
};

interface TopBarProps {
  onMenuClick: () => void;
  sidebarWidth: number;
}

export function TopBar({ onMenuClick, sidebarWidth }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { mode, toggleColorMode } = useColorMode();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const pageTitle = pageTitles[pathname] || 'VelocityLLM';

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
  };

  const initials = (user?.username || 'U')[0].toUpperCase();

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        width: { md: `calc(100% - ${sidebarWidth}px)` },
        ml: { md: `${sidebarWidth}px` },
        transition: 'width 0.2s ease-in-out, margin-left 0.2s ease-in-out',
      }}
    >
      <Toolbar sx={{ minHeight: '56px !important', px: { xs: 2, sm: 3 } }}>
        {/* Mobile menu button */}
        <IconButton
          onClick={onMenuClick}
          sx={{ mr: 1.5, display: { md: 'none' } }}
          color="inherit"
        >
          <MenuIcon className="w-5 h-5" />
        </IconButton>

        {/* Page title */}
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, fontSize: '1.1rem', flexGrow: 1 }}
        >
          {pageTitle}
        </Typography>

        {/* Dark / Light toggle */}
        <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          <IconButton onClick={toggleColorMode} color="inherit" sx={{ mr: 1 }}>
            {mode === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </IconButton>
        </Tooltip>

        {/* User menu trigger */}
        <Box
          onClick={handleMenuOpen}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            cursor: 'pointer',
            px: 1.5,
            py: 0.75,
            borderRadius: '8px',
            '&:hover': { backgroundColor: 'action.hover' },
          }}
        >
          <Avatar
            sx={{
              width: 32,
              height: 32,
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              fontSize: '0.85rem',
              fontWeight: 600,
            }}
          >
            {initials}
          </Avatar>
          <Typography
            sx={{
              fontSize: '0.875rem',
              fontWeight: 500,
              display: { xs: 'none', sm: 'block' },
            }}
          >
            {user?.username || 'Profile'}
          </Typography>
        </Box>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{
            paper: {
              sx: {
                mt: 1,
                minWidth: 200,
                borderRadius: '10px',
              },
            },
          }}
        >
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
              {user?.username}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
              {user?.email}
            </Typography>
          </Box>
          <Divider />
          <MenuItem
            onClick={() => { handleMenuClose(); router.push('/profile'); }}
            sx={{ fontSize: '0.875rem', py: 1 }}
          >
            <ListItemIcon><User className="w-4 h-4" /></ListItemIcon>
            Profile
          </MenuItem>
          <MenuItem
            onClick={() => { handleMenuClose(); router.push('/settings'); }}
            sx={{ fontSize: '0.875rem', py: 1 }}
          >
            <ListItemIcon><Settings className="w-4 h-4" /></ListItemIcon>
            Settings
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={handleLogout}
            sx={{ fontSize: '0.875rem', py: 1, color: 'error.main' }}
          >
            <ListItemIcon><LogOut className="w-4 h-4" style={{ color: 'inherit' }} /></ListItemIcon>
            Logout
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
