import { prisma } from '../config/db';
import { CreateCampaignDTO, EmailStatus, CampaignStatus, OutboxStatus } from '@reachinbox/shared';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class CampaignService {
  static async createCampaign(
    userId: string,
    data: CreateCampaignDTO & { idempotencyKey?: string }
  ) {
    // 1. Validate sender ownership
    const sender = await prisma.sender.findFirst({
      where: { id: data.senderId, userId },
    });

    if (!sender) {
      throw new Error('Sender not found or does not belong to the user');
    }

    // 2. Validate and deduplicate recipients
    const validRecipients = Array.from(
      new Set(
        data.recipients
          .map((r) => r.trim().toLowerCase())
          .filter((r) => EMAIL_REGEX.test(r))
      )
    );

    if (validRecipients.length === 0) {
      throw new Error('No valid recipient email addresses provided');
    }

    const startAt = new Date(data.startAt);
    if (isNaN(startAt.getTime())) {
      throw new Error('Invalid startAt timestamp');
    }

    const delayMs = Math.max(0, (data.delaySeconds ?? 2) * 1000);
    const hourlyLimit = data.hourlyLimit || sender.hourlyLimit || 100;

    // 3. Atomically create Campaign, Emails, and Outbox in a single PostgreSQL transaction
    return await prisma.$transaction(async (tx) => {
      // Check idempotency if key provided
      if (data.idempotencyKey) {
        const existingEmail = await tx.email.findFirst({
          where: { idempotencyKey: `${data.idempotencyKey}-1` },
          include: { campaign: true },
        });
        if (existingEmail) {
          return existingEmail.campaign;
        }
      }

      // Create Campaign
      const campaign = await tx.campaign.create({
        data: {
          userId,
          subject: data.subject,
          body: data.body,
          startAt,
          delaySeconds: data.delaySeconds ?? 2,
          hourlyLimit,
          status: CampaignStatus.SCHEDULED,
        },
      });

      // Prepare Email and Outbox entries
      const emailCreateData: any[] = [];
      const outboxCreateData: any[] = [];

      validRecipients.forEach((recipient, index) => {
        // T_i = T_start + ((i - 1) * D)
        const scheduledTime = new Date(startAt.getTime() + index * delayMs);
        const emailId = crypto.randomUUID();
        const idempotencyKey = data.idempotencyKey
          ? `${data.idempotencyKey}-${index + 1}`
          : `${campaign.id}-${recipient}`;

        emailCreateData.push({
          id: emailId,
          campaignId: campaign.id,
          senderId: sender.id,
          userId,
          recipient,
          subject: data.subject,
          body: data.body,
          scheduledAt: scheduledTime,
          status: EmailStatus.SCHEDULED,
          idempotencyKey,
        });

        outboxCreateData.push({
          id: crypto.randomUUID(),
          aggregateType: 'Email',
          aggregateId: emailId,
          eventType: 'EMAIL_SCHEDULED',
          payload: {
            emailId,
            campaignId: campaign.id,
            senderId: sender.id,
            userId,
            scheduledAt: scheduledTime.toISOString(),
          },
          status: OutboxStatus.PENDING,
          availableAt: new Date(),
        });
      });

      // Bulk insert Emails
      await tx.email.createMany({
        data: emailCreateData,
      });

      // Bulk insert Outbox records
      await tx.outbox.createMany({
        data: outboxCreateData,
      });

      return {
        ...campaign,
        recipientCount: validRecipients.length,
        scheduledFirstAt: startAt,
        scheduledLastAt: new Date(startAt.getTime() + (validRecipients.length - 1) * delayMs),
      };
    });
  }

  static async getCampaigns(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [total, campaigns] = await Promise.all([
      prisma.campaign.count({ where: { userId } }),
      prisma.campaign.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              emails: true,
            },
          },
        },
      }),
    ]);

    return {
      campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getCampaignById(campaignId: string, userId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId },
      include: {
        emails: {
          orderBy: { scheduledAt: 'asc' },
          take: 50,
        },
        _count: {
          select: { emails: true },
        },
      },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    return campaign;
  }

  static async cancelCampaign(campaignId: string, userId: string) {
    return await prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.findFirst({
        where: { id: campaignId, userId },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Mark pending/scheduled/deferred emails as cancelled
      const updateResult = await tx.email.updateMany({
        where: {
          campaignId,
          status: { in: [EmailStatus.SCHEDULED, EmailStatus.DEFERRED] },
        },
        data: {
          status: EmailStatus.CANCELLED,
        },
      });

      // Mark campaign cancelled
      await tx.campaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.CANCELLED },
      });

      return {
        success: true,
        cancelledCount: updateResult.count,
      };
    });
  }
}
