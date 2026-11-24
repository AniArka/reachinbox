import { app } from './app';
import { env } from './config/env';
import { initElasticsearch } from './config/elasticsearch';
import { emailWorker } from './workers/email.worker';
import { outboxDispatcher } from './schedulers/outbox.dispatcher';

async function bootstrap() {
  try {
    console.log('🚀 Initializing ReachInbox Backend...');

    // 1. Initialize Elasticsearch index
    await initElasticsearch();

    // 2. Start Email Queue Worker
    emailWorker.start();

    // 3. Start Transactional Outbox Dispatcher
    await outboxDispatcher.start();

    // 4. Start HTTP Server
    const server = app.listen(env.PORT, () => {
      console.log(`🌐 Server running at http://localhost:${env.PORT}`);
      console.log(`📊 Health check available at http://localhost:${env.PORT}/health`);
      console.log(`🔍 Detailed health check at http://localhost:${env.PORT}/health/detailed`);
    });

    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, closing server gracefully...`);
      outboxDispatcher.stop();
      await emailWorker.stop();
      server.close(async () => {
        console.log('💤 HTTP server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('💥 Fatal error starting server:', error);
    process.exit(1);
  }
}

bootstrap();
