import React, { useState } from 'react';
import { 
    Box, 
    Card, 
    CardContent, 
    Typography, 
    TextField, 
    Button, 
    Divider, 
    Stack, 
    Alert
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import GoogleIcon from '@mui/icons-material/Google';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
            navigate('/');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box 
            sx={{ 
                height: '100vh', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                bgcolor: '#f4f7f9',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            <Card 
                sx={{ 
                    width: 400, 
                    borderRadius: 1, 
                    boxShadow: '0px 10px 30px rgba(0, 0, 0, 0.1)',
                    border: '1px solid #e1e4e8',
                    position: 'relative',
                    zIndex: 1
                }}
            >
                <CardContent sx={{ p: 4 }}>
                    <Box sx={{ textAlign: 'center', mb: 4 }}>
                        <img src="/logo-darkmode.png" alt="AuthMind" style={{ height: '32px', marginBottom: '16px', filter: 'brightness(0) saturate(100%) invert(11%) sepia(94%) saturate(6144%) hue-rotate(330deg) brightness(88%) contrast(101%)' }} />
                        <Typography variant="h5" sx={{ fontWeight: 600, color: 'primary.main' }}>
                            Remediation Engine
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            Please sign in to continue
                        </Typography>
                    </Box>

                    {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 1, py: 0 }}>{error}</Alert>}

                    <form onSubmit={handleSubmit}>
                        <Stack spacing={2}>
                            <TextField
                                label="Email Address"
                                type="email"
                                fullWidth
                                size="small"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            <TextField
                                label="Password"
                                type="password"
                                fullWidth
                                size="small"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <Button 
                                type="submit" 
                                variant="contained" 
                                fullWidth
                                disabled={loading}
                                sx={{ py: 1, fontWeight: 600, mt: 1 }}
                            >
                                {loading ? 'Signing in...' : 'Sign In'}
                            </Button>
                        </Stack>
                    </form>

                    <Divider sx={{ my: 3 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                            OR
                        </Typography>
                    </Divider>

                    <Stack spacing={1.5}>
                        <Button
                            variant="outlined"
                            fullWidth
                            startIcon={<GoogleIcon />}
                            sx={{ color: 'text.primary', borderColor: '#e1e4e8', textTransform: 'none' }}
                            onClick={() => window.alert('OIDC Flow (Google) to be implemented')}
                        >
                            Google Account
                        </Button>
                        <Button
                            variant="outlined"
                            fullWidth
                            startIcon={<img src="/vendors/microsoft.png" style={{ height: '16px' }} />}
                            sx={{ color: 'text.primary', borderColor: '#e1e4e8', textTransform: 'none' }}
                            onClick={() => window.alert('OIDC Flow (Entra ID) to be implemented')}
                        >
                            Microsoft Entra
                        </Button>
                    </Stack>
                </CardContent>
                <Box sx={{ p: 2, textAlign: 'center', borderTop: '1px solid #e1e4e8', bgcolor: '#fcfcfc' }}>
                    <Typography variant="caption" color="text.disabled">
                        &copy; 2026 AuthMind Inc.
                    </Typography>
                </Box>
            </Card>
        </Box>
    );
}
