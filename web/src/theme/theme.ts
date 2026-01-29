import { PaletteMode } from '@mui/material';

export const getDesignTokens = (mode: PaletteMode) => ({
  palette: {
    mode,
    primary: {
      main: '#de005b', // Core Product Magenta
      light: '#ff4d8d',
      dark: '#a60042',
    },
    secondary: {
      main: '#2d2d2d', // Sidebar Dark Gray
    },
    background: {
      default: mode === 'light' ? '#f4f7f9' : '#0d1117',
      paper: mode === 'light' ? '#ffffff' : '#161b22',
    },
    text: {
      primary: mode === 'light' ? '#333333' : '#c9d1d9',
      secondary: mode === 'light' ? '#666666' : '#8b949e',
    },
    success: {
      main: '#28a745',
    },
    warning: {
      main: '#fb7300',
    },
    error: {
      main: '#dc3545',
    },
    divider: mode === 'light' ? '#e1e4e8' : '#30363d',
  },
  typography: {
    fontFamily: '"Roboto", "Inter", "Segoe UI", "Arial", sans-serif',
    h1: { fontSize: '2rem', fontWeight: 600 },
    h2: { fontSize: '1.75rem', fontWeight: 600 },
    h4: { fontSize: '1.25rem', fontWeight: 600 },
    h6: { fontSize: '1rem', fontWeight: 600 },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
    body1: { fontSize: '0.875rem' },
    body2: { fontSize: '0.75rem' },
  },
  shape: {
    borderRadius: 4, // Core product uses tighter corners
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#de005b', // Bold Magenta Header
          color: '#ffffff',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          padding: '6px 16px',
        },
        containedPrimary: {
          backgroundColor: '#de005b',
          '&:hover': {
            backgroundColor: '#c40052',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          border: mode === 'light' ? '1px solid #e1e4e8' : '1px solid #30363d',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          backgroundColor: mode === 'light' ? '#f8f9fa' : '#161b22',
          color: mode === 'light' ? '#586069' : '#8b949e',
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          padding: '12px 16px',
        },
        root: {
          padding: '12px 16px',
          borderColor: mode === 'light' ? '#e1e4e8' : '#30363d',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: mode === 'light' ? '#fcfcfc' : '#1c2128',
          },
        },
      },
    },
  },
});
