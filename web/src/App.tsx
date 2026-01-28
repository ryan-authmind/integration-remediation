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
import AuditLog from './pages/AuditLog';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TenantProvider } from './context/TenantContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) return null;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return <Layout>{children}</Layout>;
}

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
        <AuthProvider>
          <TenantProvider>
              <BrowserRouter>
                  <Routes>
                      <Route path="/login" element={<Login />} />
                      
                      {/* Protected Routes */}
                      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                      <Route path="/tenants" element={<ProtectedRoute><TenantManagement /></ProtectedRoute>} />
                      <Route path="/integrations" element={<ProtectedRoute><Integrations /></ProtectedRoute>} />
                      <Route path="/actions" element={<ProtectedRoute><ActionTemplates /></ProtectedRoute>} />
                      <Route path="/workflows" element={<ProtectedRoute><Workflows /></ProtectedRoute>} />
                      <Route path="/workflows/:id" element={<ProtectedRoute><WorkflowEditor /></ProtectedRoute>} />
                      <Route path="/audit" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
                  </Routes>
              </BrowserRouter>
          </TenantProvider>
        </AuthProvider>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}