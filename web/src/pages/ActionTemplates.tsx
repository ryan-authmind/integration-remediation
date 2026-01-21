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
  Chip,
  Tooltip,
  Tabs,
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import InfoIcon from '@mui/icons-material/Info';
import AddIcon from '@mui/icons-material/Add';
import Editor, { useMonaco } from '@monaco-editor/react';
import { useTenant } from '../context/TenantContext';

interface ActionDefinition {
  id?: number;
  tenant_id?: number;
  tenant?: { name: string };
  name: string;
  vendor: string;
  method: string;
  path_template: string;
  body_template: string;
  integration_id: number;
  success_field?: string;
  retry_count?: number;
}

interface Integration {
    id: number;
    name: string;
    type: string;
}

// AuthMind Template Variables for Autocomplete
const TEMPLATE_VARIABLES = [
    { label: '.UserEmail', detail: 'Primary identifier (email)', documentation: 'The email or primary ID of the affected identity.' },
    { label: '.IssueID', detail: 'Alert ID', documentation: 'The unique numeric ID from AuthMind.' },
    { label: '.IssueType', detail: 'Alert Type', documentation: 'The type/category of the issue (e.g. "Compromised User").' },
    { label: '.Severity', detail: 'Risk Level (1-4)', documentation: '1=Low, 2=Medium, 3=High, 4=Critical' },
    { label: '.Risk', detail: 'Risk Score', documentation: 'Numerical risk score from AuthMind.' },
    { label: '.Timestamp', detail: 'Trigger Time', documentation: 'RFC3339 formatted timestamp.' },
    { label: '.FirstSeen', detail: 'First Seen', documentation: 'When the issue was first detected.' },
    { label: '.IssueKeys', detail: 'Issue Keys', documentation: 'Map of specific keys identifying the issue.' },
    { label: '.Details', detail: 'Issue Details', documentation: 'Full details object from AuthMind.' },
    { label: '.Details.Summary', detail: 'Primary Message', documentation: 'The high-level summary message from the first result item.' },
    { label: '.Details.Results', detail: 'Result Items', documentation: 'Array of detailed issue results. Use {{range .Details.Results}} to access .Message, .Risk, .Incidents, etc.' },
    { label: '.Title', detail: 'Localized Title', documentation: 'Title from the localized Message Template.' },
    { label: '.Message', detail: 'Localized Message', documentation: 'Body from the localized Message Template.' },
    { label: '.Footer', detail: 'Localized Footer', documentation: 'Footer from the localized Message Template.' },
    { label: '.RemediationTitle', detail: 'Remediation Title', documentation: 'Title of the recommended remediation.' },
    { label: '.RemediationDescription', detail: 'Remediation Desc', documentation: 'High-level description of the remediation.' },
    { label: '.RemediationSteps', detail: 'Remediation Steps', documentation: 'Markdown-formatted steps for remediation.' },
    { label: '.RemediationURL', detail: 'Remediation URL', documentation: 'Link to official AuthMind remediation documentation.' },
    { label: '| default', detail: 'Fallback Helper', documentation: 'Usage: {{.Variable | default "my fallback"}}. Useful for missing Detail fields.' },
    { label: '| jsonescape', detail: 'JSON Safety Helper', documentation: 'Usage: {{.Variable | jsonescape}}. Essential for strings inside JSON payloads to handle quotes and newlines.' },
];

