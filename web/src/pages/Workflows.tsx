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
  Chip,
  IconButton,
  Switch,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Select,
  MenuItem,
  TextField,
  InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../context/TenantContext';

interface Workflow {
  id: number;
  tenant_id: number;
  tenant?: { name: string };
  name: string;
  description: string;
  enabled: boolean;
  trigger_type: string;
  min_severity: string;
  pollers: Array<{ id: number, name: string }>;
  steps: Array<{ id?: number, action_type?: string, definition?: { name: string } }>;
}

const getSeverityColor = (sev: string) => {
    switch (sev) {
        case 'Critical': return 'error'; // Magenta in theme
        case 'High': return 'error';     // Magenta in theme
        case 'Medium': return 'warning'; // Orange in theme
        case 'Low': return 'info';       // Yellow in theme
        default: return 'default';
    }
};

export default function Workflows() {
  const { selectedTenant } = useTenant();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [triggerFilter, setTriggerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchWorkflows();
  }, [selectedTenant, search, triggerFilter, statusFilter]);

  const fetchWorkflows = async () => {
    try {
      const res = await client.get(`/workflows?search=${search}&trigger_type=${triggerFilter}&enabled=${statusFilter}`, {
          headers: { 'X-Tenant-ID': selectedTenant.toString() }
      });
      setWorkflows(res.data);
    } catch (error) {
      console.error("Failed to fetch workflows", error);
    }
  };

  const handleToggleEnabled = async (wf: Workflow) => {
      try {
          const updated = { ...wf, enabled: !wf.enabled };
          await client.put(`/workflows`, updated, {
              headers: { 'X-Tenant-ID': selectedTenant.toString() }
          });
          fetchWorkflows();
      } catch (err) {
          console.error("Toggle failed", err);
      }
  };

  const handleDelete = async () => {
      if (!deleteId) return;
      try {
          await client.delete(`/workflows/${deleteId}`, {
              headers: { 'X-Tenant-ID': selectedTenant.toString() }
          });
          setDeleteId(null);
          fetchWorkflows();
      } catch (err) {
          console.error("Delete failed", err);
      }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <div>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
                Workflows
            </Typography>
            <Typography variant="body1" color="text.secondary">
                Define the automated remediation steps for each issue type.
            </Typography>
        </div>
        <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={() => navigate('/workflows/new')}
        >
            New Workflow
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
            size="small"
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
                startAdornment: (
                    <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="action" />
                    </InputAdornment>
                ),
            }}
            sx={{ width: 300 }}
        />
        
        <Select
            size="small"
            displayEmpty
            value={triggerFilter}
            onChange={(e) => setTriggerFilter(e.target.value)}
            startAdornment={<FilterListIcon fontSize="small" sx={{ mr: 1, color: 'action.active' }} />}
            sx={{ minWidth: 180 }}
        >
            <MenuItem value="">All Triggers</MenuItem>
            <MenuItem value="ISSUE">Issue-Based</MenuItem>
            <MenuItem value="SCHEDULED">Scheduled</MenuItem>
            <MenuItem value="MANUAL">Manual Only</MenuItem>
        </Select>

        <Select
            size="small"
            displayEmpty
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ minWidth: 150 }}
        >
            <MenuItem value="">All Statuses</MenuItem>
            <MenuItem value="true">Active</MenuItem>
            <MenuItem value="false">Disabled</MenuItem>
        </Select>
      </Box>

      <TableContainer 
        component={Paper} 
        variant="outlined" 
        sx={{ 
            borderRadius: 3, 
            boxShadow: '0px 10px 20px rgba(35, 34, 71, 0.05)',
            border: '1px solid rgba(115, 131, 143, 0.1)',
            overflow: 'hidden'
        }}
      >
        <Table sx={{ minWidth: 650 }} aria-label="workflow table">
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              {selectedTenant === 0 && <TableCell sx={{ fontWeight: 700 }}>Tenant</TableCell>}
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Trigger</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Associated Pollers</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Severity Threshold</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Steps</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {workflows.map((row) => (
              <TableRow key={row.id} hover>
                {selectedTenant === 0 && (
                    <TableCell>
                        <Chip label={row.tenant?.name || 'Unknown'} size="small" color="secondary" sx={{ fontWeight: 700, fontSize: '0.65rem' }} />
                    </TableCell>
                )}
                <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
                  {row.name}
                  <Typography variant="caption" display="block" color="text.secondary">
                    {row.description}
                  </Typography>
                </TableCell>
                <TableCell>{row.trigger_type}</TableCell>
                <TableCell>
                    {row.pollers && row.pollers.length > 0 ? row.pollers.map((p, idx) => (
                        <Chip 
                            key={idx} 
                            label={p.name} 
                            size="small" 
                            variant="outlined" 
                            color="info"
                            sx={{ mr: 0.5, mb: 0.5, fontSize: '0.7rem', fontWeight: 600 }} 
                        />
                    )) : <Typography variant="caption" color="text.disabled">No pollers assigned</Typography>}
                </TableCell>
                <TableCell>
                    <Chip 
                        label={row.min_severity || 'Low'} 
                        size="small" 
                        color={getSeverityColor(row.min_severity || 'Low') as any}
                        variant="filled"
                        sx={{ fontWeight: 700, borderRadius: 1 }}
                    />
                </TableCell>
                <TableCell>
                    {row.steps && row.steps.length > 0 ? row.steps.map((s, idx) => (
                        <Chip 
                            key={idx} 
                            label={s.definition?.name || s.action_type} 
                            size="small" 
                            variant="outlined" 
                            sx={{ mr: 0.5, mb: 0.5, fontSize: '0.7rem' }} 
                        />
                    )) : <Typography variant="caption" color="text.disabled">No steps configured</Typography>}
                </TableCell>
                <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Switch 
                            checked={row.enabled} 
                            onChange={() => handleToggleEnabled(row)}
                            size="small"
                            color="primary"
                        />
                        <Chip 
                            label={row.enabled ? "Active" : "Disabled"} 
                            color={row.enabled ? "success" : "default"} 
                            size="small"
                            variant="outlined"
                            sx={{ ml: 1, fontWeight: 700, fontSize: '0.65rem' }}
                        />
                    </Box>
                </TableCell>
                <TableCell align="right">
                    <Tooltip title="Run manually">
                        <IconButton size="small" color="primary">
                            <PlayArrowIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit workflow">
                        <IconButton size="small" onClick={() => navigate(`/workflows/${row.id}`)}>
                            <EditIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Archive workflow">
                        <IconButton size="small" color="error" onClick={() => setDeleteId(row.id)}>
                            <DeleteIcon />
                        </IconButton>
                    </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)}>
          <DialogTitle>Archive Workflow?</DialogTitle>
          <DialogContent>
              <DialogContentText>
                  Are you sure you want to archive this workflow? It will be removed from the active list but preserved in the database for auditing and potential restoration.
              </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => setDeleteId(null)} color="inherit">Cancel</Button>
              <Button onClick={handleDelete} variant="contained" color="error">Archive</Button>
          </DialogActions>
      </Dialog>
    </Box>
  );
}
