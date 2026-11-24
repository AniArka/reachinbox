import { app } from './app';
import { env } from './config/env';
import { initElasticsearch } from './config/elasticsearch';

async function bootstrap() {
  try {
    console.log('🚀 Initializing ReachInbox Backend...');

    // Initialize Elasticsearch index
    await initElasticsearch();

    const server = app.listen(env.PORT, () => {
      console.log(`🌐 Server running at http://localhost:${env.PORT}`);
      console.log(`📊 Health check available at http://localhost:${env.PORT}/health`);
      console.log(`🔍 Detailed health check at http://localhost:${env.PORT}/health/detailed`);
    });

    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}, closing server gracefully...`);
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
