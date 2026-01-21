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
    const apiKey = import.meta.env.VITE_ADMIN_API_KEY;
    
    // Debugging Auth
    if (!apiKey) {
        console.error("CRITICAL ERROR: VITE_ADMIN_API_KEY is missing or empty. Request will fail 401.");
    } else {
        // console.log("Attaching Authorization Header");
        config.headers.Authorization = `Bearer ${apiKey}`;
    }

    const tenantID = localStorage.getItem('selectedTenant');
    if (tenantID) {
        config.headers['X-Tenant-ID'] = tenantID;
    }
    
    return config;
});

export default client;
