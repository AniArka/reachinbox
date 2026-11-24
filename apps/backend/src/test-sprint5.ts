import { app } from './app';
import { esClient, EMAIL_INDEX } from './config/elasticsearch';
import { EmailIndexer } from './integrations/elasticsearch/indexer';
import { prisma } from './config/db';
import http from 'http';
import fs from 'fs';
import path from 'path';

async function runSprint5Verification() {
  console.log('\n======================================================');
  console.log('       REACHINBOX SPRINT 5 VERIFICATION SUITE         ');
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
  const PORT = 5096;
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  const baseUrl = `http://localhost:${PORT}/api`;

  try {
    const user = await prisma.user.findFirst({ where: { email: 'demo@reachinbox.ai' } });
    assert(Boolean(user), 'Authenticated user verified for search context', user?.email);

    // 1. Seed Elasticsearch with test documents
    console.log('--- 1. Indexing Documents into Elasticsearch ---');
    const testDoc1 = {
      emailId: 'es-test-1',
      campaignId: 'camp-1',
      senderId: 'sender-1',
      userId: user!.id,
      recipient: 'steve.jobs@apple.design',
      subject: 'Revolutionary New Product Announcement',
      body: 'Here is to the crazy ones, the misfits, the rebels.',
      status: 'sent',
      scheduledAt: new Date(Date.now() - 3600000).toISOString(),
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const testDoc2 = {
      emailId: 'es-test-2',
      campaignId: 'camp-2',
      senderId: 'sender-1',
      userId: user!.id,
      recipient: 'bill.gates@microsoft.corp',
      subject: 'Quarterly Cloud Computing Partnership',
      body: 'Software is a great combination between artistry and engineering.',
      status: 'scheduled',
      scheduledAt: new Date(Date.now() + 3600000).toISOString(),
      sentAt: null,
      createdAt: new Date().toISOString(),
    };

    await EmailIndexer.indexEmail(testDoc1);
    await EmailIndexer.indexEmail(testDoc2);

    // Force refresh Elasticsearch index for immediate searchability
    await esClient.indices.refresh({ index: EMAIL_INDEX });

    // 2. Search by Recipient
    console.log('\n--- 2. Testing Elasticsearch Full-Text Search API ---');
    const recipientRes = await fetch(`${baseUrl}/emails/search?q=apple.design`);
    const recipientJson = (await recipientRes.json()) as any;
    assert(
      recipientRes.status === 200 &&
        recipientJson.emails.some((e: any) => e.recipient === 'steve.jobs@apple.design'),
      'Search by recipient domain returns matching document',
      `Found: ${recipientJson.emails.length}`
    );

    // 3. Search by Subject
    const subjectRes = await fetch(`${baseUrl}/emails/search?q=Cloud Computing`);
    const subjectJson = (await subjectRes.json()) as any;
    assert(
      subjectRes.status === 200 &&
        subjectJson.emails.some((e: any) => e.subject.includes('Cloud Computing')),
      'Search by subject keyword returns matching document'
    );

    // 4. Search with Status Filter
    const statusRes = await fetch(`${baseUrl}/emails/search?status=sent`);
    const statusJson = (await statusRes.json()) as any;
    assert(
      statusRes.status === 200 &&
        statusJson.emails.every((e: any) => e.status === 'sent'),
      'Search filtered by status="sent" returns only delivered emails'
    );

    // 5. Verify Frontend Production Assets
    console.log('\n--- 3. Verifying React Frontend Production Build ---');
    const distHtml = path.resolve(__dirname, '../../frontend/dist/index.html');
    assert(fs.existsSync(distHtml), 'Frontend production index.html built successfully');

    const distAssets = path.resolve(__dirname, '../../frontend/dist/assets');
    const assetFiles = fs.readdirSync(distAssets);
    const hasJs = assetFiles.some((f) => f.endsWith('.js'));
    const hasCss = assetFiles.some((f) => f.endsWith('.css'));
    assert(hasJs && hasCss, 'Frontend CSS and JavaScript bundle chunks verified', `Assets: ${assetFiles.join(', ')}`);

  } catch (err: any) {
    console.error('Sprint 5 Test Suite Exception:', err);
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

runSprint5Verification();
