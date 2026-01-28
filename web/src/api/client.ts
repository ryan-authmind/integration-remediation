import axios from 'axios';

// Create an axios instance
// The base URL is relative because Vite proxies /api to localhost:8080
const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to inject Auth and Tenant headers
client.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    const apiKey = import.meta.env.VITE_ADMIN_API_KEY;
    
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    } else if (apiKey) {
        config.headers.Authorization = `Bearer ${apiKey}`;
    }

    const tenantID = localStorage.getItem('selectedTenant');
    if (tenantID) {
        config.headers['X-Tenant-ID'] = tenantID;
    }
    
    return config;
});

// Response interceptor to handle 401 Unauthorized
client.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default client;
