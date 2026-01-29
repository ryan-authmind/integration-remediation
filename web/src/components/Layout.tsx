import * as React from 'react';
import IconButton from '@mui/material/IconButton';
import { 
    Box, 
    CssBaseline, 
    AppBar, 
    Toolbar, 
    Typography, 
    Avatar, 
    Menu, 
    MenuItem, 
    Select, 
    Tooltip, 
    Divider,
    Button
} from '@mui/material';

// Icons
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import LogoutIcon from '@mui/icons-material/Logout';

import { ColorModeContext } from '../context/ColorModeContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTenant } from '../context/TenantContext';

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const colorMode = React.useContext(ColorModeContext);
  const { user, logout } = useAuth();
  const { selectedTenant, setSelectedTenant, tenants, loading } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const openUserMenu = Boolean(anchorEl);

  const getThemeIcon = () => {
      switch (colorMode.mode) {
          case 'light': return <Brightness7Icon />;
          case 'dark': return <Brightness4Icon />;
          case 'system': return <SettingsBrightnessIcon />;
          default: return <Brightness7Icon />;
      }
  };

  const menuItems = [
      { text: 'Dashboard', path: '/' },
      { text: 'Tenants', path: '/tenants' },
      { text: 'Integrations', path: '/integrations' },
      { text: 'Action Templates', path: '/actions' },
      { text: 'Workflows', path: '/workflows' },
      { text: 'Audit Logs', path: '/audit' },
  ];

  const handleUserMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
      logout();
      navigate('/login');
  };

  const isSelected = (path: string) => {
      if (path === '/') return location.pathname === '/';
      return location.pathname.startsWith(path);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <CssBaseline />
      <AppBar 
        position="fixed" 
        sx={{ 
            backgroundColor: '#de005b',
            height: 56,
            boxShadow: 'none'
        }}
      >
        <Toolbar sx={{ minHeight: '56px !important', px: '16px !important' }}>
          {/* Logo Section */}
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 4 }}>
            <img 
              src="/logo-darkmode.png" 
              alt="AuthMind Logo" 
              style={{ height: '24px', cursor: 'pointer' }} 
              onClick={() => navigate('/')}
            />
          </Box>

          {/* Navigation Section */}
          <Box sx={{ display: 'flex', gap: 0.5, height: '56px', alignItems: 'center' }}>
            {menuItems.map((item) => (
              <Button
                key={item.text}
                onClick={() => navigate(item.path)}
                sx={{
                  color: '#ffffff',
                  height: '56px',
                  px: 2,
                  borderRadius: 0,
                  fontSize: '0.8125rem',
                  fontWeight: isSelected(item.path) ? 700 : 400,
                  backgroundColor: isSelected(item.path) ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                  borderBottom: isSelected(item.path) ? '3px solid #ffffff' : '3px solid transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  },
                  textTransform: 'none',
                }}
              >
                {item.text}
              </Button>
            ))}
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {!loading && (
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 3, gap: 1 }}>
                    <Select
                        size="small"
                        value={selectedTenant}
                        onChange={(e) => setSelectedTenant(e.target.value as number)}
                        variant="standard"
                        disableUnderline
                        sx={{ 
                            color: 'white', 
                            fontWeight: 600, 
                            fontSize: '0.85rem',
                            '& .MuiSelect-icon': { color: 'white' }
                        }}
                    >
                        <MenuItem value={0}>All Tenants</MenuItem>
                        {tenants.map(t => (
                            <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                        ))}
                    </Select>
                </Box>
            )}
            <Tooltip title={`Current: ${colorMode.mode}`}>
                <IconButton onClick={colorMode.toggleColorMode} color="inherit" size="small">
                    {getThemeIcon()}
                </IconButton>
            </Tooltip>

            {/* User Profile Menu */}
            <Box sx={{ ml: 2, display: 'flex', alignItems: 'center' }}>
                <IconButton 
                    onClick={handleUserMenuClick}
                    sx={{ p: 0 }}
                >
                    <Avatar 
                        src={user?.avatar_url} 
                        sx={{ width: 32, height: 32, border: '2px solid rgba(255,255,255,0.2)' }}
                    >
                        {user?.name?.charAt(0) || 'U'}
                    </Avatar>
                </IconButton>
                <Menu
                    anchorEl={anchorEl}
                    open={openUserMenu}
                    onClose={handleUserMenuClose}
                    transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                    anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                >
                    <Box sx={{ px: 2, py: 1.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{user?.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {user?.email}
                        </Typography>
                    </Box>
                    <Divider />
                    <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
                        <LogoutIcon sx={{ fontSize: 18, mr: 1.5 }} /> Sign Out
                    </MenuItem>
                </Menu>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{ 
            flexGrow: 1, 
            pt: '56px',
            minHeight: '100vh',
        }}
      >
        <Box sx={{ p: 4, maxWidth: '1600px', mx: 'auto' }}>
            {children}
        </Box>
      </Box>
    </Box>
  );
}