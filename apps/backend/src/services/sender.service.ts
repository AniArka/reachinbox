import { prisma } from '../config/db';
import { getOrCreateEtherealAccount } from '../integrations/smtp/ethereal';
import { encrypt } from '../utils/encryption';

export class SenderService {
  static async listSenders(userId: string) {
    return prisma.sender.findMany({
      where: { userId },
      select: {
        id: true,
        email: true,
        etherealUser: true,
        hourlyLimit: true,
        minDelayMs: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async createSender(
    userId: string,
    data: {
      email?: string;
      etherealUser?: string;
      etherealPass?: string;
      hourlyLimit?: number;
      minDelayMs?: number;
      autoProvision?: boolean;
    }
  ) {
    let email = data.email;
    let etherealUser = data.etherealUser;
    let etherealPass = data.etherealPass;

    if (data.autoProvision || (!etherealUser && !etherealPass)) {
      const creds = await getOrCreateEtherealAccount();
      email = creds.user;
      etherealUser = creds.user;
      etherealPass = creds.pass;
    }

    if (!email || !etherealUser || !etherealPass) {
      throw new Error('Missing sender or Ethereal credentials');
    }

    return prisma.sender.create({
      data: {
        userId,
        email,
        etherealUser,
        etherealPass: encrypt(etherealPass),
        hourlyLimit: data.hourlyLimit ?? 100,
        minDelayMs: data.minDelayMs ?? 2000,
      },
      select: {
        id: true,
        email: true,
        etherealUser: true,
        hourlyLimit: true,
        minDelayMs: true,
        createdAt: true,
      },
    });
  }
}
