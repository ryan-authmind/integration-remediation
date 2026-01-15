import { useEffect, useState } from 'react';
import client from '../api/client';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Alert,
  Snackbar
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { useTenant } from '../context/TenantContext';

interface Tenant {
  id: number;
  name: string;
  description: string;
  api_key: string;
}

export default function TenantManagement() {
  const { refreshTenants } = useTenant();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', api_key: '' });
  const [notification, setNotification] = useState<{ msg: string, type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const res = await client.get('/admin/tenants');
      setTenants(res.data);
    } catch (error) {
      console.error("Failed to fetch tenants", error);
    }
  };

  const handleAddNew = () => {
    setSelected(null);
    setFormData({ name: '', description: '', api_key: '' });
    setOpen(true);
  };

  const handleEdit = (tenant: Tenant) => {
    setSelected(tenant);
    setFormData({ name: tenant.name, description: tenant.description, api_key: tenant.api_key });
    setOpen(true);
  };

  const handleSave = async () => {
    try {
      if (selected) {
        await client.put(`/admin/tenants/${selected.id}`, formData);
      } else {
        await client.post('/admin/tenants', formData);
      }
      setNotification({ msg: `Tenant ${selected ? 'updated' : 'created'} successfully`, type: 'success' });
      setOpen(false);
      fetchTenants();
      refreshTenants(); // Sync global selector
    } catch (error) {
      setNotification({ msg: 'Operation failed', type: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this tenant? This will archive all associated data.")) return;
    try {
      await client.delete(`/admin/tenants/${id}`);
      setNotification({ msg: 'Tenant deleted successfully', type: 'success' });
      fetchTenants();
      refreshTenants(); // Sync global selector
    } catch (error) {
      setNotification({ msg: 'Delete failed', type: 'error' });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <div>
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>Tenant Management</Typography>
          <Typography variant="body1" color="text.secondary">
            Manage customers, distinct environments, and their global API access.
          </Typography>
        </div>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddNew}>
          New Tenant
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>ID</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Tenant Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>API Key</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id} hover>
                <TableCell>{tenant.id}</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{tenant.name}</TableCell>
                <TableCell color="text.secondary">{tenant.description || 'No description'}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{tenant.api_key || 'N/A'}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleEdit(tenant)} color="primary"><EditIcon /></IconButton>
                  <IconButton onClick={() => handleDelete(tenant.id)} color="error"><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{selected ? 'Edit Tenant' : 'Create New Tenant'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField label="Tenant Name" fullWidth value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Description" multiline rows={3} fullWidth value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="External API Key (Optional)" fullWidth value={formData.api_key} onChange={(e) => setFormData({...formData, api_key: e.target.value})} helperText="Used for external integrations to identify this tenant." />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!formData.name}>Save Tenant</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!notification} autoHideDuration={4000} onClose={() => setNotification(null)}>
        <Alert severity={notification?.type || 'info'}>{notification?.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
