import { prisma } from './config/db';
import { redisClient } from './config/redis';
import { esClient, EMAIL_INDEX } from './config/elasticsearch';
import { app } from './app';
import http from 'http';

async function runSprint1Verification() {
  console.log('\n======================================================');
  console.log('       REACHINBOX SPRINT 1 VERIFICATION SUITE         ');
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

  // 1. Test Express Health Endpoints
  console.log('--- 1. Testing Express Health Endpoints ---');
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(5099, resolve));

  try {
    const resBasic = await fetch('http://localhost:5099/health');
    const jsonBasic = (await resBasic.json()) as any;
    assert(resBasic.status === 200 && jsonBasic.status === 'ok', 'GET /health endpoint responds 200 OK');

    const resDetailed = await fetch('http://localhost:5099/health/detailed');
    const jsonDetailed = (await resDetailed.json()) as any;
    assert(
      resDetailed.status === 200 &&
        jsonDetailed.services?.database?.status === 'healthy' &&
        jsonDetailed.services?.redis?.status === 'healthy' &&
        jsonDetailed.services?.elasticsearch?.status === 'healthy',
      'GET /health/detailed reports all services healthy',
      `DB: ${jsonDetailed.services?.database?.status}, Redis: ${jsonDetailed.services?.redis?.status}, ES: ${jsonDetailed.services?.elasticsearch?.status}`
    );
  } catch (err: any) {
    assert(false, 'HTTP Server health check', err.message);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  // 2. Test PostgreSQL & Prisma Models
  console.log('\n--- 2. Testing PostgreSQL & Prisma Models ---');
  try {
    const userCount = await prisma.user.count();
    assert(userCount >= 1, 'PostgreSQL User table exists and has seed data', `Users: ${userCount}`);

    const senderCount = await prisma.sender.count();
    assert(senderCount >= 1, 'PostgreSQL Sender table exists and has active sender', `Senders: ${senderCount}`);

    // Verify all core tables can be queried
    const campaignCount = await prisma.campaign.count();
    const emailCount = await prisma.email.count();
    const outboxCount = await prisma.outbox.count();
    const slackCount = await prisma.slackConnection.count();
    const eventCount = await prisma.emailEvent.count();

    assert(
      typeof campaignCount === 'number' &&
        typeof emailCount === 'number' &&
        typeof outboxCount === 'number' &&
        typeof slackCount === 'number' &&
        typeof eventCount === 'number',
      'All 7 Prisma models verified in PostgreSQL',
      `Campaigns: ${campaignCount}, Emails: ${emailCount}, Outbox: ${outboxCount}, Slack: ${slackCount}, Events: ${eventCount}`
    );
  } catch (err: any) {
    assert(false, 'PostgreSQL queries', err.message);
  }

  // 3. Test Redis Execution
  console.log('\n--- 3. Testing Redis State Engine ---');
  try {
    const ping = await redisClient.ping();
    assert(ping === 'PONG', 'Redis PING responds PONG');

    await redisClient.set('test:sprint1:key', 'reachinbox-value', 'EX', 10);
    const val = await redisClient.get('test:sprint1:key');
    assert(val === 'reachinbox-value', 'Redis atomic SET and GET verified');
    await redisClient.del('test:sprint1:key');
  } catch (err: any) {
    assert(false, 'Redis operations', err.message);
  }

  // 4. Test Elasticsearch Derived Index
  console.log('\n--- 4. Testing Elasticsearch Derived Index ---');
  try {
    const esPing = await esClient.ping();
    assert(Boolean(esPing), 'Elasticsearch cluster is reachable');

    const indexExists = await esClient.indices.exists({ index: EMAIL_INDEX });
    assert(Boolean(indexExists), `Elasticsearch index '${EMAIL_INDEX}' exists`);
  } catch (err: any) {
    assert(false, 'Elasticsearch operations', err.message);
  }

  console.log('\n======================================================');
  console.log(` VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED `);
  console.log('======================================================\n');

  await prisma.$disconnect();
  await redisClient.quit();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runSprint1Verification();
