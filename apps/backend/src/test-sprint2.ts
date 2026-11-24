import { prisma } from './config/db';
import { app } from './app';
import http from 'http';

async function runSprint2Verification() {
  console.log('\n======================================================');
  console.log('       REACHINBOX SPRINT 2 VERIFICATION SUITE         ');
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
  const PORT = 5098;
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  const baseUrl = `http://localhost:${PORT}/api`;

  try {
    // 1. Auth Endpoint
    console.log('--- 1. Testing Auth & User Endpoints ---');
    const meRes = await fetch(`${baseUrl}/auth/me`);
    const meJson = (await meRes.json()) as any;
    assert(meRes.status === 200 && meJson.user?.email === 'demo@reachinbox.ai', 'GET /api/auth/me returns demo user', meJson.user?.email);

    const loginRes = await fetch(`${baseUrl}/auth/demo-login`, { method: 'POST' });
    const loginJson = (await loginRes.json()) as any;
    assert(loginRes.status === 200 && Boolean(loginJson.token), 'POST /api/auth/demo-login issues JWT token');
    const authToken = `Bearer ${loginJson.token}`;

    // 2. Sender Listing
    console.log('\n--- 2. Testing Sender Endpoints ---');
    const sendersRes = await fetch(`${baseUrl}/senders`, {
      headers: { Authorization: authToken },
    });
    const sendersJson = (await sendersRes.json()) as any;
    assert(
      sendersRes.status === 200 && Array.isArray(sendersJson.data) && sendersJson.data.length >= 1,
      'GET /api/senders returns active senders',
      `Count: ${sendersJson.data?.length}, First: ${sendersJson.data?.[0]?.email}`
    );
    const senderId = sendersJson.data[0].id;

    // 3. Campaign Creation & Scheduling Formula T_i = T_start + ((i-1) * D)
    console.log('\n--- 3. Testing Campaign Creation & Transactional Outbox Persistence ---');
    const startTime = new Date(Date.now() + 60000); // 1 minute in future
    const delaySeconds = 3;
    const recipients = [
      'alice@example.com',
      'bob@example.com',
      'charlie@example.com',
      'david@example.com',
      'eve@example.com',
    ];

    const campaignPayload = {
      subject: 'Sprint 2 Outreach Test',
      body: 'Hello {{name}}, welcome to our platform!',
      senderId,
      recipients,
      startAt: startTime.toISOString(),
      delaySeconds,
      hourlyLimit: 50,
      idempotencyKey: `test-idem-${Date.now()}`,
    };

    const createRes = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authToken,
      },
      body: JSON.stringify(campaignPayload),
    });
    const createJson = (await createRes.json()) as any;
    assert(createRes.status === 201 && Boolean(createJson.data?.id), 'POST /api/campaigns returns 201 Created', `Campaign ID: ${createJson.data?.id}`);
    const campaignId = createJson.data.id;

    // Verify PostgreSQL persistence for Emails and Outbox
    const [dbEmails, dbOutbox] = await Promise.all([
      prisma.email.findMany({
        where: { campaignId },
        orderBy: { scheduledAt: 'asc' },
      }),
      prisma.outbox.findMany({
        where: { aggregateId: { in: createJson.data.emails?.map((e: any) => e.id) || [] } },
      }),
    ]);

    assert(dbEmails.length === 5, 'PostgreSQL contains 5 Email records created in transaction');

    // Verify Interval Formula: T_i = T_start + ((i-1) * 3s)
    let formulaAccurate = true;
    for (let i = 0; i < dbEmails.length; i++) {
      const expectedTimeMs = startTime.getTime() + i * delaySeconds * 1000;
      const actualTimeMs = dbEmails[i].scheduledAt.getTime();
      const diffMs = Math.abs(actualTimeMs - expectedTimeMs);
      if (diffMs > 100) {
        formulaAccurate = false;
        console.error(`Mismatch for recipient ${i}: expected ${expectedTimeMs}, got ${actualTimeMs}`);
      }
    }
    assert(formulaAccurate, 'Formula T_i = T_start + ((i-1) * D) verified with sub-100ms accuracy for all emails');

    // Verify Outbox records count
    const totalOutboxForCampaign = await prisma.outbox.count({
      where: {
        status: 'pending',
      },
    });
    assert(totalOutboxForCampaign >= 5, 'PostgreSQL contains pending Outbox records for async BullMQ publication', `Pending outbox: ${totalOutboxForCampaign}`);

    // 4. Idempotency Test
    console.log('\n--- 4. Testing Idempotency Protection ---');
    const duplicateRes = await fetch(`${baseUrl}/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authToken,
      },
      body: JSON.stringify(campaignPayload),
    });
    const duplicateJson = (await duplicateRes.json()) as any;
    assert(
      duplicateRes.status === 201 && duplicateJson.data?.id === campaignId,
      'Duplicate request with same idempotencyKey returns existing campaign without duplicating emails'
    );

    const emailCountAfterDuplicate = await prisma.email.count({ where: { campaignId } });
    assert(emailCountAfterDuplicate === 5, 'No duplicate email records inserted in PostgreSQL on idempotent resubmission');

    // 5. Scheduled Emails API & Filtering
    console.log('\n--- 5. Testing Scheduled Emails Query & Filtering ---');
    const scheduledRes = await fetch(`${baseUrl}/emails/scheduled?page=1&limit=10`, {
      headers: { Authorization: authToken },
    });
    const scheduledJson = (await scheduledRes.json()) as any;
    assert(
      scheduledRes.status === 200 && scheduledJson.emails.length >= 5,
      'GET /api/emails/scheduled returns scheduled email list with pagination'
    );

    const searchRes = await fetch(`${baseUrl}/emails/scheduled?search=alice`, {
      headers: { Authorization: authToken },
    });
    const searchJson = (await searchRes.json()) as any;
    assert(
      searchRes.status === 200 && searchJson.emails.some((e: any) => e.recipient.includes('alice')),
      'GET /api/emails/scheduled filters by recipient search keyword'
    );

    // 6. Stats API
    console.log('\n--- 6. Testing Dashboard Stats API ---');
    const statsRes = await fetch(`${baseUrl}/emails/stats`, {
      headers: { Authorization: authToken },
    });
    const statsJson = (await statsRes.json()) as any;
    assert(
      statsRes.status === 200 && statsJson.data?.scheduled >= 5 && statsJson.data?.campaigns >= 1,
      'GET /api/emails/stats returns correct aggregate counts',
      `Scheduled: ${statsJson.data?.scheduled}, Campaigns: ${statsJson.data?.campaigns}`
    );

    // 7. Campaign Cancellation
    console.log('\n--- 7. Testing Campaign Cancellation ---');
    const cancelRes = await fetch(`${baseUrl}/campaigns/${campaignId}/cancel`, {
      method: 'POST',
      headers: { Authorization: authToken },
    });
    const cancelJson = (await cancelRes.json()) as any;
    assert(cancelRes.status === 200 && cancelJson.data?.cancelledCount === 5, 'POST /api/campaigns/:id/cancel cancels 5 pending emails');

    const cancelledEmails = await prisma.email.findMany({
      where: { campaignId, status: 'cancelled' },
    });
    assert(cancelledEmails.length === 5, 'All email statuses updated to "cancelled" in PostgreSQL');

  } catch (err: any) {
    console.error('Test Suite Exception:', err);
    failed++;
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
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

runSprint2Verification();
