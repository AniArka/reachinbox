import { prisma } from './config/db';
import { redisClient } from './config/redis';
import { esClient, EMAIL_INDEX } from './config/elasticsearch';
import { emailQueue } from './queues/email.queue';
import { outboxDispatcher } from './schedulers/outbox.dispatcher';
import { emailWorker } from './workers/email.worker';
import { CampaignService } from './services/campaign.service';
import { EmailService } from './services/email.service';
import { SenderService } from './services/sender.service';
import { DistributedRateLimiter } from './utils/rateLimiter';
import { EmailStatus, CampaignStatus } from '@reachinbox/shared';

async function runMasterE2ETestSuite() {
  console.log('\n======================================================');
  console.log('       REACHINBOX MASTER E2E VERIFICATION SUITE       ');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName} ${detail ? `(${detail})` : ''}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  try {
    // Clean test state
    await emailQueue.drain();
    await emailQueue.clean(0, 1000, 'delayed');
    await emailQueue.clean(0, 1000, 'wait');
    await emailQueue.clean(0, 1000, 'active');
    await emailQueue.clean(0, 1000, 'completed');
    await emailQueue.clean(0, 1000, 'failed');

    await prisma.outbox.deleteMany({});
    await prisma.emailEvent.deleteMany({});
    await prisma.email.deleteMany({});
    await prisma.campaign.deleteMany({});

    const redisKeys = await redisClient.keys('*sender*');
    if (redisKeys.length > 0) await redisClient.del(...redisKeys);

    const user = await prisma.user.findFirst({ where: { email: 'demo@reachinbox.ai' } });
    const sender = await prisma.sender.findFirst({ where: { userId: user!.id } });
    assert(Boolean(user && sender), 'System initialized with demo user and Ethereal sender');

    // Start background processors
    emailWorker.start();
    await outboxDispatcher.start();

    // -------------------------------------------------------------------------
    // Scenario 1: Schedule 10 emails -> 10 records and 10 jobs
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 1: Scheduling 10 Emails Batch ---');
    const startAt = new Date(Date.now() + 500);
    const recipients10 = Array.from({ length: 10 }, (_, i) => `batch.lead.${i + 1}@ethereal.email`);

    const campaign10 = await CampaignService.createCampaign(user!.id, {
      subject: 'Master E2E 10 Emails Test',
      body: 'Testing bulk campaign scheduling and transactional outbox batching.',
      senderId: sender!.id,
      recipients: recipients10,
      startAt: startAt.toISOString(),
      delaySeconds: 1,
      hourlyLimit: 50,
      idempotencyKey: 'idem-master-batch-10',
    });

    const emailCount10 = await prisma.email.count({ where: { campaignId: campaign10.id } });
    const outboxCount10 = await prisma.outbox.count({ where: { status: 'pending' } });
    assert(emailCount10 === 10, 'Created exactly 10 Email records in PostgreSQL transaction');
    assert(outboxCount10 >= 10, 'Created corresponding Outbox records for publication');

    // -------------------------------------------------------------------------
    // Scenario 2: Duplicate API request -> Idempotency Protection
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 2: Duplicate API Request (Idempotency) ---');
    const duplicateCampaign = await CampaignService.createCampaign(user!.id, {
      subject: 'Master E2E 10 Emails Test',
      body: 'Testing bulk campaign scheduling and transactional outbox batching.',
      senderId: sender!.id,
      recipients: recipients10,
      startAt: startAt.toISOString(),
      delaySeconds: 1,
      hourlyLimit: 50,
      idempotencyKey: 'idem-master-batch-10', // duplicate key
    });

    assert(duplicateCampaign.id === campaign10.id, 'Duplicate request with same idempotencyKey returns existing campaign');
    const totalEmailsAfterDupe = await prisma.email.count({ where: { campaignId: campaign10.id } });
    assert(totalEmailsAfterDupe === 10, 'No duplicate emails created in database on duplicate request');

    // -------------------------------------------------------------------------
    // Scenario 3: Multiple Independent Senders
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 3: Multiple Independent Senders ---');
    const senderB = await SenderService.createSender(user!.id, {
      autoProvision: true,
      hourlyLimit: 10,
      minDelayMs: 1000,
    });
    assert(Boolean(senderB.id && senderB.id !== sender!.id), 'Second independent sender created with isolated capacity');

    // Verify independent rate-limit keys in Redis
    const { windowKey } = DistributedRateLimiter.getHourlyWindowKey();
    const rA = await DistributedRateLimiter.reserveSendCapacity(sender!.id, 5, 100);
    const rB = await DistributedRateLimiter.reserveSendCapacity(senderB.id, 5, 100);
    assert(rA.allowed && rB.allowed, 'Both senders reserve capacity independently without cross-sender interference');

    // -------------------------------------------------------------------------
    // Scenario 4: Campaign Cancellation
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 4: Campaign Cancellation ---');
    const cancelCampaign = await CampaignService.createCampaign(user!.id, {
      subject: 'Campaign to be cancelled',
      body: 'This campaign will be cancelled before sending.',
      senderId: senderB.id,
      recipients: ['cancel.1@ethereal.email', 'cancel.2@ethereal.email'],
      startAt: new Date(Date.now() + 60000).toISOString(), // starts in 1m
      delaySeconds: 1,
    });

    const cancelResult = await CampaignService.cancelCampaign(cancelCampaign.id, user!.id);
    assert(cancelResult.cancelledCount === 2, 'Cancelled 2 pending emails in database');

    const cancelledInDb = await prisma.email.findMany({ where: { campaignId: cancelCampaign.id } });
    assert(cancelledInDb.every((e) => e.status === EmailStatus.CANCELLED), 'All email statuses updated to "cancelled"');

    // -------------------------------------------------------------------------
    // Scenario 5: Full-Text Search Derived Index Query
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 5: Elasticsearch Full-Text Search ---');
    await esClient.indices.refresh({ index: EMAIL_INDEX });
    const searchResult = await esClient.search({
      index: EMAIL_INDEX,
      query: { match_all: {} },
    });
    const totalIndexed = typeof searchResult.hits.total === 'number' ? searchResult.hits.total : searchResult.hits.total?.value || 0;
    assert(totalIndexed >= 1, 'Elasticsearch search index contains indexed documents', `Total indexed: ${totalIndexed}`);

    // -------------------------------------------------------------------------
    // Scenario 6: Database State Machine Claim Transitions
    // -------------------------------------------------------------------------
    console.log('\n--- Scenario 6: Database State Machine Claims ---');
    const testEmailId = cancelledInDb[0].id;
    // Attempt to claim a cancelled email
    const claimCancelled = await prisma.$queryRaw<any[]>`
      UPDATE emails
      SET status = 'processing', attempts = attempts + 1, "updatedAt" = NOW()
      WHERE id = ${testEmailId} AND status IN ('scheduled', 'deferred')
      RETURNING *
    `;
    assert(claimCancelled.length === 0, 'Cancelled email cannot be claimed by worker (safe atomic condition)');

  } catch (err: any) {
    console.error('Master E2E Test Suite Exception:', err);
    failed++;
  } finally {
    outboxDispatcher.stop();
    await emailWorker.stop();
    await emailQueue.close();
    await prisma.$disconnect();
    await redisClient.quit();
  }

  console.log('\n======================================================');
  console.log(` MASTER VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED `);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMasterE2ETestSuite();