export default function ActionTemplates() {
  const { selectedTenant } = useTenant();
  const [actions, setActions] = useState<ActionDefinition[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [selected, setSelected] = useState<ActionDefinition | null>(null);
  const [formData, setFormData] = useState<ActionDefinition | null>(null);
  
  // Create Mode State
  const [createTab, setCreateTab] = useState(0);
  const [newAction, setNewAction] = useState<ActionDefinition>({
      name: '',
      vendor: '',
      integration_id: 0,
      method: 'POST',
      path_template: '',
      body_template: '{}',
      retry_count: 3
  });
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState('');

  const monaco = useMonaco();

  useEffect(() => {
    fetchActions();
    fetchIntegrations();
  }, [selectedTenant]);

  // Configure Monaco Autocomplete - Runs once per monaco instance
  useEffect(() => {
    if (!monaco) return;

    const provider = monaco.languages.registerCompletionItemProvider('json', {
      triggerCharacters: ['{', '.'],
      provideCompletionItems: (model: any, position: any) => {
        const lineContent = model.getLineContent(position.lineNumber);
        const textBeforeCursor = lineContent.substring(0, position.column - 1);
        
        const lastOpening = textBeforeCursor.lastIndexOf('{{');
        const lastClosing = textBeforeCursor.lastIndexOf('}}');
        
        if (lastOpening === -1 || lastOpening < lastClosing) {
            if (!textBeforeCursor.endsWith('{')) {
                return { suggestions: [] };
            }
        }

        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        return {
          suggestions: TEMPLATE_VARIABLES.map(v => ({
            label: v.label,
            kind: monaco.languages.CompletionItemKind.Variable,
            documentation: v.documentation,
            detail: v.detail,
            insertText: v.label.startsWith('.') && textBeforeCursor.endsWith('.') 
                ? v.label.substring(1) 
                : v.label,
            range: range,
          }))
        };
      },
    });

    return () => provider.dispose();
  }, [monaco]);

  const fetchActions = async () => {
    try {
      const res = await client.get('/actions', {
          headers: { 'X-Tenant-ID': selectedTenant.toString() }
      });
      setActions(res.data);
    } catch (error) {
      console.error("Failed to fetch actions", error);
    }
  };

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

  const handleEditOpen = (action: ActionDefinition) => {
    setSelected(action);
    let body = action.body_template;
    try {
        const parsed = JSON.parse(body);
        body = JSON.stringify(parsed, null, 4);
    } catch (e) {}
    
    setFormData({ ...action, body_template: body });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!formData) return;
    try {
      await client.put('/actions', formData, {
          headers: { 'X-Tenant-ID': selectedTenant.toString() }
      });
      setOpen(false);
      fetchActions();
    } catch (error) {
      console.error("Save failed", error);
    }
  };

  const handleCreateSave = async () => {
      let payload = newAction;

      if (createTab === 1) { // Import JSON Mode
          try {
              payload = JSON.parse(importJson);
              setImportError('');
          } catch (e) {
              setImportError('Invalid JSON format');
              return;
          }
      }

      try {
          await client.post('/actions', payload, {
              headers: { 'X-Tenant-ID': selectedTenant.toString() }
          });
          setCreateOpen(false);
          fetchActions();
          // Reset form
          setNewAction({
              name: '',
              vendor: '',
              integration_id: 0,
              method: 'POST',
              path_template: '',
              body_template: '{}',
              retry_count: 3
          });
          setImportJson('');
      } catch (error) {
          console.error("Create failed", error);
          setImportError('Failed to create action. Check console for details.');
      }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <div>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>Action Templates</Typography>
            <Typography variant="body1" color="text.secondary">
                Define the payloads and API endpoints used by your workflows. 
            </Typography>
        </div>
        <Button 
            variant="contained" 
            startIcon={<AddIcon />} 
            onClick={() => setCreateOpen(true)}
            sx={{ height: 40 }}
        >
            Create Action
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
              {selectedTenant === 0 && <TableCell sx={{ fontWeight: 700 }}>Tenant</TableCell>}
              <TableCell sx={{ fontWeight: 700 }}>Action Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Vendor</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Method</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Endpoint Path</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {actions.map((row) => (
              <TableRow key={row.id} hover>
                {selectedTenant === 0 && (
                    <TableCell>
                        <Chip label={row.tenant?.name || 'Unknown'} size="small" color="secondary" sx={{ fontWeight: 700, fontSize: '0.65rem' }} />
                    </TableCell>
                )}
                <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
                <TableCell><Chip label={row.vendor} size="small" variant="outlined" color="primary" sx={{ fontWeight: 600 }} /></TableCell>
                <TableCell><code style={{ color: '#0062FF', fontWeight: 700 }}>{row.method}</code></TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'text.secondary' }}>{row.path_template}</TableCell>
                <TableCell align="right">
                  <IconButton onClick={() => handleEditOpen(row)} color="primary">
                    <EditIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Action Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="lg" fullWidth scroll="paper">
        <DialogTitle sx={{ fontWeight: 700 }}>Create New Action Template</DialogTitle>
        <DialogContent dividers>
            <Tabs value={createTab} onChange={(_e, v) => setCreateTab(v)} sx={{ mb: 3 }}>
                <Tab label="Manual Entry" />
                <Tab label="Import JSON" />
            </Tabs>

            {createTab === 0 ? (
                <Grid container spacing={3}> 
                    <Grid item xs={12} md={6}>
                        <TextField
                            label="Action Name"
                            fullWidth
                            variant="filled"
                            value={newAction.name}
                            onChange={(e) => setNewAction({ ...newAction, name: e.target.value })}
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField
                            label="Vendor (e.g., Slack, Jira)"
                            fullWidth
                            variant="filled"
                            value={newAction.vendor}
                            onChange={(e) => setNewAction({ ...newAction, vendor: e.target.value })}
                        />
                    </Grid>
                    <Grid item xs={12} md={4}>
                        <FormControl fullWidth variant="filled">
                            <InputLabel>Integration</InputLabel>
                            <Select
                                value={newAction.integration_id}
                                onChange={(e) => setNewAction({ ...newAction, integration_id: Number(e.target.value) })}
                            >
                                <MenuItem value={0}><em>Select Integration</em></MenuItem>
                                {integrations.map(i => (
                                    <MenuItem key={i.id} value={i.id}>{i.name} ({i.type})</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth variant="filled">
                            <InputLabel>Method</InputLabel>
                            <Select
                                value={newAction.method}
                                onChange={(e) => setNewAction({ ...newAction, method: e.target.value })}
                            >
                                <MenuItem value="GET">GET</MenuItem>
                                <MenuItem value="POST">POST</MenuItem>
                                <MenuItem value="PUT">PUT</MenuItem>
                                <MenuItem value="PATCH">PATCH</MenuItem>
                                <MenuItem value="DELETE">DELETE</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField
                            label="Endpoint Path (e.g. /chat.postMessage)"
                            fullWidth
                            variant="filled"
                            value={newAction.path_template}
                            onChange={(e) => setNewAction({ ...newAction, path_template: e.target.value })}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Payload Template</Typography>
                        <Paper variant="outlined" sx={{ border: '1px solid #e2e8f0', borderRadius: 1, overflow: 'hidden' }}>
                            <Editor
                                height="300px"
                                defaultLanguage="json"
                                theme="vs-dark"
                                value={newAction.body_template}
                                onChange={(value) => setNewAction({ ...newAction, body_template: value || '{}' })}
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 13,
                                    fontFamily: 'JetBrains Mono, Fira Code, monospace',
                                }}
                            />
                        </Paper>
                    </Grid>
                </Grid>
            ) : (
                <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Paste the raw JSON configuration for the action definition below.
                    </Typography>
                    {importError && <Alert severity="error" sx={{ mb: 2 }}>{importError}</Alert>}
                    <TextField
                        multiline
                        rows={15}
                        fullWidth
                        variant="outlined"
                        placeholder='{ "name": "...", "vendor": "...", ... }'
                        value={importJson}
                        onChange={(e) => setImportJson(e.target.value)}
                        sx={{ fontFamily: 'monospace' }}
                    />
                </Box>
            )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setCreateOpen(false)} color="inherit">Cancel</Button>
            <Button onClick={handleCreateSave} variant="contained" size="large">Create Action</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="lg" fullWidth scroll="paper">
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Action Template: {selected?.name}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={3} sx={{ mt: 0 }}>
            <Grid item xs={12} md={3}>
              <TextField
                label="HTTP Method"
                fullWidth
                variant="filled"
                value={formData?.method}
                onChange={(e) => setFormData(prev => prev ? { ...prev, method: e.target.value } : null)}
              />
            </Grid>
            <Grid item xs={12} md={9}>
              <TextField
                label="Endpoint Path Template"
                fullWidth
                variant="filled"
                value={formData?.path_template}
                onChange={(e) => setFormData(prev => prev ? { ...prev, path_template: e.target.value } : null)}
                helperText="Variables allowed: {{.UserEmail}}"
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Payload Template (JSON)</Typography>
                <Tooltip title="View Template Documentation">
                  <IconButton size="small" color="primary" onClick={() => setDocOpen(true)}>
                    <InfoIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
              <Paper variant="outlined" sx={{ border: '1px solid #e2e8f0', borderRadius: 1, overflow: 'hidden' }}>
                <Editor
                    height="400px"
                    defaultLanguage="json"
                    theme="vs-dark"
                    value={formData?.body_template}
                    onChange={(value) => setFormData(prev => prev ? { ...prev, body_template: value || '' } : null)}
                    options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        fontFamily: 'JetBrains Mono, Fira Code, monospace',
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        formatOnPaste: true,
                        formatOnType: true,
                    }}
                />
              </Paper>
            </Grid>
          </Grid>
          
          <Box sx={{ mt: 3 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 1 }}>
                QUICK REFERENCE:
            </Typography>
            <Grid container spacing={1}>
                {TEMPLATE_VARIABLES.map(item => (
                    <Grid item xs={4} key={item.label}>
                        <Paper variant="outlined" sx={{ p: 1, bgcolor: 'action.hover', borderStyle: 'dashed' }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                {"{{"}{item.label}{"}}"}
                            </Typography>
                            <Typography variant="caption" display="block">{item.detail}</Typography>
                        </Paper>
                    </Grid>
                ))}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setOpen(false)} color="inherit">Cancel</Button>
          <Button onClick={handleSave} variant="contained" size="large">Save Changes</Button>
        </DialogActions>
      </Dialog>


      <Dialog open={docOpen} onClose={() => setDocOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>AuthMind Template Documentation</DialogTitle>
          <DialogContent dividers>
              <Typography variant="h6" gutterBottom color="primary">API Mapping & Variables</Typography>
              <Typography variant="body2" paragraph>
                  The remediation engine executes workflows when AuthMind detects an issue. Data from the 
                  <b> AuthMind API</b> is automatically mapped into the template context.
              </Typography>

              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                  <Table size="small">
                      <TableHead sx={{ bgcolor: 'action.hover' }}>
                          <TableRow>
                              <TableCell sx={{ fontWeight: 700 }}>Variable</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Source / Description</TableCell>
                          </TableRow>
                      </TableHead>
                      <TableBody>
                          {TEMPLATE_VARIABLES.map(v => (
                              <TableRow key={v.label}>
                                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{v.label}</TableCell>
                                  <TableCell>{v.documentation}</TableCell>
                              </TableRow>
                          ))}
                      </TableBody>
                  </Table>
              </TableContainer>

              <Typography variant="h6" gutterBottom color="primary">Example: Creating a rich Slack message</Typography>
              <Typography variant="body2" paragraph>
                  Below is a standard Slack payload using Block Kit, including primary issue data and incident details:
              </Typography>

              <Paper sx={{ p: 2, bgcolor: '#1e1e1e', color: '#d4d4d4', fontFamily: 'monospace', fontSize: '0.8rem', mb: 2 }}>
                  <pre style={{ margin: 0 }}>
{`{
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "🛡️ Security Issue: {{.IssueType | jsonescape}}" }
    },
    {
      "type": "section",
      "text": { "type": "mrkdwn", "text": "*Description:*\\n{{.IssueMessage | jsonescape}}" }
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Risk Level:*\\n{{.Risk | jsonescape}}" },
        { "type": "mrkdwn", "text": "*Total Flows:*\\n{{.FlowCount}}" }
      ]
    },
    {
      "type": "section",
      "fields": [
        { "type": "mrkdwn", "text": "*Identity:*\\n👤 {{.UserEmail | jsonescape}}" },
        { "type": "mrkdwn", "text": "*Asset:*\\n🖥️ {{index .IssueKeys \"asset_name\" | default \"N/A\" | jsonescape}}" }
      ]
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "View in Console" },
          "url": "https://console.authmind.com/issues?q=id%3A{{.IssueID | jsonescape}}",
          "style": "primary"
        }
      ]
    }
  ]
}`}
                  </pre>
              </Paper>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setDocOpen(false)} variant="contained">Close Documentation</Button>
          </DialogActions>
      </Dialog>
    </Box>
  );
}