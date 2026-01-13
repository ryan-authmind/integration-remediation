import { PaletteMode } from '@mui/material';

export const getDesignTokens = (mode: PaletteMode) => ({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
          // AuthMind Dashboard Light
          primary: {
            main: '#e11d48', // Vibrant Magenta/Pink
            light: '#fb7185',
            dark: '#9f1239',
          },
          secondary: {
            main: '#1e1b4b', // Deep Navy
          },
          background: {
            default: '#f8fafc',
            paper: '#ffffff',
          },
          text: {
            primary: '#0f172a',
            secondary: '#64748b',
          },
        }
      : {
          // AuthMind Dashboard Dark
          primary: {
            main: '#00f5d4', // Neon Cyan/Green
            light: '#5eead4',
            dark: '#0d9488',
          },
          secondary: {
            main: '#000000',
          },
          background: {
            default: '#000000', // Pure Black
            paper: '#0a0a0a',   // Very Deep Grey
          },
          text: {
            primary: '#ffffff',
            secondary: '#94a3b8',
          },
        }),
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '2.5rem', fontWeight: 700 },
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
          backgroundColor: mode === 'light' ? '#e11d48' : '#00f5d4',
          color: mode === 'light' ? '#ffffff' : '#000000',
          boxShadow: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
        },
        containedPrimary: {
          backgroundColor: mode === 'light' ? '#e11d48' : '#00f5d4',
          color: mode === 'light' ? '#ffffff' : '#000000',
          '&:hover': {
            backgroundColor: mode === 'light' ? '#be123c' : '#2dd4bf',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: mode === 'light' ? '1px solid #e2e8f0' : '1px solid #1e293b',
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
