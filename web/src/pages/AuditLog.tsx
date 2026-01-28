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
  Chip,
  Avatar,
  alpha,
  useTheme
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import ComputerIcon from '@mui/icons-material/Computer';

interface AuditLogEntry {
    id: number;
    timestamp: string;
    user_id: number;
    user: { name: string, email: string, avatar_url?: string };
    tenant_id: number;
    tenant: { name: string };
    action: string;
    resource: string;
    target_id: string;
    details: string;
    ip: string;
}

export default function AuditLog() {
    const [logs, setLogs] = useState<AuditLogEntry[]>([]);
    const [, setLoading] = useState(true);
    const theme = useTheme();

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const res = await client.get('/audit/logs');
                setLogs(res.data);
            } catch (err) {
                console.error("Failed to fetch audit logs", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const getActionColor = (action: string) => {
        switch (action) {
            case 'CREATE': return '#5ab645';
            case 'UPDATE': return '#fb7300';
            case 'DELETE': return '#ff2b00';
            case 'EXECUTE': return '#ff1253';
            case 'LOGIN': return '#232247';
            default: return theme.palette.grey[500];
        }
    };

    return (
        <Box>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <HistoryIcon sx={{ fontSize: 40, color: 'primary.main' }} /> Audit History
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
                    Traceable record of all administrative actions and system modifications.
                </Typography>
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
                <Table>
                    <TableHead sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.02) }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 800 }}>Timestamp</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>User</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Action</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Resource</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Details</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>IP Address</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {logs.map((log) => (
                            <TableRow key={log.id} hover>
                                <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                                    {new Date(log.timestamp).toLocaleString()}
                                </TableCell>
                                <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <Avatar 
                                            src={log.user?.avatar_url} 
                                            sx={{ width: 28, height: 28, bgcolor: 'secondary.main', fontSize: '0.75rem' }}
                                        >
                                            {log.user?.name?.charAt(0) || 'U'}
                                        </Avatar>
                                        <Box>
                                            <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                                {log.user?.name || 'System'}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {log.user?.email || 'automated@system'}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Chip 
                                        label={log.action} 
                                        size="small" 
                                        sx={{ 
                                            fontWeight: 800, 
                                            fontSize: '0.65rem', 
                                            bgcolor: alpha(getActionColor(log.action), 0.1),
                                            color: getActionColor(log.action),
                                            border: `1px solid ${alpha(getActionColor(log.action), 0.2)}`
                                        }} 
                                    />
                                </TableCell>
                                <TableCell>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{log.resource}</Typography>
                                    <Typography variant="caption" color="text.secondary">ID: {log.target_id}</Typography>
                                </TableCell>
                                <TableCell sx={{ maxWidth: 300 }}>
                                    <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {log.details}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                                        <ComputerIcon sx={{ fontSize: 14 }} />
                                        <Typography variant="caption">{log.ip}</Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
