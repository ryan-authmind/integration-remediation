import { PaletteMode } from '@mui/material';

export const getDesignTokens = (mode: PaletteMode) => ({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
          // AuthMind Dashboard Light
          primary: {
            main: '#0062FF', // Primary Brand Blue
            light: '#4d91ff',
            dark: '#004ecb',
          },
          secondary: {
            main: '#0A0E17', // Deep Space
          },
          background: {
            default: '#f8fafc',
            paper: '#ffffff',
          },
          text: {
            primary: '#0f172a',
            secondary: '#64748b',
          },
          success: {
            main: '#00D1B2', // Observability Teal
          },
          error: {
            main: '#FF4C4C', // Risk Coral
          },
        }
      : {
          // AuthMind Dashboard Dark
          primary: {
            main: '#0062FF', // Primary Brand Blue
            light: '#4d91ff',
            dark: '#004ecb',
          },
          secondary: {
            main: '#161B22',
          },
          background: {
            default: '#0A0E17', // Deep Space
            paper: '#161B22',   // Slightly lighter
          },
          text: {
            primary: '#F8F9FA',
            secondary: '#ADB5BD',
          },
          success: {
            main: '#00D1B2', // Observability Teal
          },
          error: {
            main: '#FF4C4C', // Risk Coral
          },
        }),
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '2.5rem', fontWeight: 700, letterSpacing: '0.02em' },
    h2: { fontSize: '2rem', fontWeight: 700 },
    h4: { fontWeight: 700 },
    button: {
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#0A0E17', // Always Deep Space for AuthMind Identity
          color: '#ffffff',
          boxShadow: 'none',
          borderBottom: '1px solid #2D333B',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8, // Rounded corners (8px) per guide
        },
        containedPrimary: {
          backgroundColor: '#0062FF',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#1a72ff', // Slight brightness increase
            boxShadow: '0px 4px 12px rgba(0,0,0,0.2)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid #2D333B', // Divider color from guide
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: mode === 'light' ? '#ffffff' : '#000000',
          borderRight: mode === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b',
        },
      },
    },
  },
});
