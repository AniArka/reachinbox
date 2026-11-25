import { Router, Request, Response } from 'express';
import { WebClient } from '@slack/web-api';
import { requireAuth } from '../middleware/auth';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { encrypt } from '../utils/encryption';
import { SlackNotificationService } from '../integrations/slack/slack.service';

const router = Router();

// 1. Get Slack connection status
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const connection = await SlackNotificationService.getActiveConnection(userId);

  res.json({
    connected: Boolean(connection),
    connection: connection
      ? {
          teamId: connection.teamId,
          teamName: connection.teamName,
          channel: connection.channel,
          connectedAt: connection.connectedAt,
        }
      : null,
  });
});

// 2. Start Slack OAuth
router.get('/connect', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  if (!env.SLACK_CLIENT_ID) {
    // When credentials not set in dev/demo, provision an active demo Slack workspace connection
    await prisma.slackConnection.upsert({
      where: {
        id: `${userId}-reachinbox-demo`,
      },
      create: {
        id: `${userId}-reachinbox-demo`,
        userId,
        teamId: 'T_REACHINBOX_DEMO',
        teamName: 'ReachInbox Demo Workspace (#outbox-alerts)',
        accessToken: encrypt('xoxb-demo-mock-token-reachinbox'),
        scope: 'chat:write,chat:write.public,channels:read',
        active: true,
      },
      update: {
        teamName: 'ReachInbox Demo Workspace (#outbox-alerts)',
        active: true,
      },
    });

    return res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
  }

  const rootUrl = 'https://slack.com/oauth/v2/authorize';
  const options = {
    client_id: env.SLACK_CLIENT_ID,
    scope: 'chat:write,chat:write.public,channels:read',
    redirect_uri: env.SLACK_REDIRECT_URI,
    state: Buffer.from(JSON.stringify({ userId })).toString('base64'),
  };

  const qs = new URLSearchParams(options);
  res.redirect(`${rootUrl}?${qs.toString()}`);
});

// 3. Slack OAuth Callback
router.get('/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  const state = req.query.state as string;

  if (!code) {
    return res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=missing_code`);
  }

  try {
    let userId = '';
    if (state) {
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
      userId = decodedState.userId;
    }

    if (!userId) {
      const demoUser = await prisma.user.findFirst({ where: { email: 'demo@reachinbox.ai' } });
      userId = demoUser?.id || '';
    }

    const client = new WebClient();
    const response = await client.oauth.v2.access({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_REDIRECT_URI,
    });

    if (response.ok && response.access_token) {
      // Upsert SlackConnection
      await prisma.slackConnection.upsert({
        where: {
          id: `${userId}-${response.team?.id}`,
        },
        create: {
          id: `${userId}-${response.team?.id}`,
          userId,
          teamId: response.team?.id || 'unknown',
          teamName: response.team?.name || 'Slack Workspace',
          accessToken: encrypt(response.access_token),
          scope: response.scope || '',
          active: true,
        },
        update: {
          accessToken: encrypt(response.access_token),
          teamName: response.team?.name || 'Slack Workspace',
          scope: response.scope || '',
          active: true,
        },
      });

      return res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
    }

    res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent(response.error || 'auth_failed')}`);
  } catch (error: any) {
    console.error('Slack OAuth exchange error:', error);
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent(error.message)}`);
  }
});

// 4. Disconnect Slack
router.delete('/disconnect', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  await prisma.slackConnection.updateMany({
    where: { userId },
    data: { active: false },
  });

  res.json({ success: true, message: 'Slack disconnected' });
});

// 5. Test Notification trigger (allows user to verify message in their workspace)
router.post('/test', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const sent = await SlackNotificationService.sendNotification(
    userId,
    '🔔 ReachInbox Email Scheduler: Slack notification integration verified successfully!'
  );

  res.json({
    success: sent,
    message: sent ? 'Slack notification sent' : 'Slack not connected or delivery failed',
  });
});

export default router;
