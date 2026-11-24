import { WebClient } from '@slack/web-api';
import { prisma } from '../../config/db';
import { redisClient } from '../../config/redis';
import { decrypt } from '../../utils/encryption';
import { env } from '../../config/env';

export class SlackNotificationService {
  static async getActiveConnection(userId: string) {
    return prisma.slackConnection.findFirst({
      where: { userId, active: true },
      orderBy: { connectedAt: 'desc' },
    });
  }

  static async sendNotification(
    userId: string,
    message: string,
    blocks?: any[]
  ): Promise<boolean> {
    try {
      const connection = await this.getActiveConnection(userId);
      if (!connection) {
        // Safe skip if Slack is not connected
        return false;
      }

      const accessToken = decrypt(connection.accessToken);
      const client = new WebClient(accessToken);

      // Post to default incoming webhook or channel
      const channel = connection.channel || '#general';
      await client.chat.postMessage({
        channel,
        text: message,
        blocks: blocks || [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: message },
          },
        ],
      });

      console.log(`💬 [Slack] Notification sent successfully to channel: ${channel}`);
      return true;
    } catch (error: any) {
      console.error('⚠️ [Slack] Failed to send Slack message (non-blocking):', error.message);
      return false;
    }
  }

  static async notifyRateLimitReached(
    userId: string,
    senderEmail: string,
    senderId: string,
    hourlyLimit: number,
    windowKey: string,
    nextWindowDate: Date
  ): Promise<boolean> {
    // 1. Deduplication check in Redis to avoid spamming the channel repeatedly in the same window
    const dedupeKey = `slack:alert-sent:${senderId}:${windowKey}`;
    const alreadySent = await redisClient.get(dedupeKey);
    if (alreadySent) {
      return false;
    }

    // Set dedupe flag for remaining window duration
    await redisClient.set(dedupeKey, '1', 'EX', 3600);

    // 2. Count deferred emails for this sender
    const deferredCount = await prisma.email.count({
      where: {
        senderId,
        status: 'deferred',
      },
    });

    const formattedTime = nextWindowDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 ReachInbox Alert: Rate Limit Exceeded',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Sender:*\n\`${senderEmail}\`` },
          { type: 'mrkdwn', text: `*Hourly Limit:*\n${hourlyLimit} emails` },
          { type: 'mrkdwn', text: `*Emails Deferred:*\n${deferredCount} pending` },
          { type: 'mrkdwn', text: `*Next Sending Window:*\n${formattedTime}` },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: '⚡ BullMQ will automatically resume deferred jobs when the window resets. No manual intervention required.',
          },
        ],
      },
    ];

    const fallbackText = `🚨 ReachInbox: Rate limit reached for ${senderEmail} (${hourlyLimit}/hr). ${deferredCount} emails deferred until ${formattedTime}.`;

    return this.sendNotification(userId, fallbackText, blocks);
  }
}
