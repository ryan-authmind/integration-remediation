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
import { BrowserRouter, Routes, Route } from 'react-router-dom';

export default function App() {
    // ...
  const [mode, setMode] = React.useState<'light' | 'dark'>('dark');

  const colorMode = React.useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
      },
    }),
    [],
  );

  const theme = React.useMemo(() => createTheme(getDesignTokens(mode)), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
            <Layout>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/integrations" element={<Integrations />} />
                    <Route path="/actions" element={<ActionTemplates />} />
                    <Route path="/workflows" element={<Workflows />} />
                    <Route path="/workflows/:id" element={<WorkflowEditor />} />
                </Routes>
            </Layout>
        </BrowserRouter>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
