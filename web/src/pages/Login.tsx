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
    Alert,
    alpha
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
                bgcolor: 'background.default',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  opacity: 0.05,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 10 L90 10 L90 90 L10 90 Z' fill='none' stroke='%23ff1253' stroke-width='0.5'/%3E%3Ccircle cx='10' cy='10' r='2' fill='%23ff1253'/%3E%3Ccircle cx='90' cy='10' r='2' fill='%23fb7300'/%3E%3Ccircle cx='90' cy='90' r='2' fill='%23fbb400'/%3E%3C/svg%3E")`,
                  backgroundSize: '300px 300px',
                }
            }}
        >
            <Card 
                sx={{ 
                    width: 450, 
                    borderRadius: 4, 
                    boxShadow: '0px 25px 50px rgba(35, 34, 71, 0.15)',
                    position: 'relative',
                    zIndex: 1
                }}
            >
                <CardContent sx={{ p: 5 }}>
                    <Box sx={{ textAlign: 'center', mb: 4 }}>
                        <img src="/logo-darkmode.png" alt="AuthMind" style={{ height: '40px', marginBottom: '16px' }} />
                        <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '0.05em' }}>
                            INTEGRATION REMEDIATION
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontWeight: 500 }}>
                            Sign in to manage your environment
                        </Typography>
                    </Box>

                    {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

                    <form onSubmit={handleSubmit}>
                        <Stack spacing={2.5}>
                            <TextField
                                label="Email Address"
                                type="email"
                                fullWidth
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            <TextField
                                label="Password"
                                type="password"
                                fullWidth
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <Button 
                                type="submit" 
                                variant="contained" 
                                size="large" 
                                fullWidth
                                disabled={loading}
                                sx={{ py: 1.5, fontWeight: 800, fontSize: '1rem' }}
                            >
                                {loading ? 'SIGNING IN...' : 'SIGN IN'}
                            </Button>
                        </Stack>
                    </form>

                    <Divider sx={{ my: 4, borderStyle: 'dashed' }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
                            OR CONTINUE WITH
                        </Typography>
                    </Divider>

                    <Stack spacing={2}>
                        <Button
                            variant="outlined"
                            fullWidth
                            startIcon={<GoogleIcon />}
                            sx={{ py: 1.5, borderColor: '#ced5db', color: 'text.primary', fontWeight: 600 }}
                            onClick={() => window.alert('OIDC Flow (Google) to be implemented with backend redirect')}
                        >
                            Google Account
                        </Button>
                        <Button
                            variant="outlined"
                            fullWidth
                            startIcon={<img src="/vendors/microsoft.png" style={{ height: '18px' }} />}
                            sx={{ py: 1.5, borderColor: '#ced5db', color: 'text.primary', fontWeight: 600 }}
                            onClick={() => window.alert('OIDC Flow (Entra ID) to be implemented with backend redirect')}
                        >
                            Microsoft Entra
                        </Button>
                    </Stack>
                </CardContent>
                <Box sx={{ p: 2, textAlign: 'center', bgcolor: alpha('#73838f', 0.05) }}>
                    <Typography variant="caption" color="text.disabled" sx={{ fontWeight: 600 }}>
                        &copy; 2026 AuthMind Inc. All rights reserved.
                    </Typography>
                </Box>
            </Card>
        </Box>
    );
}
