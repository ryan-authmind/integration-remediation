import axios from 'axios';

// Create an axios instance
// The base URL is relative because Vite proxies /api to localhost:8080
const client = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default client;
