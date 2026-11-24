import { Queue, QueueEvents } from 'bullmq';
import { redisConfig } from '../config/redis';
import { env } from '../config/env';
import { EmailJobData } from '@reachinbox/shared';

export const EMAIL_QUEUE_NAME = 'email-queue';

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: env.EMAIL_MAX_RETRIES,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: false,
    removeOnFail: false,
  },
});

export const emailQueueEvents = new QueueEvents(EMAIL_QUEUE_NAME, {
  connection: redisConfig,
});

export async function addEmailJob(data: EmailJobData, scheduledAt: Date) {
  const delayMs = Math.max(0, scheduledAt.getTime() - Date.now());

  return emailQueue.add(
    'send-email',
    data,
    {
      jobId: `email-${data.emailId}`,
      delay: delayMs,
    }
  );
}
