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
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  Snackbar,
  Alert,
  Select,
  MenuItem,
  TablePagination
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
    event_breakdown?: Array<{risk: string, triggered: number, filtered: number}>;
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

function Row(props: { job: Job, onRerun: () => void, isGlobal: boolean, tenants: Tenant[] }) {
  const { job, onRerun, isGlobal, tenants } = props;
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<JobLog[]>([]);
  const [loading, setLoading] = useState(false);

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
            <Box sx={{ margin: 2 }}>
              <Typography variant="subtitle2" gutterBottom component="div" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                <TaskAltIcon fontSize="small" color="primary" /> Execution Audit Trail
              </Typography>
              {loading ? (
                  <CircularProgress size={20} sx={{ m: 2 }} />
              ) : logs.length === 0 ? (
                  <Typography variant="caption" sx={{ ml: 4, fontStyle: 'italic' }}>No detailed logs available for this job.</Typography>
              ) : (
                <List dense sx={{ bgcolor: 'action.hover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                  {logs.map((log) => (
                    <ListItem key={log.id} divider>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {log.level === 'ERROR' ? <ErrorIcon color="error" sx={{ fontSize: 16 }} /> : <InfoIcon color="info" sx={{ fontSize: 16 }} />}
                      </ListItemIcon>
                      <ListItemText 
                        primary={
                          (() => {
                            const hasResponse = log.message.includes('\nResponse: ');
                            const mainPart = hasResponse ? log.message.split('\nResponse: ')[0] : log.message;
                            const responsePart = hasResponse ? log.message.split('\nResponse: ')[1] : null;
                            const statusMatch = mainPart.match(/\(Status: (\d+)\)/);
                            const statusCode = statusMatch ? statusMatch[1] : null;
                            const cleanMainPart = statusCode ? mainPart.replace(`(Status: ${statusCode})`, '').trim() : mainPart;

                            return (
                              <>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontWeight: log.level === 'ERROR' ? 700 : 500 }}>
                                    {cleanMainPart}
                                  </Typography>
                                  {statusCode && (
                                    <Chip 
                                      label={statusCode} 
                                      size="small" 
                                      variant="outlined"
                                      color={parseInt(statusCode) >= 400 ? "error" : "success"}
                                      sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, borderRadius: 0.5 }}
                                    />
                                  )}
                                </Box>
                                {responsePart && (
                                  <Box component="code" sx={{ display: 'block', p: 1, bgcolor: 'background.paper', borderRadius: 1, fontSize: '0.75rem', fontFamily: 'monospace', border: '1px solid', borderColor: 'divider', color: 'primary.main', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                    {responsePart}
                                  </Box>
                                )}
                              </>
                            );
                          })()
                        }
                        secondary={new Date(log.timestamp).toLocaleTimeString()}
                        primaryTypographyProps={{ component: 'div', variant: 'body2', sx: { whiteSpace: 'pre-wrap' } }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
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
            client.get(`/jobs?page=${page + 1}&pageSize=${rowsPerPage}`, { headers }),
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
  }, [page, rowsPerPage, selectedTenant]);

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
        filtered: item.filtered,
        total: item.triggered + item.filtered
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
                                <Bar dataKey="events" name="Events Processed" fill="#00D1B2" radius={[0, 4, 4, 0]} barSize={15} />
                                <Bar dataKey="executions" name="Workflows Executed" fill="#0062FF" radius={[0, 4, 4, 0]} barSize={15} />
                              </>
                          ) : (
                                <Bar dataKey="value" name="Executions" fill="#0062FF" radius={[0, 4, 4, 0]} barSize={20} />
                          )}
                      </BarChart>
                  </ResponsiveContainer>
              </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, height: '100%' }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>Event Risk Distribution</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                      Breakdown of all processed events by Risk and whether they triggered a workflow.
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={eventBreakdownData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <RechartsTooltip />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            <Bar dataKey="triggered" name="Triggered" stackId="a" fill="#00D1B2" radius={[0, 0, 0, 0]} />
                            <Bar dataKey="filtered" name="Filtered" stackId="a" fill="#FFBB28" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                  </Box>
                  <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {eventBreakdownData.map((d) => (
                          <Box key={d.name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{d.name}</Typography>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                  <Chip label={`${d.triggered} Run`} size="small" sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'success.light', color: 'success.contrastText' }} />
                                  <Chip label={`${d.filtered} Skipped`} size="small" sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'warning.light', color: 'warning.contrastText' }} />
                              </Box>
                          </Box>
                      ))}
                  </Box>
              </Paper>
          </Grid>
      </Grid>

      <Typography variant="h5" gutterBottom sx={{ mt: 6, fontWeight: 700 }}>
          {selectedTenant === 0 ? 'Recent Global Activity' : 'Tenant Activity'}
      </Typography>
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