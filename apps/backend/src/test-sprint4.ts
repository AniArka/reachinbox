import { prisma } from './config/db';
import { redisClient } from './config/redis';
import { app } from './app';
import { emailQueue } from './queues/email.queue';
import { outboxDispatcher } from './schedulers/outbox.dispatcher';
import { emailWorker } from './workers/email.worker';
import { CampaignService } from './services/campaign.service';
import { DistributedRateLimiter } from './utils/rateLimiter';
import { SlackNotificationService } from './integrations/slack/slack.service';
import { EmailStatus } from '@reachinbox/shared';
import http from 'http';

async function runSprint4Verification() {
  console.log('\n======================================================');
  console.log('       REACHINBOX SPRINT 4 VERIFICATION SUITE         ');
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

  const server = http.createServer(app);
  const PORT = 5097;
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  const baseUrl = `http://localhost:${PORT}`;

  try {
    // 1. Clean test state
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

    const keys = await redisClient.keys('*sender*');
    if (keys.length > 0) await redisClient.del(...keys);
    const slackKeys = await redisClient.keys('*slack*');
    if (slackKeys.length > 0) await redisClient.del(...slackKeys);

    // 2. Test Bull Board endpoint
    console.log('--- 1. Testing Bull Board Queue Dashboard ---');
    const bbRes = await fetch(`${baseUrl}/admin/queues/`);
    assert(bbRes.status === 200, 'GET /admin/queues/ returns 200 OK (Bull Board live)');

    // 3. Test Slack Status API
    console.log('\n--- 2. Testing Slack Integration Routes ---');
    const slackStatusRes = await fetch(`${baseUrl}/api/slack/status`);
    const slackStatusJson = (await slackStatusRes.json()) as any;
    assert(slackStatusRes.status === 200, 'GET /api/slack/status returns 200 OK', `Connected: ${slackStatusJson.connected}`);

    // 4. Test Atomic Lua Script Rate Limiting
    console.log('\n--- 3. Testing Atomic Lua Rate Limiting & Capacity Reservation ---');
    const testSenderId = 'test-sender-lua-' + Date.now();
    const testHourlyLimit = 3;
    const testMinDelay = 100; // fast for unit test

    // Attempt 3 reservations
    const r1 = await DistributedRateLimiter.reserveSendCapacity(testSenderId, testHourlyLimit, testMinDelay);
    assert(r1.allowed && r1.currentCount === 1, 'First send capacity reservation allowed (count: 1)');

    await new Promise((r) => setTimeout(r, 120));
    const r2 = await DistributedRateLimiter.reserveSendCapacity(testSenderId, testHourlyLimit, testMinDelay);
    assert(r2.allowed && r2.currentCount === 2, 'Second send capacity reservation allowed (count: 2)');

    await new Promise((r) => setTimeout(r, 120));
    const r3 = await DistributedRateLimiter.reserveSendCapacity(testSenderId, testHourlyLimit, testMinDelay);
    assert(r3.allowed && r3.currentCount === 3, 'Third send capacity reservation allowed (count: 3)');

    await new Promise((r) => setTimeout(r, 120));
    const r4 = await DistributedRateLimiter.reserveSendCapacity(testSenderId, testHourlyLimit, testMinDelay);
    assert(!r4.allowed && r4.deferred, 'Fourth send capacity reservation deferred (limit of 3 reached)');

    // 5. Test Slack Alert Deduplication
    console.log('\n--- 4. Testing Slack Notification & Deduplication ---');
    const user = await prisma.user.findFirst({ where: { email: 'demo@reachinbox.ai' } });
    const { windowKey } = DistributedRateLimiter.getHourlyWindowKey();

    // First alert trigger
    const alert1Sent = await SlackNotificationService.notifyRateLimitReached(
      user!.id,
      'test.sender@reachinbox.ai',
      testSenderId,
      testHourlyLimit,
      windowKey,
      new Date(Date.now() + 3600000)
    );
    // Since slack might not have real credentials in dev, notifyRateLimitReached attempts delivery and sets dedupe key
    const dedupeKey = `slack:alert-sent:${testSenderId}:${windowKey}`;
    const dedupeSet = await redisClient.get(dedupeKey);
    assert(dedupeSet === '1', 'Slack alert deduplication key set in Redis for active hour window');

    // Second alert trigger for same window
    const alert2Sent = await SlackNotificationService.notifyRateLimitReached(
      user!.id,
      'test.sender@reachinbox.ai',
      testSenderId,
      testHourlyLimit,
      windowKey,
      new Date(Date.now() + 3600000)
    );
    assert(alert2Sent === false, 'Subsequent rate-limit alerts in same hour window are deduplicated without spamming');

    // 6. Test Live Campaign Rate Limiting & Deferred Rescheduling
    console.log('\n--- 5. Testing Live Campaign with Hourly Limit = 2 (Emails Deferred) ---');
    emailWorker.start();
    await outboxDispatcher.start();

    const sender = await prisma.sender.findFirst({ where: { userId: user!.id } });
    // Clear redis for this real sender
    const realSenderKeys = await redisClient.keys(`*${sender!.id}*`);
    if (realSenderKeys.length > 0) await redisClient.del(...realSenderKeys);

    // Schedule 4 emails with hourlyLimit = 2
    const startAt = new Date(Date.now() + 500);
    const recipients = [
      'limit.lead1@ethereal.email',
      'limit.lead2@ethereal.email',
      'limit.lead3@ethereal.email',
      'limit.lead4@ethereal.email',
    ];

    const campaign = await CampaignService.createCampaign(user!.id, {
      subject: 'Hourly Rate Limit Test (Limit = 2)',
      body: 'Testing deferred execution when hourly limit is reached.',
      senderId: sender!.id,
      recipients,
      startAt: startAt.toISOString(),
      delaySeconds: 1,
      hourlyLimit: 2, // Limit is 2!
    });

    console.log('⏳ Waiting 10s for Outbox Dispatcher + Worker execution...');
    await new Promise((r) => setTimeout(r, 10000));

    // Verify outcomes: 2 emails sent, 2 emails deferred
    const emails = await prisma.email.findMany({
      where: { campaignId: campaign.id },
      orderBy: { scheduledAt: 'asc' },
    });

    const sentCount = emails.filter((e) => e.status === EmailStatus.SENT).length;
    const deferredCount = emails.filter((e) => e.status === EmailStatus.DEFERRED).length;

    assert(sentCount === 2, 'Exactly 2 emails sent under hourly limit of 2', `Sent: ${sentCount}`);
    assert(deferredCount === 2, 'Remaining 2 emails deferred rather than dropped or failed', `Deferred: ${deferredCount}`);

    // Verify deferred emails have future scheduledAt timestamps
    const deferredEmails = emails.filter((e) => e.status === EmailStatus.DEFERRED);
    const hasFutureSchedule = deferredEmails.every((e) => e.scheduledAt.getTime() > Date.now());
    assert(hasFutureSchedule, 'Deferred emails have future scheduled timestamps pointing to next sending window');

  } catch (err: any) {
    console.error('Sprint 4 Test Suite Exception:', err);
    failed++;
  } finally {
    outboxDispatcher.stop();
    await emailWorker.stop();
    await emailQueue.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
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

runSprint4Verification();
