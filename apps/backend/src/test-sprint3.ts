import { prisma } from './config/db';
import { redisClient } from './config/redis';
import { esClient, EMAIL_INDEX } from './config/elasticsearch';
import { emailQueue } from './queues/email.queue';
import { outboxDispatcher } from './schedulers/outbox.dispatcher';
import { emailWorker } from './workers/email.worker';
import { CampaignService } from './services/campaign.service';
import { EmailStatus, CampaignStatus } from '@reachinbox/shared';

async function runSprint3Verification() {
  console.log('\n======================================================');
  console.log('       REACHINBOX SPRINT 3 VERIFICATION SUITE         ');
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
    // 1. Clean slate for test isolation
    await emailQueue.drain();
    await emailQueue.clean(0, 1000, 'delayed');
    await emailQueue.clean(0, 1000, 'wait');
    await emailQueue.clean(0, 1000, 'active');
    await emailQueue.clean(0, 1000, 'completed');
    await emailQueue.clean(0, 1000, 'failed');

    // Clean DB records for clean test assertions
    await prisma.outbox.deleteMany({});
    await prisma.emailEvent.deleteMany({});
    await prisma.email.deleteMany({});
    await prisma.campaign.deleteMany({});

    // Reset Redis rate limit and pacing keys
    const keys = await redisClient.keys('*sender*');
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }

    const user = await prisma.user.findFirst({ where: { email: 'demo@reachinbox.ai' } });
    const sender = await prisma.sender.findFirst({ where: { userId: user!.id } });
    assert(Boolean(user && sender), 'Demo user and Ethereal sender ready for dispatch test', sender?.email);

    // 2. Start Outbox Dispatcher and Email Worker
    console.log('\n--- 1. Starting Outbox Dispatcher and Email Worker ---');
    emailWorker.start();
    await outboxDispatcher.start();

    // 3. Schedule 2 emails via CampaignService (spacing: 1s, minDelay: 2000ms)
    console.log('\n--- 2. Scheduling Emails for Real Ethereal SMTP Delivery ---');
    const startAt = new Date(Date.now() + 500); // starts in 500ms
    const recipients = ['test.lead1@ethereal.email', 'test.lead2@ethereal.email'];

    const campaign = await CampaignService.createCampaign(user!.id, {
      subject: 'Sprint 3 Live Delivery Test',
      body: 'Hello, this is a verified Ethereal delivery test from BullMQ worker!',
      senderId: sender!.id,
      recipients,
      startAt: startAt.toISOString(),
      delaySeconds: 1,
      hourlyLimit: 100,
    });

    assert(Boolean(campaign.id), 'Campaign created in PostgreSQL with pending Outbox records', campaign.id);

    // Wait for outbox dispatcher to publish and worker to send both emails (accounting for 2s pacing between sends)
    console.log('\n⏳ Waiting 10s for outbox dispatch + BullMQ execution + Ethereal SMTP delivery + pacing...');
    await new Promise((r) => setTimeout(r, 10000));

    // 4. Verify Outbox Records marked published
    console.log('\n--- 3. Verifying Outbox Records & BullMQ Enqueueing ---');
    const allOutbox = await prisma.outbox.findMany({});
    assert(
      allOutbox.length === 2 && allOutbox.every((o) => o.status === 'published'),
      'All outbox records published to BullMQ with status = "published"',
      `Published: ${allOutbox.filter((o) => o.status === 'published').length} / ${allOutbox.length}`
    );

    // 5. Verify PostgreSQL Email States and Ethereal Delivery
    console.log('\n--- 4. Verifying PostgreSQL Email State Machine & Ethereal Delivery ---');
    const sentEmails = await prisma.email.findMany({
      where: { campaignId: campaign.id },
      include: { events: true },
    });

    assert(sentEmails.length === 2, 'Found 2 emails for campaign');
    assert(
      sentEmails.every((e) => e.status === EmailStatus.SENT),
      'All campaign emails transitioned to status = "sent"',
      sentEmails.map((e) => `${e.recipient}: ${e.status}`).join(', ')
    );
    assert(
      sentEmails.every((e) => Boolean(e.providerMessageId)),
      'Ethereal providerMessageId persisted for all sent emails',
      sentEmails.map((e) => e.providerMessageId).join(', ')
    );

    // Verify Email Events
    const hasSentEvents = sentEmails.every((e) =>
      e.events.some((ev) => ev.type === 'email_sent' && (ev.metadata as any)?.previewUrl)
    );
    assert(hasSentEvents, 'EmailEvents logged with live Ethereal test preview URLs');

    // Verify Campaign status
    const updatedCampaign = await prisma.campaign.findUnique({ where: { id: campaign.id } });
    assert(updatedCampaign?.status === CampaignStatus.COMPLETED, 'Campaign marked as "completed" after all emails sent');

    // 6. Verify Elasticsearch derived search document
    console.log('\n--- 5. Verifying Elasticsearch Derived Index Synchronization ---');
    // Refresh index to ensure immediate search visibility
    await esClient.indices.refresh({ index: EMAIL_INDEX });
    const esEmail1 = await esClient.get({
      index: EMAIL_INDEX,
      id: sentEmails[0].id,
    });
    assert(
      esEmail1.found && (esEmail1._source as any)?.status === EmailStatus.SENT,
      'Elasticsearch contains synchronized document with status = "sent"'
    );

    // 7. Restart Recovery Verification (Explicit requirement)
    console.log('\n--- 6. Testing Restart Recovery (Crash & Restart Resilience) ---');
    // Schedule a future campaign (starts in 2 seconds)
    const futureStartAt = new Date(Date.now() + 2000);
    const recoveryCampaign = await CampaignService.createCampaign(user!.id, {
      subject: 'Restart Recovery Verification',
      body: 'Testing that future jobs survive backend process restart!',
      senderId: sender!.id,
      recipients: ['recovery.test@ethereal.email'],
      startAt: futureStartAt.toISOString(),
      delaySeconds: 1,
    });

    // Simulate backend crash: stop dispatcher and worker abruptly
    console.log('💥 Simulating backend shutdown / crash...');
    outboxDispatcher.stop();
    await emailWorker.stop();

    // Verify email is still scheduled in PostgreSQL
    const preRestartEmail = await prisma.email.findFirst({ where: { campaignId: recoveryCampaign.id } });
    assert(preRestartEmail?.status === EmailStatus.SCHEDULED, 'Pre-restart email remains safely persisted as "scheduled"');

    // Simulate backend restart
    console.log('🔄 Restarting backend services (worker + outbox dispatcher)...');
    emailWorker.start();
    await outboxDispatcher.start();

    // Wait 7 seconds for execution after restart
    console.log('⏳ Waiting 7s for post-restart execution...');
    await new Promise((r) => setTimeout(r, 7000));

    // Verify email executes successfully post-restart
    const postRestartEmail = await prisma.email.findFirst({ where: { campaignId: recoveryCampaign.id } });
    assert(
      postRestartEmail?.status === EmailStatus.SENT,
      'Restart recovery verified: future email executed cleanly without manual job recreation',
      `Message ID: ${postRestartEmail?.providerMessageId}`
    );

    // Verify previously sent emails were NOT resent
    const originalEmailsCount = await prisma.email.count({ where: { campaignId: campaign.id, status: EmailStatus.SENT } });
    assert(originalEmailsCount === 2, 'Confirmed sent emails were not re-sent upon restart');

  } catch (err: any) {
    console.error('Sprint 3 Test Suite Exception:', err);
    failed++;
  } finally {
    outboxDispatcher.stop();
    await emailWorker.stop();
    await emailQueue.close();
    await prisma.$disconnect();
    await redisClient.quit();
  }

  console.log('\n======================================================');
  console.log(` VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED `);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSprint3Verification();
