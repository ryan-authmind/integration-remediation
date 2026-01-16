import { useEffect, useState, useRef } from 'react';
import client from '../api/client';
import {
  Box,
  Card,
  CardActions,
  CardContent,
  Button,
  Typography,
  Grid,
  Chip,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Snackbar,
  Divider,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tooltip,
  Paper,
  CircularProgress
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import SecurityIcon from '@mui/icons-material/Security';
import AddIcon from '@mui/icons-material/Add';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import { useTenant } from '../context/TenantContext';

interface Integration {
  id: number;
  tenant_id: number;
  tenant?: { name: string };
  name: string;
  type: string;
  base_url: string;
  auth_type: string;
  credentials: string; // JSON string
  enabled: boolean;
  polling_interval: number;
  last_rotated_at?: string;
  rotation_interval_days: number;
  token_endpoint?: string;
  is_available: boolean;
  consecutive_failures: number;
}

const getVendorLogo = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('authmind')) return '/vendors/authmind.png';
    if (n.includes('servicenow')) return '/vendors/servicenow.png';
    if (n.includes('slack')) return '/vendors/slack.png';
    if (n.includes('microsoft') || n.includes('ad') || n.includes('teams')) return '/vendors/microsoft.png';
    if (n.includes('okta')) return '/vendors/okta.png';
    if (n.includes('torq')) return '/vendors/torq.png';
    if (n.includes('google') || n.includes('secops')) return '/vendors/google.png';
    return null;
};

