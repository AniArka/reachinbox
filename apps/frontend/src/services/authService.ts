import { api } from './api';
import { User } from '../types';

export const authService = {
  async getMe(): Promise<User | null> {
    try {
      const res = await api.get('/auth/me');
      return res.data.user;
    } catch {
      return null;
    }
  },

  async login(email?: string, password?: string): Promise<{ token: string; user: User }> {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.token) {
      localStorage.setItem('reachinbox_token', res.data.token);
    }
    return res.data;
  },

  async demoLogin(): Promise<{ token: string; user: User }> {
    const res = await api.post('/auth/demo-login');
    if (res.data.token) {
      localStorage.setItem('reachinbox_token', res.data.token);
    }
    return res.data;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('reachinbox_token');
    }
  },
};
