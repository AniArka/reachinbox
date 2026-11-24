import { prisma } from './config/db';
import { redisClient } from './config/redis';
import { esClient, initElasticsearch } from './config/elasticsearch';

async function testInfra() {
  console.log('--- Testing ReachInbox Infrastructure Connectivity ---');

  // 1. PostgreSQL
  try {
    const userCount = await prisma.user.count();
    console.log('✅ PostgreSQL connected! Total users in DB:', userCount);
  } catch (err) {
    console.error('❌ PostgreSQL failed:', err);
  }

  // 2. Redis
  try {
    const ping = await redisClient.ping();
    console.log('✅ Redis connected! PING response:', ping);
  } catch (err) {
    console.error('❌ Redis failed:', err);
  }

  // 3. Elasticsearch
  try {
    await initElasticsearch();
    const esPing = await esClient.ping();
    console.log('✅ Elasticsearch connected! PING response:', esPing);
  } catch (err) {
    console.error('❌ Elasticsearch failed:', err);
  }

  await prisma.$disconnect();
  await redisClient.quit();
  process.exit(0);
}

testInfra();
