import * as React from 'react';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Container from '@mui/material/Box';

// Icons
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import DashboardIcon from '@mui/icons-material/Dashboard';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ListAltIcon from '@mui/icons-material/ListAlt';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import HistoryIcon from '@mui/icons-material/History';
import LogoutIcon from '@mui/icons-material/Logout';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

import { ColorModeContext } from '../context/ColorModeContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTenant } from '../context/TenantContext';
import { Avatar, Menu, MenuItem, Select, Tooltip, Chip, Divider } from '@mui/material';

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
      { text: 'Dashboard', icon: <DashboardIcon sx={{ fontSize: 20 }} />, path: '/' },
      { text: 'Tenants', icon: <CorporateFareIcon sx={{ fontSize: 20 }} />, path: '/tenants' },
      { text: 'Integrations', icon: <IntegrationInstructionsIcon sx={{ fontSize: 20 }} />, path: '/integrations' },
      { text: 'Action Templates', icon: <ListAltIcon sx={{ fontSize: 20 }} />, path: '/actions' },
      { text: 'Workflows', icon: <AccountTreeIcon sx={{ fontSize: 20 }} />, path: '/workflows' },
      { text: 'Audit Logs', icon: <HistoryIcon sx={{ fontSize: 20 }} />, path: '/audit' },
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
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <CssBaseline />
      <AppBar position="fixed">
        <Toolbar sx={{ height: 64 }}>
          {/* Logo Section */}
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 4 }}>
            <img 
              src="/logo-darkmode.png" 
              alt="AuthMind Logo" 
              style={{ height: '28px', cursor: 'pointer' }} 
              onClick={() => navigate('/')}
            />
          </Box>

          {/* Navigation Items */}
          <Box sx={{ display: 'flex', flexGrow: 1, gap: 1, height: '100%', alignItems: 'center' }}>
            {menuItems.map((item) => (
              <Button
                key={item.text}
                onClick={() => navigate(item.path)}
                startIcon={item.icon}
                sx={{
                  color: 'inherit',
                  height: '40px',
                  px: 2,
                  borderRadius: 1,
                  opacity: isSelected(item.path) ? 1 : 0.8,
                  bgcolor: isSelected(item.path) ? 'rgba(255, 18, 83, 0.1)' : 'transparent',
                  borderBottom: isSelected(item.path) ? '2px solid #ff1253' : 'none',
                  '&:hover': {
                    bgcolor: 'rgba(255, 18, 83, 0.05)',
                    opacity: 1,
                  },
                  fontWeight: isSelected(item.path) ? 700 : 500,
                }}
              >
                {item.text}
              </Button>
            ))}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {!loading && (
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 3, gap: 1 }}>
                    <CorporateFareIcon sx={{ color: 'primary.main', fontSize: 20 }} />
                    <Select
                        size="small"
                        value={selectedTenant}
                        onChange={(e) => setSelectedTenant(e.target.value as number)}
                        variant="standard"
                        disableUnderline
                        sx={{ 
                            color: 'white', 
                            fontWeight: 700, 
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
            <Typography variant="body2" sx={{ mr: 2, fontWeight: 600, opacity: 0.9 }}>
                Integration Engine
            </Typography>
            <Tooltip title={`Current: ${colorMode.mode}`}>
                <IconButton onClick={colorMode.toggleColorMode} color="inherit">
                    {getThemeIcon()}
                </IconButton>
            </Tooltip>

            {/* User Profile Menu */}
            <Box sx={{ ml: 2, display: 'flex', alignItems: 'center' }}>
                <IconButton 
                    onClick={handleUserMenuClick}
                    sx={{ p: 0.5, border: '1px solid rgba(255,255,255,0.2)' }}
                >
                    <Avatar 
                        src={user?.avatar_url} 
                        sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '1rem', fontWeight: 800 }}
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
                    PaperProps={{
                        sx: {
                            mt: 1.5,
                            width: 220,
                            borderRadius: 2,
                            boxShadow: '0px 10px 25px rgba(35, 34, 71, 0.15)',
                        }
                    }}
                >
                    <Box sx={{ px: 2, py: 1.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{user?.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block' }}>
                            {user?.email}
                        </Typography>
                        <Chip 
                            label={user?.role?.toUpperCase()} 
                            size="small" 
                            sx={{ mt: 1, fontWeight: 800, fontSize: '0.6rem', height: 18, bgcolor: 'rgba(255,18,83,0.1)', color: 'primary.main' }} 
                        />
                    </Box>
                    <Divider />
                    <MenuItem onClick={handleUserMenuClose} sx={{ py: 1, fontSize: '0.85rem', fontWeight: 600 }}>
                        <AccountCircleIcon sx={{ fontSize: 18, mr: 1.5, color: 'text.secondary' }} /> Profile Settings
                    </MenuItem>
                    <MenuItem onClick={handleLogout} sx={{ py: 1, fontSize: '0.85rem', fontWeight: 600, color: 'error.main' }}>
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
            bgcolor: 'background.default', 
            pt: '80px', 
            pb: 4,
            px: 4,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              opacity: 0.03,
              pointerEvents: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10 L90 10 L90 90 L10 90 Z' fill='none' stroke='%23ff1253' stroke-width='0.5'/%3E%3Ccircle cx='10' cy='10' r='2' fill='%23ff1253'/%3E%3Ccircle cx='90' cy='10' r='2' fill='%23fb7300'/%3E%3Ccircle cx='90' cy='90' r='2' fill='%23fbb400'/%3E%3C/svg%3E")`,
              backgroundSize: '400px 400px',
            }
        }}
      >
        <Container sx={{ maxWidth: '1600px', mx: 'auto' }}>
            {children}
        </Container>
      </Box>
    </Box>
  );
}