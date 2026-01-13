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
  DialogActions
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useNavigate } from 'react-router-dom';

interface Workflow {
  id: number;
  name: string;
  description: string;
  enabled: boolean;
  trigger_type: string;
  steps: any[]; // We'll display count
}

export default function Workflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    try {
      const res = await client.get('/workflows');
      setWorkflows(res.data);
    } catch (error) {
      console.error("Failed to fetch workflows", error);
    }
  };

  const handleToggleEnabled = async (wf: Workflow) => {
      try {
          const updated = { ...wf, enabled: !wf.enabled };
          await client.put(`/workflows`, updated);
          fetchWorkflows();
      } catch (err) {
          console.error("Toggle failed", err);
      }
  };

  const handleDelete = async () => {
      if (!deleteId) return;
      try {
          await client.delete(`/workflows/${deleteId}`);
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

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table sx={{ minWidth: 650 }} aria-label="workflow table">
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Trigger</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Steps</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {workflows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
                  {row.name}
                  <Typography variant="caption" display="block" color="text.secondary">
                    {row.description}
                  </Typography>
                </TableCell>
                <TableCell>{row.trigger_type}</TableCell>
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
