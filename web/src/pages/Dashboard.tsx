import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import {
  Box,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  IconButton,
  Collapse,
  Tooltip,
  Snackbar,
  Alert,
  Select,
  MenuItem,
  TablePagination,
  TextField,
  InputAdornment,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  StepIconProps,
  Drawer,
  Divider,
  Stack,
  alpha,
  useTheme,
  styled
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SyncIcon from '@mui/icons-material/Sync';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import InfoIcon from '@mui/icons-material/Info';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SettingsIcon from '@mui/icons-material/Settings';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import TerminalIcon from '@mui/icons-material/Terminal';
import { useTenant } from '../context/TenantContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface Stats {
    total_jobs: number;
    success_jobs: number;
    failed_jobs: number;
    running_jobs: number;
    active_workflows: number;
    processed_events: number;
    total_tenants?: number;
    workflow_breakdown?: Record<string, number>;
    tenant_breakdown?: Array<{tenant_name: string, job_count: number, event_count: number, tenant_id: number}>;
    event_breakdown?: Array<{risk: string, triggered: number, filtered_severity: number, filtered_type: number, no_workflow: number}>;
}

interface Tenant {
    id: number;
    name: string;
}

interface JobLog {
    id: number;
    timestamp: string;
    level: string;
    message: string;
    step_name: string;
    status_code: number;
    response_body: string;
}

interface Job {
    id: number;
    created_at: string;
    tenant_id: number;
    workflow_id: number;
    workflow: { name: string };
    status: string;
    authmind_issue_id: string;
    trigger_context: string; 
}

const FlowConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.alternativeLabel}`]: {
    top: 22,
  },
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      borderColor: theme.palette.primary.main,
    },
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: {
      borderColor: theme.palette.success.main,
    },
  },
  [`& .${stepConnectorClasses.line}`]: {
    borderColor: theme.palette.mode === 'dark' ? theme.palette.grey[800] : '#eaeaf0',
    borderTopWidth: 3,
    borderRadius: 1,
  },
}));

const FlowStepIconRoot = styled('div')<{
  ownerState: { active?: boolean; completed?: boolean; status: string };
}>(({ theme, ownerState }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? theme.palette.grey[700] : '#ccc',
  zIndex: 1,
  color: '#fff',
  width: 44,
  height: 44,
  display: 'flex',
  borderRadius: '50%',
  justifyContent: 'center',
  alignItems: 'center',
  border: '3px solid transparent',
  transition: 'all 0.2s ease-in-out',
  cursor: 'pointer',
  ...(ownerState.status === 'success' && {
    backgroundColor: theme.palette.success.main,
    boxShadow: `0 0 12px ${alpha(theme.palette.success.main, 0.5)}`,
    '&:hover': {
        boxShadow: `0 0 20px ${alpha(theme.palette.success.main, 0.8)}`,
    }
  }),
  ...(ownerState.status === 'warning' && {
    backgroundColor: theme.palette.warning.main,
    boxShadow: `0 0 12px ${alpha(theme.palette.warning.main, 0.5)}`,
    '&:hover': {
        boxShadow: `0 0 20px ${alpha(theme.palette.warning.main, 0.8)}`,
    }
  }),
  ...(ownerState.status === 'error' && {
    backgroundColor: theme.palette.error.main,
    boxShadow: `0 0 12px ${alpha(theme.palette.error.main, 0.5)}`,
    '&:hover': {
        boxShadow: `0 0 20px ${alpha(theme.palette.error.main, 0.8)}`,
    }
  }),
}));

function FlowStepIcon(props: StepIconProps & { status: string }) {
  const { active, completed, className, status } = props;

  const icons: { [index: string]: React.ReactElement } = {
    success: <CheckCircleIcon />,
    warning: <InfoIcon />,
    error: <ErrorIcon />,
  };

  return (
    <FlowStepIconRoot ownerState={{ completed, active, status }} className={className}>
      {icons[status] || <SyncIcon />}
    </FlowStepIconRoot>
  );
}

function Row(props: { job: Job, onRerun: () => void, isGlobal: boolean, tenants: Tenant[] }) {
  const { job, onRerun, isGlobal, tenants } = props;
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<JobLog | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const theme = useTheme();

  const handleExpand = async () => {
    const nextState = !open;
    setOpen(nextState);
    if (nextState && logs.length === 0) {
        setLoading(true);
        try {
            const res = await client.get(`/jobs/${job.id}/logs`);
            setLogs(res.data);
        } catch (e) {
            console.error("Failed to fetch logs", e);
        } finally {
            setLoading(false);
        }
    }
  };

  const handleRerun = async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
          await client.post(`/jobs/${job.id}/rerun`);
          onRerun();
      } catch (err) {
          console.error("Rerun failed", err);
      }
  };

  const getLogStatusColor = (log: JobLog) => {
      if (log.level === 'ERROR') return 'error';
      if (log.status_code >= 400) return 'error';
      if (log.status_code >= 300) return 'warning';
      if (log.message.includes('filtered') || log.message.includes('skipped')) return 'warning';
      return 'success';
  };

  const handleLogClick = (log: JobLog) => {
      setSelectedLog(log);
      setDrawerOpen(true);
  };

  let playbookName = 'N/A';
  try {
      if (job.trigger_context) {
          const context = JSON.parse(job.trigger_context);
          playbookName = context.PlaybookName || 'N/A';
      }
  } catch (e) {}

  const tenantName = tenants.find(t => t.id === job.tenant_id)?.name || `ID:${job.tenant_id}`;

  return (
    <>
      <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton size="small" onClick={handleExpand}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row" sx={{ fontWeight: 700 }}>
          #{job.id}
        </TableCell>
        {isGlobal && (
            <TableCell>
                <Chip label={tenantName} size="small" variant="outlined" icon={<CorporateFareIcon sx={{ fontSize: '1rem !important' }} />} />
            </TableCell>
        )}
        <TableCell>
            <Link to="/workflows" style={{ textDecoration: 'none', color: 'inherit', fontWeight: 500 }}>
                {job.workflow?.name || 'Unknown'}
            </Link>
        </TableCell>
        <TableCell>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
                {playbookName}
            </Typography>
        </TableCell>
        <TableCell>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                {job.authmind_issue_id}
            </Typography>
        </TableCell>
        <TableCell>{new Date(job.created_at).toLocaleString()}</TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip 
                label={job.status.toUpperCase()} 
                size="small" 
                sx={{ fontWeight: 700, borderRadius: 1 }}
                color={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'error' : 'info'}
            />
            <Tooltip title="Rerun this workflow">
                <IconButton size="small" color="primary" onClick={handleRerun}>
                    <PlayArrowIcon fontSize="small" />
                </IconButton>
            </Tooltip>
          </Box>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={isGlobal ? 8 : 7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 3 }}>
              <Typography variant="subtitle2" gutterBottom component="div" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <TaskAltIcon fontSize="small" color="primary" /> Execution Flow
              </Typography>
              
              {loading ? (
                  <CircularProgress size={20} sx={{ m: 2 }} />
              ) : logs.length === 0 ? (
                  <Typography variant="caption" sx={{ ml: 4, fontStyle: 'italic' }}>No detailed logs available for this job.</Typography>
              ) : (
                <Box sx={{ width: '100%', overflowX: 'auto', pb: 2, pt: 8 }}>
                    <Stepper alternativeLabel connector={<FlowConnector />}>
                        {logs.map((log) => {
                            const status = getLogStatusColor(log);
                            const cleanTitle = log.step_name || 'System';

                            return (
                                <Step key={log.id}>
                                    <StepLabel
                                        onClick={() => handleLogClick(log)}
                                        StepIconComponent={(props) => <FlowStepIcon {...props} status={status} />}
                                        sx={{
                                            cursor: 'pointer',
                                            '& .MuiStepLabel-label': {
                                                position: 'absolute',
                                                top: -45,
                                                width: '100%',
                                                fontWeight: 700,
                                                fontSize: '0.75rem',
                                                color: 'text.primary',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em'
                                            }
                                        }}
                                    >
                                        {cleanTitle}
                                    </StepLabel>
                                </Step>
                            );
                        })}
                    </Stepper>
                </Box>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 550 }, p: 0 } }}
      >
        {selectedLog && (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'action.hover' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TerminalIcon color="primary" /> Log Details
                    </Typography>
                    <IconButton onClick={() => setDrawerOpen(false)}><CloseIcon /></IconButton>
                </Box>
                <Divider />
                <Box sx={{ p: 3, flexGrow: 1, overflowY: 'auto' }}>
                    <Stack spacing={3}>
                        {/* Status Header */}
                        {(() => {
                            const status = getLogStatusColor(selectedLog);
                            const statusColor = (theme.palette as any)[status].main;
                            const bgColor = alpha(statusColor, 0.1);

                            return (
                                <Paper variant="outlined" sx={{ 
                                    p: 2, 
                                    borderRadius: 2, 
                                    bgcolor: bgColor,
                                    borderColor: statusColor,
                                    borderWidth: 2,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2
                                }}>
                                    <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        bgcolor: statusColor,
                                        color: 'white',
                                        borderRadius: '50%',
                                        p: 1
                                    }}>
                                        {status === 'error' ? <ErrorIcon /> : status === 'warning' ? <InfoIcon /> : <CheckCircleIcon />}
                                    </Box>
                                    <Box>
                                        <Typography variant="h6" sx={{ fontWeight: 800, color: statusColor, lineHeight: 1 }}>
                                            {status.toUpperCase()}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                            {new Date(selectedLog.timestamp).toLocaleString()}
                                        </Typography>
                                    </Box>
                                </Paper>
                            );
                        })()}

                        {/* Identification Info */}
                        <Box sx={{ px: 1 }}>
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>Step Name</Typography>
                                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                    {selectedLog.step_name || 'System Process'}
                                </Typography>
                            </Box>
                            
                            <Box>
                                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>Execution Status</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip 
                                        label={selectedLog.status_code > 0 ? `HTTP ${selectedLog.status_code}` : selectedLog.level} 
                                        color={getLogStatusColor(selectedLog) === 'error' ? 'error' : getLogStatusColor(selectedLog) === 'warning' ? 'warning' : 'success'} 
                                        sx={{ fontWeight: 700 }}
                                    />
                                    {selectedLog.response_body && (
                                        <Chip label="Response Captured" variant="outlined" size="small" sx={{ fontWeight: 600 }} />
                                    )}
                                </Box>
                            </Box>
                        </Box>

                        <Divider />

                        {/* Full Message / Response */}
                        <Box>
                            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>Message & Response Content</Typography>
                            <Paper variant="outlined" sx={{ 
                                mt: 1, 
                                bgcolor: 'action.hover', 
                                p: 2, 
                                borderRadius: 2,
                                borderStyle: 'dashed',
                                maxHeight: '500px',
                                overflow: 'auto'
                            }}>
                                <Typography variant="body2" sx={{ 
                                    fontFamily: 'monospace', 
                                    whiteSpace: 'pre-wrap', 
                                    wordBreak: 'break-word',
                                    lineHeight: 1.6,
                                    fontSize: '0.85rem'
                                }}>
                                    {(() => {
                                        if (selectedLog.response_body) {
                                            try {
                                                return JSON.stringify(JSON.parse(selectedLog.response_body), null, 2);
                                            } catch (e) {
                                                return selectedLog.response_body;
                                            }
                                        }
                                        return selectedLog.message;
                                    })()}
                                </Typography>
                            </Paper>
                        </Box>
                    </Stack>
                </Box>
                <Divider />
                <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                    <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 600 }}>
                        Internal Job ID: {job.id} | Log Trace: {selectedLog.id}
                    </Typography>
                </Box>
            </Box>
        )}
      </Drawer>
    </>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [settings, setSettings] = useState<{key: string, value: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [rerunTriggered, setRerunTriggered] = useState(false);

  // Tenancy Context
  const { selectedTenant, tenants } = useTenant();

  const fetchData = async () => {
    try {
        // 1. Determine Endpoint and Headers
        const isGlobal = selectedTenant === 0;
        const statsUrl = isGlobal ? '/admin/stats' : '/stats';
        const headers = isGlobal ? {} : { 'X-Tenant-ID': selectedTenant.toString() };

        const [statsRes, jobsRes, settingsRes] = await Promise.all([
            client.get(statsUrl, { headers }),
            client.get(`/jobs?page=${page + 1}&pageSize=${rowsPerPage}&search=${search}&status=${statusFilter}`, { headers }),
            client.get('/settings')
        ]);

        setStats(statsRes.data);
        setRecentJobs(jobsRes.data.data); 
        setTotalJobs(jobsRes.data.total);
        setSettings(settingsRes.data);
    } catch (error) {
        console.error("Dashboard fetch failed", error);
    } finally {
        setLoading(false);
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleUpdateRetention = async (days: string) => {
      try {
          await client.put('/settings', { key: 'data_retention_days', value: days });
          setSettings(prev => prev.map(s => s.key === 'data_retention_days' ? { ...s, value: days } : s));
      } catch (e) {
          console.error("Failed to update retention", e);
      }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); 
    return () => clearInterval(interval);
  }, [page, rowsPerPage, selectedTenant, search, statusFilter]);

  if (loading || !stats) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  const retentionDays = settings.find(s => s.key === 'data_retention_days')?.value || '90';
  const successRate = stats.total_jobs > 0 ? ((stats.success_jobs / stats.total_jobs) * 100).toFixed(1) : "0";

  // Data for Charts
  const workflowData = stats.workflow_breakdown 
    ? Object.entries(stats.workflow_breakdown).map(([name, count]) => ({ name, value: count })).sort((a, b) => b.value - a.value).slice(0, 10)
    : [];

  const tenantData = stats.tenant_breakdown
    ? stats.tenant_breakdown.map(t => ({ name: t.tenant_name || `ID:${t.tenant_id}`, executions: t.job_count, events: t.event_count }))
    : [];

  const eventBreakdownData = stats.event_breakdown 
    ? stats.event_breakdown.map(item => ({
        name: item.risk || 'Unknown',
        triggered: item.triggered,
        filtered_severity: item.filtered_severity,
        filtered_type: item.filtered_type,
        no_workflow: item.no_workflow,
        total: item.triggered + item.filtered_severity + item.filtered_type + item.no_workflow
    })).sort((a, b) => {
        const order = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3, 'None': 4 };
        return (order[a.name as keyof typeof order] ?? 99) - (order[b.name as keyof typeof order] ?? 99);
    })
    : [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
                {selectedTenant === 0 ? 'Aggregate Performance' : 'Tenant Performance'}
            </Typography>
            <Typography variant="body1" color="text.secondary">
                {selectedTenant === 0 
                    ? 'Cross-tenant throughput and execution distribution.' 
                    : `Metrics and logs for ${tenants.find(t => t.id === selectedTenant)?.name || 'selected tenant'}.`}
            </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block' }}>
                        DATA RETENTION
                    </Typography>
                    <Select
                        size="small"
                        value={retentionDays}
                        onChange={(e) => handleUpdateRetention(e.target.value as string)}
                        sx={{ fontSize: '0.8rem', mt: 0.5, fontWeight: 600 }}
                    >
                        <MenuItem value="30">30 Days</MenuItem>
                        <MenuItem value="60">60 Days</MenuItem>
                        <MenuItem value="90">90 Days</MenuItem>
                        <MenuItem value="180">180 Days</MenuItem>
                        <MenuItem value="365">1 Year</MenuItem>
                    </Select>
                </Box>
                <Tooltip title="Jobs and logs older than this will be automatically archived daily to optimize storage.">
                    <InfoIcon color="disabled" fontSize="small" />
                </Tooltip>
            </Paper>
        </Box>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={2.4}>
            <MetricCard title="Events Processed" value={stats.processed_events} icon={<InfoIcon color="primary" />} />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
            <MetricCard title="Workflows Executed" value={stats.total_jobs} icon={<TrendingUpIcon color="secondary" />} />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
            <MetricCard 
                title={selectedTenant === 0 ? "Total Tenants" : "Active Workflows"} 
                value={selectedTenant === 0 ? (stats.total_tenants || 0) : stats.active_workflows} 
                icon={selectedTenant === 0 ? <CorporateFareIcon color="info" /> : <SettingsIcon color="info" />} 
            />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
            <MetricCard title="Running Jobs" value={stats.running_jobs} icon={<SyncIcon color="warning" />} />
        </Grid>
        <Grid item xs={12} sm={6} md={2.4}>
            <MetricCard title="Success Rate" value={`${successRate}%`} icon={<CheckCircleIcon color="success" />} />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={8}>
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, height: '100%' }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
                      {selectedTenant === 0 ? 'Tenant Activity Comparison' : 'Workflow Execution Distribution'}
                  </Typography>
                  <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={selectedTenant === 0 ? tenantData : workflowData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                          <RechartsTooltip />
                          <Legend />
                          {selectedTenant === 0 ? (
                              <>
                                <Bar dataKey="events" name="Events Processed" fill="#28a745" radius={[0, 4, 4, 0]} barSize={12} />
                                <Bar dataKey="executions" name="Workflows Executed" fill="#de005b" radius={[0, 4, 4, 0]} barSize={12} />
                              </>
                          ) : (
                                <Bar dataKey="value" name="Executions" fill="#de005b" radius={[0, 4, 4, 0]} barSize={16} />
                          )}
                      </BarChart>
                  </ResponsiveContainer>
              </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 3, height: '100%' }}>
                  <Typography variant="h6" gutterBottom sx={{ fontSize: '0.875rem', fontWeight: 700, color: 'text.secondary' }}>EVENT RISK DISTRIBUTION</Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={eventBreakdownData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e1e4e8" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={{ stroke: '#e1e4e8' }} />
                            <YAxis tick={{ fontSize: 10 }} axisLine={{ stroke: '#e1e4e8' }} />
                            <RechartsTooltip />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                            <Bar dataKey="triggered" name="Triggered" stackId="a" fill="#28a745" />
                            <Bar dataKey="filtered_severity" name="Low Severity" stackId="a" fill="#ffc107" />
                            <Bar dataKey="filtered_type" name="Mismatch Type" stackId="a" fill="#fb7300" />
                            <Bar dataKey="no_workflow" name="No Workflow" stackId="a" fill="#6c757d" />
                        </BarChart>
                    </ResponsiveContainer>
                  </Box>
                  <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {eventBreakdownData.map((d) => (
                          <Box key={d.name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 60 }}>{d.name}</Typography>
                              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                  {d.triggered > 0 && <Chip label={`${d.triggered} Run`} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#28a745', color: 'white', borderRadius: 1 }} />}
                                  {d.filtered_severity > 0 && <Chip label={`${d.filtered_severity} Sev`} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#ffc107', color: 'black', borderRadius: 1 }} />}
                                  {d.filtered_type > 0 && <Chip label={`${d.filtered_type} Type`} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#fb7300', color: 'white', borderRadius: 1 }} />}
                                  {d.no_workflow > 0 && <Chip label={`${d.no_workflow} N/A`} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#6c757d', color: 'white', borderRadius: 1 }} />}
                              </Box>
                          </Box>
                      ))}
                  </Box>
              </Paper>
          </Grid>
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 2, mt: 6 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {selectedTenant === 0 ? 'Recent Global Activity' : 'Tenant Activity'}
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
                size="small"
                placeholder="Search Issue ID or Workflow..."
                value={search}
                onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                }}
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
                value={statusFilter}
                onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(0);
                }}
                startAdornment={<FilterListIcon fontSize="small" sx={{ mr: 1, color: 'action.active' }} />}
                sx={{ minWidth: 150 }}
            >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="failed">Failed</MenuItem>
                <MenuItem value="running">Running</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
            </Select>
        </Box>
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <TableContainer>
            <Table aria-label="collapsible table">
            <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                <TableCell width={50} />
                <TableCell sx={{ fontWeight: 700 }}>Job ID</TableCell>
                {selectedTenant === 0 && <TableCell sx={{ fontWeight: 700 }}>Tenant</TableCell>}
                <TableCell sx={{ fontWeight: 700 }}>Workflow Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Playbook Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Trigger ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Started At</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {recentJobs.length === 0 ? (
                    <TableRow><TableCell colSpan={selectedTenant === 0 ? 8 : 7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No execution history recorded yet.</TableCell></TableRow>
                ) : (
                    recentJobs.map((job) => (
                        <Row 
                            key={job.id} 
                            job={job} 
                            isGlobal={selectedTenant === 0}
                            tenants={tenants}
                            onRerun={() => {
                                setRerunTriggered(true);
                                fetchData();
                            }} 
                        />
                    ))
                )}
            </TableBody>
            </Table>
        </TableContainer>
        <TablePagination
            rowsPerPageOptions={[10, 25, 50]}
            component="div"
            count={totalJobs}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      <Snackbar open={rerunTriggered} autoHideDuration={3000} onClose={() => setRerunTriggered(false)}>
        <Alert severity="success" sx={{ width: '100%' }}>Manual workflow rerun triggered successfully!</Alert>
      </Snackbar>
    </Box>
  );
}

function MetricCard({ title, value, icon }: { title: string, value: string | number, icon: React.ReactNode }) {
    return (
        <Card variant="outlined" sx={{ borderRadius: 2 }}>
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>{title}</Typography>
                        <Typography variant="h4" sx={{ fontWeight: 800 }}>{value}</Typography>
                    </div>
                    <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: '50%', display: 'flex' }}>
                        {icon}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}