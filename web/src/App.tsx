import * as React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { getDesignTokens } from './theme/theme';
import { ColorModeContext } from './context/ColorModeContext';
import Layout from './components/Layout';
import Integrations from './pages/Integrations';
import Workflows from './pages/Workflows';
import WorkflowEditor from './pages/WorkflowEditor';
import ActionTemplates from './pages/ActionTemplates';
import Dashboard from './pages/Dashboard';
import TenantManagement from './pages/TenantManagement';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TenantProvider } from './context/TenantContext';
import useMediaQuery from '@mui/material/useMediaQuery';

export default function App() {
  const [mode, setMode] = React.useState<'light' | 'dark' | 'system'>('light');
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const colorMode = React.useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => {
            if (prevMode === 'light') return 'dark';
            if (prevMode === 'dark') return 'system';
            return 'light';
        });
      },
      mode,
    }),
    [mode],
  );

  const theme = React.useMemo(() => {
    let actualMode: 'light' | 'dark' = 'light';
    if (mode === 'system') {
        actualMode = prefersDarkMode ? 'dark' : 'light';
    } else {
        actualMode = mode;
    }
    return createTheme(getDesignTokens(actualMode));
  }, [mode, prefersDarkMode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <TenantProvider>
            <BrowserRouter>
                <Layout>
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/tenants" element={<TenantManagement />} />
                        <Route path="/integrations" element={<Integrations />} />
                        <Route path="/actions" element={<ActionTemplates />} />
                        <Route path="/workflows" element={<Workflows />} />
                        <Route path="/workflows/:id" element={<WorkflowEditor />} />
                    </Routes>
                </Layout>
            </BrowserRouter>
        </TenantProvider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}