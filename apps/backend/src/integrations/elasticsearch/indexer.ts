import { esClient, EMAIL_INDEX } from '../../config/elasticsearch';

export interface EmailIndexDocument {
  emailId: string;
  campaignId: string;
  senderId: string;
  userId: string;
  recipient: string;
  subject: string;
  body?: string;
  status: string;
  scheduledAt: string;
  sentAt?: string | null;
  createdAt: string;
}

export class EmailIndexer {
  static async indexEmail(doc: EmailIndexDocument): Promise<void> {
    try {
      await esClient.index({
        index: EMAIL_INDEX,
        id: doc.emailId,
        document: doc,
      });
    } catch (error) {
      console.error(`⚠️ Elasticsearch indexing failed for email ${doc.emailId}:`, error);
      // Non-blocking: PostgreSQL is source of truth, search index is eventually consistent
    }
  }

  static async updateStatus(emailId: string, status: string, sentAt?: Date | null): Promise<void> {
    try {
      await esClient.update({
        index: EMAIL_INDEX,
        id: emailId,
        doc: {
          status,
          ...(sentAt ? { sentAt: sentAt.toISOString() } : {}),
        },
      });
    } catch (error) {
      // If doc doesn't exist yet, we will index on next sync
      console.warn(`⚠️ Elasticsearch status update warning for email ${emailId}:`, error);
    }
  }

  static async searchEmails(
    userId: string,
    options: {
      query?: string;
      status?: string;
      campaignId?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const from = (page - 1) * limit;

    const must: any[] = [{ term: { userId } }];

    if (options.status) {
      must.push({ term: { status: options.status } });
    }

    if (options.campaignId) {
      must.push({ term: { campaignId: options.campaignId } });
    }

    if (options.query) {
      must.push({
        multi_match: {
          query: options.query,
          fields: ['recipient^3', 'subject^2', 'body'],
          fuzziness: 'AUTO',
        },
      });
    }

    try {
      const response = await esClient.search({
        index: EMAIL_INDEX,
        from,
        size: limit,
        query: {
          bool: { must },
        },
        sort: [{ scheduledAt: { order: 'desc' } }],
      });

      const totalHits =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : response.hits.total?.value || 0;

      const emails = response.hits.hits.map((hit) => ({
        ...(hit._source as any),
        id: hit._id,
      }));

      return {
        emails,
        pagination: {
          page,
          limit,
          total: totalHits,
          totalPages: Math.ceil(totalHits / limit),
        },
      };
    } catch (error) {
      console.error('❌ Elasticsearch search failed:', error);
      throw error;
    }
  }
}
