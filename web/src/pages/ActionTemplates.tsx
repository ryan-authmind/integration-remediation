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
  Tooltip
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import InfoIcon from '@mui/icons-material/Info';
import Editor from '@monaco-editor/react';

interface ActionDefinition {
  id: number;
  name: string;
  vendor: string;
  method: string;
  path_template: string;
  body_template: string;
  integration_id: number;
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
    { label: '| default', detail: 'Fallback Helper', documentation: 'Usage: {{.Variable | default "my fallback"}}. Useful for missing Detail fields.' },
];

export default function ActionTemplates() {
  const [actions, setActions] = useState<ActionDefinition[]>([]);
  const [open, setOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [selected, setSelected] = useState<ActionDefinition | null>(null);
  const [formData, setFormData] = useState<ActionDefinition | null>(null);

  useEffect(() => {
    fetchActions();
  }, []);

  // Configure Monaco Autocomplete
  const handleEditorWillMount = (monaco: any) => {
    monaco.languages.registerCompletionItemProvider('json', {
      triggerCharacters: ['{', '.'],
      provideCompletionItems: (model: any, position: any) => {
        const lineContent = model.getLineContent(position.lineNumber);
        const textBeforeCursor = lineContent.substring(0, position.column - 1);
        
        // Only show suggestions if we are inside a template marker {{ }}
        // or just started one with {
        const lastOpening = textBeforeCursor.lastIndexOf('{{');
        const lastClosing = textBeforeCursor.lastIndexOf('}}');
        
        if (lastOpening === -1 || lastOpening < lastClosing) {
            // Check if they just typed the first {
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
            // If they just typed {{, we should suggest with the dot
            // If they typed {{., we just suggest the rest
            insertText: v.label.startsWith('.') && textBeforeCursor.endsWith('.') 
                ? v.label.substring(1) 
                : v.label,
            range: range,
          }))
        };
      },
    });
  };

  const fetchActions = async () => {
    try {
      const res = await client.get('/actions');
      setActions(res.data);
    } catch (error) {
      console.error("Failed to fetch actions", error);
    }
  };

  const handleEditOpen = (action: ActionDefinition) => {
    setSelected(action);
    // Pretty print the JSON template if valid
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
      await client.put('/actions', formData);
      setOpen(false);
      fetchActions();
    } catch (error) {
      console.error("Save failed", error);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>Action Templates</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Define the payloads and API endpoints used by your workflows. 
        Syntax highlighting and variable autocomplete enabled.
      </Typography>

      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead sx={{ bgcolor: 'action.hover' }}>
            <TableRow>
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
                <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
                <TableCell><Chip label={row.vendor} size="small" variant="outlined" color="primary" sx={{ fontWeight: 600 }} /></TableCell>
                <TableCell><code style={{ color: '#e11d48', fontWeight: 700 }}>{row.method}</code></TableCell>
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
                    beforeMount={handleEditorWillMount}
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
                  You can use the <code>.Details.Summary</code> to provide instant context to your security team. 
                  Below is a demo of a Slack payload using Block Kit:
              </Typography>

              <Paper sx={{ p: 2, bgcolor: '#1e1e1e', color: '#d4d4d4', fontFamily: 'monospace', fontSize: '0.8rem', mb: 2 }}>
                  <pre style={{ margin: 0 }}>
{`{
  "text": "AuthMind Alert: {{.IssueType}}",
  "blocks": [
    {
      "type": "header",
      "text": { "type": "plain_text", "text": "🛡️ {{.IssueType}}" }
    },
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*User:* {{.UserEmail}}\\n*Risk:* {{.Risk}}\\n*Summary:* {{.Details.Summary}}\\n*Tags:* {{range $k, $v := .IssueKeys}} [{{$k}}: {{$v}}] {{end}}"
      }
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": { "type": "plain_text", "text": "View Incident" },
          "url": "{{.IncidentsURL}}",
          "style": "primary"
        }
      ]
    }
  ]
}`}
                  </pre>
              </Paper>

              <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2 }}>Advanced: Conditional Logic & Loops</Typography>
              <Typography variant="body2" paragraph>
                  Templates use Go Syntax. You can check for severities:
                  <br />
                  <code>{"{{"}if eq .Severity 4{"}}"} 🚨 CRITICAL 🚨 {"{{"}else{"}}"} ⚠️ WARNING {"{{"}end{"}}"}</code>
              </Typography>
              <Typography variant="body2">
                  Or iterate over evidence results:
                  <br />
                  <code>{"{{"}range .Details.Results{"}}"} - {"{{"}.name{"}}"} ({"{{"}.value{"}}"}){"\\n"}{"{{end}}"}</code>
              </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setDocOpen(false)} variant="contained">Close Documentation</Button>
          </DialogActions>
      </Dialog>
    </Box>
  );
}