export default function Integrations() {
  const { selectedTenant } = useTenant();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Integration | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form State
  const [formData, setFormData] = useState({
      name: '',
      type: 'REST',
      base_url: '',
      auth_type: 'none',
      username: '',
      password: '',
      token: '',
      client_id: '',
      client_secret: '',
      token_endpoint: '',
      rotation_interval: 0,
      polling_interval: 60
  });

  const [notification, setNotification] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);

  useEffect(() => {
    fetchIntegrations();
  }, [selectedTenant]);

  const fetchIntegrations = async () => {
    try {
      const res = await client.get('/integrations', {
          headers: { 'X-Tenant-ID': selectedTenant.toString() }
      });
      setIntegrations(res.data);
    } catch (error) {
      console.error("Failed to fetch integrations", error);
    }
  };

  const handleBootstrap = async () => {
      if (selectedTenant === 0) return;
      setBootstrapping(true);
      try {
          await client.post(`/admin/tenants/${selectedTenant}/bootstrap`);
          setNotification({ msg: 'Tenant bootstrapped successfully with standard integrations and actions', type: 'success' });
          fetchIntegrations();
      } catch (err) {
          setNotification({ msg: 'Bootstrap failed', type: 'error' });
      } finally {
          setBootstrapping(false);
      }
  };

  const handleAddNew = () => {
      setSelected(null);
      setFormData({
          name: '',
          type: 'REST',
          base_url: '',
          auth_type: 'none',
          username: '',
          password: '',
          token: '',
          client_id: '',
          client_secret: '',
          token_endpoint: '',
          rotation_interval: 0,
          polling_interval: 60
      });
      setOpen(true);
  };

  const handleEditOpen = (integration: Integration) => {
    setSelected(integration);
    let creds = { username: '', password: '', token: '', client_id: '', client_secret: '' };
    try {
        creds = JSON.parse(integration.credentials);
    } catch (e) {}

    setFormData({
        name: integration.name,
        type: integration.type,
        base_url: integration.base_url,
        auth_type: integration.auth_type,
        username: creds.username || '',
        password: creds.password || '',
        token: creds.token || '',
        client_id: creds.client_id || '',
        client_secret: creds.client_secret || '',
        token_endpoint: integration.token_endpoint || '',
        rotation_interval: integration.rotation_interval_days || 0,
        polling_interval: integration.polling_interval || 60
    });
    setOpen(true);
  };

  const handleSave = async () => {
    const credentials = JSON.stringify({
        username: formData.username,
        password: formData.password,
        token: formData.token,
        client_id: formData.client_id,
        client_secret: formData.client_secret
    });

    const payload = {
        name: formData.name,
        type: formData.type,
        base_url: formData.base_url,
        auth_type: formData.auth_type,
        credentials: credentials,
        token_endpoint: formData.token_endpoint,
        rotation_interval_days: formData.rotation_interval,
        polling_interval: formData.polling_interval,
        enabled: selected ? selected.enabled : true,
        is_available: selected ? selected.is_available : true,
        consecutive_failures: selected ? selected.consecutive_failures : 0
    };

    try {
        const headers = { 'X-Tenant-ID': selectedTenant.toString() };
        if (selected) {
            await client.put('/integrations', { ...payload, id: selected.id }, { headers });
        } else {
            await client.post('/integrations', payload, { headers });
        }
        setNotification({ msg: `Integration ${selected ? 'updated' : 'created'} successfully`, type: 'success' });
        setOpen(false);
        fetchIntegrations();
    } catch (error) {
        setNotification({ msg: 'Operation failed', type: 'error' });
    }
  };

  const handleToggle = async (integration: Integration) => {
      try {
          const updated = { ...integration, enabled: !integration.enabled };
          await client.put('/integrations', updated, {
              headers: { 'X-Tenant-ID': selectedTenant.toString() }
          });
          setIntegrations(prev => prev.map(i => i.id === integration.id ? updated : i));
      } catch (e) {
          setNotification({ msg: 'Failed to toggle', type: 'error' });
      }
  };

  const handleReset = async (integration: Integration) => {
      try {
          await client.put(`/integrations/${integration.id}/reset`, {}, {
              headers: { 'X-Tenant-ID': selectedTenant.toString() }
          });
          setNotification({ msg: `Connection reset for ${integration.name}`, type: 'success' });
          fetchIntegrations();
      } catch (e) {
          setNotification({ msg: 'Failed to reset connection', type: 'error' });
      }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
          try {
              const content = JSON.parse(e.target?.result as string);
              await client.post('/import', content);
              setNotification({ msg: 'Configuration imported successfully', type: 'success' });
              fetchIntegrations();
          } catch (err) {
              setNotification({ msg: 'Import failed: Invalid JSON format', type: 'error' });
          }
      };
      reader.readAsText(file);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <div>
            <Typography variant="h4" gutterBottom>Integrations</Typography>
            <Typography variant="body1" color="text.secondary">
                Configure external service connections and security rotation policies.
            </Typography>
        </div>
        <Box sx={{ display: 'flex', gap: 2 }}>
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileUpload}
                accept=".json"
            />
            <Tooltip title="Upload JSON configuration">
                <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => fileInputRef.current?.click()}>
                    Import
                </Button>
            </Tooltip>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddNew}>
                New Integration
            </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {integrations.length === 0 && selectedTenant !== 0 && (
            <Grid item xs={12}>
                <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', bgcolor: 'action.hover', borderStyle: 'dashed' }}>
                    <CloudQueueIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                    <Typography variant="h6" gutterBottom>No Integrations Found</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                        This tenant is empty. You can start from scratch or bootstrap it with standard templates.
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                        <Button 
                            variant="contained" 
                            color="secondary" 
                            startIcon={bootstrapping ? <CircularProgress size={20} color="inherit" /> : <AutoFixHighIcon />}
                            onClick={handleBootstrap}
                            disabled={bootstrapping}
                        >
                            Bootstrap from Templates
                        </Button>
                        <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddNew}>
                            Add Manually
                        </Button>
                    </Box>
                </Paper>
            </Grid>
        )}
        {integrations.map((item) => (
          <Grid item xs={12} md={6} lg={4} key={item.id}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {getVendorLogo(item.name) ? (
                            <img 
                                src={getVendorLogo(item.name)!} 
                                alt={item.name} 
                                style={{ height: '32px', maxWidth: '120px', objectFit: 'contain' }} 
                            />
                        ) : (
                            <CloudQueueIcon color="primary" />
                        )}
                        {selectedTenant === 0 && item.tenant && (
                            <Chip 
                                label={item.tenant.name} 
                                size="small" 
                                color="secondary" 
                                variant="filled" 
                                sx={{ fontWeight: 700, fontSize: '0.65rem', height: 20 }} 
                            />
                        )}
                    </Box>
                    <Chip label={item.auth_type.toUpperCase()} size="small" variant="outlined" />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{item.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{item.base_url}</Typography>
                
                {!item.is_available && (
                    <Alert severity="error" sx={{ mb: 2, py: 0, '& .MuiAlert-icon': { fontSize: 18 } }}>
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>
                            SERVICE UNAVAILABLE
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '0.7rem', display: 'block' }}>
                            Disabled after {item.consecutive_failures} consecutive failures.
                        </Typography>
                    </Alert>
                )}

                {item.rotation_interval_days > 0 && (
                    <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SecurityIcon sx={{ fontSize: 16, color: 'success.main' }} />
                        <Typography variant="caption" color="success.main">
                            Auto-rotation: Every {item.rotation_interval_days} days
                        </Typography>
                    </Box>
                )}
              </CardContent>
              <Divider />
              <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                <FormControlLabel
                  control={<Switch checked={item.enabled} onChange={() => handleToggle(item)} />}
                  label="Enabled"
                />
                <Box>
                    {!item.is_available && (
                        <Button 
                            size="small" 
                            variant="contained" 
                            color="warning" 
                            sx={{ mr: 1, fontWeight: 700, fontSize: '0.7rem' }}
                            onClick={() => handleReset(item)}
                        >
                            Reset Connection
                        </Button>
                    )}
                    <Button startIcon={<SettingsIcon />} onClick={() => handleEditOpen(item)}>Configure</Button>
                </Box>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selected ? `Update ${selected.name}` : 'New Integration'}</DialogTitle>
        <DialogContent dividers>
            <Grid container spacing={3} sx={{ mt: 0 }}>
                <Grid item xs={12}>
                    <TextField 
                        label="Friendly Name" 
                        fullWidth 
                        value={formData.name}
                        onChange={(e) => {
                            const newName = e.target.value;
                            let extra = {};
                            if (formData.auth_type === 'oauth2' && newName.toLowerCase().includes('slack') && !formData.token_endpoint) {
                                extra = { token_endpoint: 'https://slack.com/api/oauth.v2.access' };
                            }
                            setFormData({...formData, name: newName, ...extra});
                        }}
                    />
                </Grid>
                <Grid item xs={12}>
                    <TextField 
                        label="Base URL / Host" 
                        fullWidth 
                        value={formData.base_url}
                        onChange={(e) => setFormData({...formData, base_url: e.target.value})}
                    />
                </Grid>
                <Grid item xs={6}>
                    <FormControl fullWidth>
                        <InputLabel>Connection Type</InputLabel>
                        <Select
                            value={formData.type}
                            label="Connection Type"
                            onChange={(e) => setFormData({...formData, type: e.target.value})}
                        >
                            <MenuItem value="REST">REST API</MenuItem>
                            <MenuItem value="WINRM">WinRM (Windows)</MenuItem>
                            <MenuItem value="EMAIL">Email Service</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item xs={6}>
                    <FormControl fullWidth>
                        <InputLabel>Authentication Type</InputLabel>
                        <Select
                            value={formData.auth_type}
                            label="Authentication Type"
                            onChange={(e) => {
                                const newType = e.target.value;
                                let extra = {};
                                if (newType === 'oauth2' && formData.name.toLowerCase().includes('slack') && !formData.token_endpoint) {
                                    extra = { token_endpoint: 'https://slack.com/api/oauth.v2.access' };
                                }
                                setFormData({...formData, auth_type: newType, ...extra});
                            }}
                        >
                            <MenuItem value="none">None</MenuItem>
                            <MenuItem value="basic">Basic (User/Pass)</MenuItem>
                            <MenuItem value="bearer">Bearer Token</MenuItem>
                            <MenuItem value="apikey">Custom Header (API Key)</MenuItem>
                            <MenuItem value="ntlm">NTLM (Windows)</MenuItem>
                            <MenuItem value="oauth2">OAuth2 Client Credentials</MenuItem>
                        </Select>
                    </FormControl>
                </Grid>

                {formData.auth_type === 'oauth2' && (
                    <>
                        <Grid item xs={12}>
                            <TextField 
                                label="Token Endpoint URL" 
                                fullWidth 
                                placeholder="https://slack.com/api/oauth.v2.access"
                                value={formData.token_endpoint}
                                onChange={(e) => setFormData({...formData, token_endpoint: e.target.value})}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField 
                                label="Client ID" 
                                fullWidth 
                                value={formData.client_id}
                                onChange={(e) => setFormData({...formData, client_id: e.target.value})}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField 
                                label="Client Secret" 
                                type="password" 
                                fullWidth 
                                value={formData.client_secret}
                                onChange={(e) => setFormData({...formData, client_secret: e.target.value})}
                            />
                        </Grid>
                    </>
                )}

                {formData.auth_type === 'basic' || formData.auth_type === 'ntlm' ? (
                    <>
                        <Grid item xs={6}>
                            <TextField 
                                label="Username" 
                                fullWidth 
                                value={formData.username}
                                onChange={(e) => setFormData({...formData, username: e.target.value})}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField 
                                label="Password" 
                                type="password" 
                                fullWidth 
                                value={formData.password}
                                onChange={(e) => setFormData({...formData, password: e.target.value})}
                            />
                        </Grid>
                    </>
                ) : (formData.auth_type === 'bearer' || formData.auth_type === 'apikey') ? (
                    <Grid item xs={12}>
                        <TextField 
                            label="API / Bearer Token" 
                            type="password"
                            fullWidth 
                            value={formData.token}
                            onChange={(e) => setFormData({...formData, token: e.target.value})}
                        />
                    </Grid>
                ) : null}

                <Grid item xs={12}>
                    <Divider sx={{ my: 1 }}>
                        <Chip label="Policies" size="small" />
                    </Divider>
                </Grid>
                
                <Grid item xs={6}>
                    <TextField 
                        label="Rotation Interval (Days)" 
                        type="number"
                        fullWidth 
                        value={formData.rotation_interval}
                        onChange={(e) => setFormData({...formData, rotation_interval: parseInt(e.target.value) || 0})}
                    />
                </Grid>

                <Grid item xs={6}>
                    <TextField 
                        label="Polling Interval (Sec)" 
                        type="number"
                        fullWidth 
                        disabled={!formData.name.toLowerCase().includes("authmind")}
                        value={formData.polling_interval}
                        onChange={(e) => setFormData({...formData, polling_interval: parseInt(e.target.value) || 60})}
                    />
                </Grid>
            </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.name || !formData.base_url}>
              {selected ? 'Save Changes' : 'Create Integration'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar 
        open={!!notification} 
        autoHideDuration={4000} 
        onClose={() => setNotification(null)}
      >
        <Alert severity={notification?.type || 'info'}>{notification?.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
