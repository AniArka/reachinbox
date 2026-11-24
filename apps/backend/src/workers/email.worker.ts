import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { redisConfig } from '../config/redis';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { EMAIL_QUEUE_NAME, emailQueue, addEmailJob } from '../queues/email.queue';
import { createEtherealTransporter } from '../integrations/smtp/ethereal';
import { decrypt } from '../utils/encryption';
import { DistributedRateLimiter } from '../utils/rateLimiter';
import { EmailIndexer } from '../integrations/elasticsearch/indexer';
import { EmailStatus, CampaignStatus, EmailJobData } from '@reachinbox/shared';

export class EmailWorkerService {
  private worker: Worker<EmailJobData> | null = null;

  start(): void {
    if (this.worker) return;

    this.worker = new Worker<EmailJobData>(
      EMAIL_QUEUE_NAME,
      async (job: Job<EmailJobData>) => {
        await this.processEmail(job);
      },
      {
        connection: redisConfig,
        concurrency: env.WORKER_CONCURRENCY,
      }
    );

    this.worker.on('completed', (job) => {
      console.log(`✅ [Worker] Email job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job, err) => {
      console.error(`❌ [Worker] Email job ${job?.id} failed:`, err.message);
    });

    console.log(`🚀 [Worker] Email Worker started with concurrency = ${env.WORKER_CONCURRENCY}`);
  }

  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
      console.log('🛑 [Worker] Email Worker stopped');
    }
  }

  private async processEmail(job: Job<EmailJobData>): Promise<void> {
    const { emailId, campaignId, senderId } = job.data;

    // 1. Database-backed atomic claim
    const claimedEmails = await prisma.$queryRaw<any[]>`
      UPDATE emails
      SET status = 'processing', attempts = attempts + 1, "updatedAt" = NOW()
      WHERE id = ${emailId} AND status IN ('scheduled', 'deferred')
      RETURNING *
    `;

    if (!claimedEmails || claimedEmails.length === 0) {
      // Check current authoritative status
      const existing = await prisma.email.findUnique({ where: { id: emailId } });
      if (existing?.status === EmailStatus.CANCELLED) {
        console.log(`ℹ️ [Worker] Skipping cancelled email ${emailId}`);
        return;
      }
      if (existing?.status === EmailStatus.SENT) {
        console.log(`ℹ️ [Worker] Skipping already sent email ${emailId}`);
        return;
      }
      console.warn(`⚠️ [Worker] Email ${emailId} not eligible for sending (status: ${existing?.status})`);
      return;
    }

    const email = claimedEmails[0];

    // 2. Fetch Sender details
    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
    });

    if (!sender) {
      await this.markEmailFailed(emailId, 'Sender not found');
      return;
    }

    // 3. Distributed Rate Limiting & Pacing Check (Atomic Lua)
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    const effectiveHourlyLimit = campaign?.hourlyLimit || sender.hourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER;
    const effectiveMinDelayMs = sender.minDelayMs || env.MIN_EMAIL_DELAY_MS;

    const rateLimit = await DistributedRateLimiter.reserveSendCapacity(
      sender.id,
      effectiveHourlyLimit,
      effectiveMinDelayMs
    );

    if (rateLimit.deferred) {
      // Limit or pacing wait hit: Defer job without blocking worker thread
      const deferMs = Math.max(1000, rateLimit.deferDurationMs || 5000);
      const rescheduledAt = new Date(Date.now() + deferMs);

      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.DEFERRED,
          scheduledAt: rescheduledAt,
        },
      });

      await prisma.emailEvent.create({
        data: {
          emailId,
          type: 'email_deferred',
          metadata: {
            reason: rateLimit.currentCount >= rateLimit.hourlyLimit ? 'HOURLY_LIMIT_EXCEEDED' : 'MIN_DELAY_PACING',
            deferMs,
            rescheduledAt: rescheduledAt.toISOString(),
          },
        },
      });

      console.log(`⏳ [Worker] Sender ${sender.email} rate limit / pacing hit. Deferring email ${emailId} for ${deferMs}ms`);

      // Re-add to BullMQ queue with delay using unique attempt suffix
      await emailQueue.add('send-email', job.data, {
        jobId: `email-${emailId}-attempt-${email.attempts + 1}`,
        delay: deferMs,
      });
      return;
    }

    // 4. Send via Ethereal SMTP
    await prisma.emailEvent.create({
      data: {
        emailId,
        type: 'sending_started',
        metadata: { sender: sender.email, attempt: email.attempts },
      },
    });

    try {
      const etherealPass = sender.etherealPass ? decrypt(sender.etherealPass) : env.ETHEREAL_PASS;
      const transporter = createEtherealTransporter({
        user: sender.etherealUser || sender.email,
        pass: etherealPass,
        host: env.ETHEREAL_HOST,
        port: env.ETHEREAL_PORT,
      });

      const info = await transporter.sendMail({
        from: `"${sender.email}" <${sender.email}>`,
        to: email.recipient,
        subject: email.subject,
        text: email.body,
        html: `<p>${email.body.replace(/\n/g, '<br/>')}</p>`,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info) || null;
      console.log(`📬 [Worker] Sent email ${emailId} to ${email.recipient}! Preview URL: ${previewUrl}`);

      // 5. Persist success state in PostgreSQL
      const sentAt = new Date();
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: EmailStatus.SENT,
          sentAt,
          providerMessageId: info.messageId,
          error: null,
        },
      });

      await prisma.emailEvent.create({
        data: {
          emailId,
          type: 'email_sent',
          metadata: {
            messageId: info.messageId,
            previewUrl,
          },
        },
      });

      // 6. Update Elasticsearch derived search document
      await EmailIndexer.indexEmail({
        emailId,
        campaignId,
        senderId,
        userId: email.userId,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: EmailStatus.SENT,
        scheduledAt: email.scheduledAt.toISOString(),
        sentAt: sentAt.toISOString(),
        createdAt: email.createdAt.toISOString(),
      });

      // 7. Check if parent campaign is completed
      const remainingUnsent = await prisma.email.count({
        where: {
          campaignId,
          status: { in: [EmailStatus.SCHEDULED, EmailStatus.PROCESSING, EmailStatus.DEFERRED] },
        },
      });

      if (remainingUnsent === 0) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: CampaignStatus.COMPLETED },
        });
      }
    } catch (smtpErr: any) {
      console.error(`💥 [Worker] SMTP send failed for email ${emailId}:`, smtpErr.message);

      // Release hourly capacity reservation since send failed
      await DistributedRateLimiter.releaseCapacity(sender.id);

      await prisma.emailEvent.create({
        data: {
          emailId,
          type: 'email_failed',
          metadata: { error: smtpErr.message, attempt: email.attempts },
        },
      });

      const isFinalAttempt = (job.attemptsMade + 1) >= (job.opts.attempts || env.EMAIL_MAX_RETRIES);

      if (isFinalAttempt) {
        await this.markEmailFailed(emailId, smtpErr.message);
      } else {
        // Reset state so BullMQ retry can claim it
        await prisma.email.update({
          where: { id: emailId },
          data: { status: EmailStatus.SCHEDULED, error: smtpErr.message },
        });
      }

      throw smtpErr; // Let BullMQ handle retry and backoff
    }
  }

  private async markEmailFailed(emailId: string, error: string): Promise<void> {
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: EmailStatus.FAILED,
        error,
      },
    });

    await EmailIndexer.updateStatus(emailId, EmailStatus.FAILED);
  }
}

export const emailWorker = new EmailWorkerService();
