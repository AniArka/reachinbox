import { esClient, EMAIL_INDEX, isElasticsearchAvailable } from '../../config/elasticsearch';
import { prisma } from '../../config/db';

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
    if (!isElasticsearchAvailable()) {
      return;
    }
    try {
      await esClient.index({
        index: EMAIL_INDEX,
        id: doc.emailId,
        document: doc,
      });
    } catch (error) {
      console.warn(`⚠️ Elasticsearch indexing failed for email ${doc.emailId}:`, error);
      // Non-blocking: PostgreSQL is source of truth, search index is eventually consistent
    }
  }

  static async updateStatus(emailId: string, status: string, sentAt?: Date | null): Promise<void> {
    if (!isElasticsearchAvailable()) {
      return;
    }
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
      console.warn(`⚠️ Elasticsearch status update warning for email ${emailId}:`, error);
    }
  }

  /**
   * PostgreSQL-based search method.
   * Serves as the authoritative fallback and zero-cost search engine for free deployment tiers (Render/Supabase).
   */
  static async searchPostgres(
    userId: string,
    options: {
      query?: string;
      status?: string;
      campaignId?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, options.limit || 20);
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (options.status) {
      where.status = options.status;
    }

    if (options.campaignId) {
      where.campaignId = options.campaignId;
    }

    if (options.query && options.query.trim()) {
      const q = options.query.trim();
      where.OR = [
        { recipient: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [total, emails] = await Promise.all([
      prisma.email.count({ where }),
      prisma.email.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'desc' },
        include: {
          sender: { select: { email: true } },
          campaign: { select: { subject: true } },
        },
      }),
    ]);

    return {
      emails: emails.map((email) => ({
        ...email,
        emailId: email.id,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
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
    // Zero-cost deployment path: if Elasticsearch is unavailable/disabled, use PostgreSQL directly
    if (!isElasticsearchAvailable()) {
      return this.searchPostgres(userId, options);
    }

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
    } catch (error: any) {
      console.warn('⚠️ Elasticsearch search failed, falling back to PostgreSQL search:', error?.message || error);
      return this.searchPostgres(userId, options);
    }
  }
}
