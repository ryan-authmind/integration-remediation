import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../api/client';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  IconButton,
  Grid,
  Divider,
  Breadcrumbs,
  Link
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useTenant } from '../context/TenantContext';
import { Chip, OutlinedInput } from '@mui/material';

interface ActionDefinition {
    id: number;
    name: string;
    vendor: string;
}

interface Integration {
    id: number;
    name: string;
}

interface WorkflowStep {
    id?: number;
    action_definition_id: number;
    order: number;
    parameter_mapping: string;
    definition?: ActionDefinition;
}

interface Workflow {
  id?: number;
  name: string;
  description: string;
  enabled: boolean;
  trigger_type: string;
  min_severity: string;
  pollers: Integration[];
  steps: WorkflowStep[];
}

export default function WorkflowEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedTenant } = useTenant();
  const isNew = id === 'new';
  
  const [availableActions, setAvailableActions] = useState<ActionDefinition[]>([]);
  const [availablePollers, setAvailablePollers] = useState<Integration[]>([]);
  const [workflow, setWorkflow] = useState<Workflow>({
      name: '',
      description: '',
      enabled: true,
      trigger_type: 'AUTHMIND_POLL',
      min_severity: 'Low',
      pollers: [],
      steps: []
  });

  useEffect(() => {
    fetchAvailableActions();
    fetchAvailablePollers();
    if (!isNew && id) {
        fetchWorkflow(id);
    }
  }, [id, selectedTenant]);

  const fetchAvailableActions = async () => {
    try {
        const res = await client.get('/actions', {
            headers: { 'X-Tenant-ID': selectedTenant.toString() }
        });
        setAvailableActions(res.data);
    } catch (error) {
        console.error("Failed to load actions", error);
    }
  };

  const fetchAvailablePollers = async () => {
      try {
          const res = await client.get('/integrations', {
              headers: { 'X-Tenant-ID': selectedTenant.toString() }
          });
          // Filter only AuthMind integrations
          setAvailablePollers(res.data.filter((i: any) => i.name.toLowerCase().includes('authmind')));
      } catch (err) {
          console.error("Failed to load pollers", err);
      }
  };

  const fetchWorkflow = async (workflowId: string) => {
    try {
        const res = await client.get('/workflows', {
            headers: { 'X-Tenant-ID': selectedTenant.toString() }
        });
        const found = res.data.find((w: any) => w.id === parseInt(workflowId));
        if (found) setWorkflow(found);
    } catch (error) {
        console.error("Failed to load workflow", error);
    }
  };

  const handleSave = async () => {
    try {
        const headers = { 'X-Tenant-ID': selectedTenant.toString() };
        const payload = {
            ...workflow,
            pollers: workflow.pollers.map(p => ({ id: p.id })), // Simplified for many-to-many update
            steps: workflow.steps.map(s => ({
                action_definition_id: s.action_definition_id,
                order: s.order,
                parameter_mapping: s.parameter_mapping || '{}'
            }))
        };

        if (isNew) {
            await client.post('/workflows', payload, { headers });
        } else {
            await client.put('/workflows', payload, { headers });
        }
        navigate('/workflows');
    } catch (error) {
        console.error("Failed to save", error);
    }
  };

  const addStep = () => {
      if (availableActions.length === 0) return;
      
      const firstAction = availableActions[0];
      setWorkflow(prev => ({
          ...prev,
          steps: [
              ...prev.steps,
              { 
                  action_definition_id: firstAction.id, 
                  order: prev.steps.length + 1, 
                  parameter_mapping: '{}',
                  definition: firstAction
              }
          ]
      }));
  };

  const updateStep = (index: number, field: keyof WorkflowStep, value: any) => {
      const newSteps = [...workflow.steps];
      if (field === 'action_definition_id') {
          const def = availableActions.find(a => a.id === value);
          newSteps[index] = { ...newSteps[index], action_definition_id: value, definition: def };
      } else {
          newSteps[index] = { ...newSteps[index], [field]: value } as WorkflowStep;
      }
      setWorkflow({ ...workflow, steps: newSteps });
  };

  const removeStep = (index: number) => {
      const newSteps = workflow.steps.filter((_, i) => i !== index);
      newSteps.forEach((s, i) => s.order = i + 1);
      setWorkflow({ ...workflow, steps: newSteps });
  };

  return (
    <Box>
        <Box sx={{ mb: 4 }}>
            <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 1 }}>
                <Link underline="hover" color="inherit" sx={{ cursor: 'pointer' }} onClick={() => navigate('/workflows')}>
                    Workflows
                </Link>
                <Typography color="text.primary">{isNew ? 'New' : workflow.name}</Typography>
            </Breadcrumbs>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    {isNew ? 'Create Workflow' : 'Configure Workflow'}
                </Typography>
                <Button 
                    variant="contained" 
                    size="large"
                    startIcon={<SaveIcon />} 
                    onClick={handleSave}
                >
                    Save Changes
                </Button>
            </Box>
        </Box>

        <Grid container spacing={4}>
            {/* Left Column: Metadata */}
            <Grid item xs={12} lg={4}>
                <Paper sx={{ p: 3, height: '100%' }} variant="outlined">
                    <Typography variant="h6" gutterBottom>General Information</Typography>
                    <Divider sx={{ mb: 3 }} />
                    
                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <TextField 
                                label="Workflow Name" 
                                fullWidth 
                                placeholder="e.g., Critical Compromise Response"
                                value={workflow.name}
                                onChange={(e) => setWorkflow({...workflow, name: e.target.value})}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField 
                                label="Description" 
                                fullWidth 
                                multiline
                                rows={4}
                                placeholder="Describe the purpose of this remediation..."
                                value={workflow.description}
                                onChange={(e) => setWorkflow({...workflow, description: e.target.value})}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Trigger Source (AuthMind Type)</InputLabel>
                                <Select
                                    value={workflow.trigger_type}
                                    label="Trigger Source (AuthMind Type)"
                                    onChange={(e) => setWorkflow({...workflow, trigger_type: e.target.value})}
                                >
                                    <MenuItem value="AUTHMIND_POLL">AuthMind Polling</MenuItem>
                                    <MenuItem value="WEBHOOK">Generic Webhook</MenuItem>
                                    <MenuItem value="MANUAL">Manual Trigger</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Minimum Severity Threshold</InputLabel>
                                <Select
                                    value={workflow.min_severity || 'Low'}
                                    label="Minimum Severity Threshold"
                                    onChange={(e) => setWorkflow({...workflow, min_severity: e.target.value})}
                                >
                                    <MenuItem value="Low">Low (Runs on everything)</MenuItem>
                                    <MenuItem value="Medium">Medium (Medium, High, Critical)</MenuItem>
                                    <MenuItem value="High">High (High, Critical)</MenuItem>
                                    <MenuItem value="Critical">Critical Only</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Associated Pollers</InputLabel>
                                <Select
                                    multiple
                                    value={workflow.pollers?.map(p => p.id) || []}
                                    onChange={(e) => {
                                        const ids = e.target.value as number[];
                                        const selected = availablePollers.filter(p => ids.includes(p.id));
                                        setWorkflow({ ...workflow, pollers: selected });
                                    }}
                                    input={<OutlinedInput label="Associated Pollers" />}
                                    renderValue={(selectedIds) => (
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                            {(selectedIds as number[]).map((id) => {
                                                const poller = availablePollers.find(p => p.id === id) || workflow.pollers.find(p => p.id === id);
                                                return <Chip key={id} label={poller?.name || id} size="small" color="primary" variant="outlined" sx={{ fontWeight: 600 }} />;
                                            })}
                                        </Box>
                                    )}
                                >
                                    {availablePollers.map((p) => (
                                        <MenuItem key={p.id} value={p.id}>
                                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{p.name}</Typography>
                                                {selectedTenant === 0 && (
                                                    <Typography variant="caption" color="text.secondary">Tenant: { (p as any).tenant?.name || 'Unknown'}</Typography>
                                                )}
                                            </Box>
                                        </MenuItem>
                                    ))}
                                </Select>
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                    Only issues detected by these specific pollers will trigger this workflow.
                                </Typography>
                            </FormControl>
                        </Grid>
                    </Grid>
                </Paper>
            </Grid>

            {/* Right Column: Steps */}
            <Grid item xs={12} lg={8}>
                <Paper sx={{ p: 3, minHeight: '100%' }} variant="outlined">
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Typography variant="h6">Execution Steps</Typography>
                        <Button variant="outlined" startIcon={<AddIcon />} onClick={addStep} disabled={availableActions.length === 0}>
                            Add Step
                        </Button>
                    </Box>
                    <Divider sx={{ mb: 3 }} />
                    
                    {workflow.steps.length === 0 ? (
                        <Box sx={{ py: 8, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 2 }}>
                            <Typography color="text.secondary">No steps defined. Click "Add Step" to build your sequence.</Typography>
                        </Box>
                    ) : (
                        <Stepper orientation="vertical" activeStep={-1} sx={{ ml: 1 }}>
                            {workflow.steps.map((step, index) => (
                                <Step key={index} expanded>
                                    <StepLabel icon={index + 1}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                            <FormControl size="small" sx={{ minWidth: 350, mr: 2 }}>
                                                <Select
                                                    value={step.action_definition_id}
                                                    onChange={(e) => updateStep(index, 'action_definition_id', e.target.value)}
                                                >
                                                    {availableActions.map(action => (
                                                        <MenuItem key={action.id} value={action.id}>
                                                            {action.vendor}: {action.name}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                            <IconButton size="small" color="error" onClick={() => removeStep(index)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </Box>
                                    </StepLabel>
                                    <StepContent>
                                        {/* Parameters are hidden for now as per requirements, but logic is preserved */}
                                        {false && (
                                            <Card variant="outlined" sx={{ mt: 1, mb: 2, bgcolor: 'background.default' }}>
                                                <CardContent>
                                                    <Typography variant="caption" display="block" gutterBottom color="text.secondary">
                                                        Parameter Mapping (JSON)
                                                    </Typography>
                                                    <TextField
                                                        fullWidth
                                                        multiline
                                                        rows={3}
                                                        value={step.parameter_mapping}
                                                        onChange={(e) => updateStep(index, 'parameter_mapping', e.target.value)}
                                                        sx={{ 
                                                            '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '13px' }
                                                        }}
                                                    />
                                                </CardContent>
                                            </Card>
                                        )}
                                    </StepContent>
                                </Step>
                            ))}
                        </Stepper>
                    )}
                </Paper>
            </Grid>
        </Grid>
    </Box>
  );
}