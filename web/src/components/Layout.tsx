import * as React from 'react';
import { useTheme } from '@mui/material/styles';
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
import DashboardIcon from '@mui/icons-material/Dashboard';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ListAltIcon from '@mui/icons-material/ListAlt';

import { ColorModeContext } from '../context/ColorModeContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const theme = useTheme();
  const colorMode = React.useContext(ColorModeContext);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
      { text: 'Dashboard', icon: <DashboardIcon sx={{ fontSize: 20 }} />, path: '/' },
      { text: 'Integrations', icon: <IntegrationInstructionsIcon sx={{ fontSize: 20 }} />, path: '/integrations' },
      { text: 'Action Templates', icon: <ListAltIcon sx={{ fontSize: 20 }} />, path: '/actions' },
      { text: 'Workflows', icon: <AccountTreeIcon sx={{ fontSize: 20 }} />, path: '/workflows' },
  ];

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
                  bgcolor: isSelected(item.path) ? 'rgba(0, 98, 255, 0.2)' : 'transparent',
                  borderBottom: isSelected(item.path) ? '2px solid #0062FF' : 'none',
                  '&:hover': {
                    bgcolor: 'rgba(0, 98, 255, 0.1)',
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
            <Typography variant="body2" sx={{ mr: 2, fontWeight: 600, opacity: 0.9 }}>
                Integration Engine
            </Typography>
            <IconButton onClick={colorMode.toggleColorMode} color="inherit">
                {theme.palette.mode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{ 
            flexGrow: 1, 
            bgcolor: 'background.default', 
            pt: '80px', // Adjusted for fixed header
            pb: 4,
            px: 4
        }}
      >
        <Container sx={{ maxWidth: '1600px', mx: 'auto' }}>
            {children}
        </Container>
      </Box>
    </Box>
  );
}