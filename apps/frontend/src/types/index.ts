export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
}

export interface Sender {
  id: string;
  email: string;
  hourlyLimit: number;
  minDelayMs: number;
  createdAt: string;
}

export interface Email {
  id: string;
  campaignId: string;
  senderId: string;
  userId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled' | 'deferred';
  attempts: number;
  providerMessageId?: string | null;
  error?: string | null;
  createdAt: string;
  sender?: { email: string };
  campaign?: { subject: string };
}

export interface Stats {
  scheduled: number;
  sent: number;
  failed: number;
  deferred: number;
  totalEmails: number;
  campaigns: number;
}

export interface SlackStatus {
  connected: boolean;
  connection?: {
    teamId: string;
    teamName: string;
    channel?: string;
    connectedAt: string;
  } | null;
}
