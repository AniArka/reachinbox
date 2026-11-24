import { prisma } from '../config/db';
import { addEmailJob } from '../queues/email.queue';
import { OutboxStatus } from '@reachinbox/shared';

export class OutboxDispatcher {
  private isRunning: boolean = false;
  private intervalTimer: NodeJS.Timeout | null = null;
  private pollIntervalMs: number = 1000;
  private batchSize: number = 50;

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🔄 Transactional Outbox Dispatcher started (polling every 1000ms)...');

    const loop = async () => {
      if (!this.isRunning) return;
      try {
        await this.dispatchPendingRecords();
      } catch (error) {
        console.error('❌ Error during outbox dispatch loop:', error);
      } finally {
        if (this.isRunning) {
          this.intervalTimer = setTimeout(loop, this.pollIntervalMs);
        }
      }
    };

    loop();
  }

  stop(): void {
    this.isRunning = false;
    if (this.intervalTimer) {
      clearTimeout(this.intervalTimer);
      this.intervalTimer = null;
    }
    console.log('🛑 Transactional Outbox Dispatcher stopped.');
  }

  async dispatchPendingRecords(): Promise<number> {
    return await prisma.$transaction(async (tx) => {
      // 1. Claim pending records with row locking (FOR UPDATE SKIP LOCKED)
      const pendingRecords = await tx.$queryRaw<any[]>`
        SELECT id, payload, attempts, "availableAt"
        FROM outbox_records
        WHERE status = 'pending' AND "availableAt" <= NOW()
        ORDER BY "availableAt" ASC
        LIMIT ${this.batchSize}
        FOR UPDATE SKIP LOCKED
      `;

      if (!pendingRecords || pendingRecords.length === 0) {
        return 0;
      }

      for (const record of pendingRecords) {
        try {
          const payload = typeof record.payload === 'string'
            ? JSON.parse(record.payload)
            : record.payload;

          const scheduledAt = new Date(payload.scheduledAt);

          // 2. Publish deterministic job to BullMQ
          await addEmailJob(
            {
              emailId: payload.emailId,
              campaignId: payload.campaignId,
              senderId: payload.senderId,
              userId: payload.userId,
            },
            scheduledAt
          );

          // 3. Mark outbox record as published
          await tx.$executeRaw`
            UPDATE outbox_records
            SET status = 'published', "publishedAt" = NOW()
            WHERE id = ${record.id}
          `;
        } catch (jobErr: any) {
          console.error(`❌ Failed to publish outbox record ${record.id} to BullMQ:`, jobErr);
          const nextAttempt = (record.attempts || 0) + 1;
          const backoffSeconds = Math.min(300, Math.pow(2, nextAttempt) * 2);

          await tx.$executeRaw`
            UPDATE outbox_records
            SET attempts = ${nextAttempt},
                "availableAt" = NOW() + (${backoffSeconds} * INTERVAL '1 second'),
                status = ${nextAttempt > 5 ? 'failed' : 'pending'}
            WHERE id = ${record.id}
          `;
        }
      }

      return pendingRecords.length;
    });
  }
}

export const outboxDispatcher = new OutboxDispatcher();
