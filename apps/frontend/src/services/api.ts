import axios from 'axios';

// Dynamically determine the backend root URL
export const BACKEND_URL = (() => {
  const envUrl = (import.meta.env.VITE_API_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api$/, '');

  if (envUrl) {
    return envUrl;
  }

  // If in browser production environment (e.g. Vercel), fall back to deployed Render backend
  if (
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return 'https://reachinbox-api-786c.onrender.com';
  }

  return 'http://localhost:5000';
})();

export const API_BASE_URL = `${BACKEND_URL}/api`;
export const BULL_BOARD_URL = `${BACKEND_URL}/admin/queues`;

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('reachinbox_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.config?.url !== '/auth/me') {
      localStorage.removeItem('reachinbox_token');
    }
    return Promise.reject(error);
  }
);
