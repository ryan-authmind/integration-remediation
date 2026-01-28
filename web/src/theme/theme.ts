import { PaletteMode } from '@mui/material';

export const getDesignTokens = (mode: PaletteMode) => ({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
          // AuthMind Dashboard Light
          primary: {
            main: '#ff1253', // Primary Brand Magenta
            light: '#ff5a85',
            dark: '#c10a53',
          },
          secondary: {
            main: '#232247', // Brand Deep Space
          },
          warning: {
            main: '#fb7300', // Brand Orange (Medium Risk)
          },
          info: {
            main: '#fbb400', // Brand Yellow (Low Risk)
          },
          background: {
            default: '#f8fafb',
            paper: '#ffffff',
          },
          text: {
            primary: '#232247',
            secondary: '#73838f',
          },
          success: {
            main: '#5ab645', // Brand Green
          },
          error: {
            main: '#ff2b00', // Brand Red
          },
          divider: '#ced5db',
        }
      : {
          // AuthMind Dashboard Dark
          primary: {
            main: '#ff1253', // Primary Brand Magenta
            light: '#ff5a85',
            dark: '#c10a53',
          },
          secondary: {
            main: '#232247',
          },
          warning: {
            main: '#fb7300',
          },
          info: {
            main: '#fbb400',
          },
          background: {
            default: '#0A0E17', // Keep deep dark for contrast
            paper: '#161B22',   // Slightly lighter
          },
          text: {
            primary: '#ced5db',
            secondary: '#73838f',
          },
          success: {
            main: '#5ab645',
          },
          error: {
            main: '#ff2b00',
          },
          divider: '#464d70',
        }),
  },
  typography: {
    fontFamily: '"Futura PT", "Century Gothic", "Inter", sans-serif',
    h1: { fontSize: '2.5rem', fontWeight: 700, letterSpacing: '0.05em' },
    h2: { fontSize: '2rem', fontWeight: 700, letterSpacing: '0.05em' },
    h4: { fontWeight: 700, letterSpacing: '0.05em' },
    button: {
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: '0.05em',
    },
    body1: {
      letterSpacing: '0.02em',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#232247', // Brand Deep Space
          color: '#ffffff',
          boxShadow: 'none',
          borderBottom: '1px solid #464d70',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
        containedPrimary: {
          backgroundColor: '#ff1253',
          color: '#ffffff',
          '&:hover': {
            backgroundColor: '#ff3d71',
            boxShadow: '0px 4px 12px rgba(255,18,83,0.3)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: mode === 'light' ? '1px solid #ced5db' : '1px solid #464d70',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: mode === 'light' ? '#ffffff' : '#0a0a0c',
          borderRight: mode === 'light' ? '1px solid #ced5db' : '1px solid #464d70',
        },
      },
    },
  },
});
