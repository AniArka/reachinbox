import { Client } from '@elastic/elasticsearch';
import { env } from './env';

export const esClient = new Client({
  node: env.ELASTICSEARCH_URL,
});

export const EMAIL_INDEX = 'emails-index';

let isEsAvailable = false;

export function isElasticsearchAvailable(): boolean {
  return isEsAvailable;
}

export async function initElasticsearch(): Promise<void> {
  if (!env.ENABLE_ELASTICSEARCH) {
    console.log('ℹ️ Elasticsearch is disabled (ENABLE_ELASTICSEARCH=false). Search will use PostgreSQL.');
    isEsAvailable = false;
    return;
  }

  try {
    const exists = await esClient.indices.exists({ index: EMAIL_INDEX });
    if (!exists) {
      await esClient.indices.create({
        index: EMAIL_INDEX,
        body: {
          mappings: {
            properties: {
              emailId: { type: 'keyword' },
              campaignId: { type: 'keyword' },
              senderId: { type: 'keyword' },
              userId: { type: 'keyword' },
              recipient: {
                type: 'text',
                fields: {
                  keyword: { type: 'keyword' }
                }
              },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              createdAt: { type: 'date' }
            }
          }
        }
      });
      console.log(`✅ Elasticsearch index '${EMAIL_INDEX}' created successfully`);
    } else {
      console.log(`✅ Elasticsearch index '${EMAIL_INDEX}' already exists`);
    }
    isEsAvailable = true;
  } catch (error: any) {
    isEsAvailable = false;
    console.warn('⚠️ Elasticsearch init warning (falling back to PostgreSQL search):', error?.message || error);
  }
}
