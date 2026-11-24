export enum EmailStatus {
  SCHEDULED = 'scheduled',
  PROCESSING = 'processing',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  DEFERRED = 'deferred'
}

export enum CampaignStatus {
  SCHEDULED = 'scheduled',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum OutboxStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PUBLISHED = 'published',
  FAILED = 'failed'
}

export interface EmailJobData {
  emailId: string;
  campaignId: string;
  senderId: string;
  userId: string;
}

export interface CreateCampaignDTO {
  subject: string;
  body: string;
  senderId: string;
  recipients: string[];
  startAt: string; // ISO string
  delaySeconds: number;
  hourlyLimit?: number;
}
