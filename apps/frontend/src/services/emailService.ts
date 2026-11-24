import { api } from './api';
import { Stats, Email, Sender, SlackStatus } from '../types';

export const emailService = {
  async getStats(): Promise<Stats> {
    const res = await api.get('/emails/stats');
    return res.data.data;
  },

  async getScheduledEmails(page = 1, search = ''): Promise<{ emails: Email[]; pagination: any }> {
    const res = await api.get('/emails/scheduled', {
      params: { page, limit: 15, search: search || undefined },
    });
    return res.data;
  },

  async getSentEmails(page = 1, search = ''): Promise<{ emails: Email[]; pagination: any }> {
    const res = await api.get('/emails/sent', {
      params: { page, limit: 15, search: search || undefined },
    });
    return res.data;
  },

  async searchEmails(query: string, status?: string, page = 1): Promise<{ emails: Email[]; pagination: any }> {
    const res = await api.get('/emails/search', {
      params: { q: query, status: status || undefined, page, limit: 15 },
    });
    return res.data;
  },

  async createCampaign(data: {
    subject: string;
    body: string;
    senderId: string;
    recipients: string[];
    startAt: string;
    delaySeconds: number;
    hourlyLimit?: number;
  }) {
    const res = await api.post('/campaigns', data);
    return res.data;
  },

  async cancelCampaign(campaignId: string) {
    const res = await api.post(`/campaigns/${campaignId}/cancel`);
    return res.data;
  },

  async getSenders(): Promise<Sender[]> {
    const res = await api.get('/senders');
    return res.data.data;
  },

  async createSender(data: { autoProvision?: boolean; email?: string; hourlyLimit?: number; minDelayMs?: number }) {
    const res = await api.post('/senders', data);
    return res.data.data;
  },

  async getSlackStatus(): Promise<SlackStatus> {
    const res = await api.get('/slack/status');
    return res.data;
  },

  async disconnectSlack() {
    const res = await api.delete('/slack/disconnect');
    return res.data;
  },

  async testSlackAlert() {
    const res = await api.post('/slack/test');
    return res.data;
  },
};
