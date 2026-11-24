import { prisma } from '../config/db';
import { EmailStatus } from '@reachinbox/shared';

export class EmailService {
  static async getScheduledEmails(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      senderId?: string;
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      userId,
      status: { in: [EmailStatus.SCHEDULED, EmailStatus.DEFERRED, EmailStatus.PROCESSING] },
    };

    if (options.senderId) {
      where.senderId = options.senderId;
    }

    if (options.search) {
      where.OR = [
        { recipient: { contains: options.search, mode: 'insensitive' } },
        { subject: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [total, emails] = await Promise.all([
      prisma.email.count({ where }),
      prisma.email.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'asc' },
        include: {
          sender: { select: { email: true } },
          campaign: { select: { subject: true } },
        },
      }),
    ]);

    return {
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getSentEmails(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      status?: string;
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const allowedStatuses = options.status
      ? [options.status]
      : [EmailStatus.SENT, EmailStatus.FAILED, EmailStatus.CANCELLED];

    const where: any = {
      userId,
      status: { in: allowedStatuses },
    };

    if (options.search) {
      where.OR = [
        { recipient: { contains: options.search, mode: 'insensitive' } },
        { subject: { contains: options.search, mode: 'insensitive' } },
      ];
    }

    const [total, emails] = await Promise.all([
      prisma.email.count({ where }),
      prisma.email.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sentAt: 'desc' },
        include: {
          sender: { select: { email: true } },
          campaign: { select: { subject: true } },
        },
      }),
    ]);

    return {
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getStats(userId: string) {
    const [scheduled, sent, failed, deferred, campaigns] = await Promise.all([
      prisma.email.count({
        where: { userId, status: { in: [EmailStatus.SCHEDULED, EmailStatus.PROCESSING] } },
      }),
      prisma.email.count({
        where: { userId, status: EmailStatus.SENT },
      }),
      prisma.email.count({
        where: { userId, status: EmailStatus.FAILED },
      }),
      prisma.email.count({
        where: { userId, status: EmailStatus.DEFERRED },
      }),
      prisma.campaign.count({
        where: { userId },
      }),
    ]);

    return {
      scheduled,
      sent,
      failed,
      deferred,
      totalEmails: scheduled + sent + failed + deferred,
      campaigns,
    };
  }
}
