import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { prisma } from './config/db';
import { redisClient } from './config/redis';
import { esClient, EMAIL_INDEX } from './config/elasticsearch';

export const app = express();

app.use(helmet({
  contentSecurityPolicy: false, // Allows Bull Board and dev tools
}));

app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Basic health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'reachinbox-backend',
  });
});

// Detailed system health check for all infrastructure components
app.get('/health/detailed', async (_req: Request, res: Response) => {
  const health: Record<string, { status: string; latencyMs?: number; error?: string }> = {};
  let overallHealthy = true;

  // 1. PostgreSQL check
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.database = { status: 'healthy', latencyMs: Date.now() - dbStart };
  } catch (err: any) {
    overallHealthy = false;
    health.database = { status: 'unhealthy', error: err.message };
  }

  // 2. Redis check
  const redisStart = Date.now();
  try {
    const ping = await redisClient.ping();
    health.redis = {
      status: ping === 'PONG' ? 'healthy' : 'unhealthy',
      latencyMs: Date.now() - redisStart,
    };
  } catch (err: any) {
    overallHealthy = false;
    health.redis = { status: 'unhealthy', error: err.message };
  }

  // 3. Elasticsearch check
  const esStart = Date.now();
  try {
    const esPing = await esClient.ping();
    health.elasticsearch = {
      status: esPing ? 'healthy' : 'unhealthy',
      latencyMs: Date.now() - esStart,
    };
  } catch (err: any) {
    // Elasticsearch is derived index, mark degraded if down
    health.elasticsearch = { status: 'degraded', error: err.message };
  }

  const statusCode = overallHealthy ? 200 : 503;
  res.status(statusCode).json({
    status: overallHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: health,
  });
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API Error:', err);
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
    },
  });
});
