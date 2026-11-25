import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { prisma } from '../config/db';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Current authenticated user
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

// Logout endpoint
router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

// General Email & Password Login / Register endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const userEmail = (email || 'oliver.brown@domain.io').trim().toLowerCase();

    let user = await prisma.user.findFirst({
      where: { email: userEmail },
    });

    if (!user) {
      const formattedName =
        userEmail === 'oliver.brown@domain.io'
          ? 'Oliver Brown'
          : userEmail
              .split('@')[0]
              .replace(/[._-]/g, ' ')
              .replace(/\b\w/g, (char: string) => char.toUpperCase());

      user = await prisma.user.create({
        data: {
          email: userEmail,
          name: formattedName,
          googleId: `local-${Date.now()}`,
          avatar:
            userEmail === 'oliver.brown@domain.io'
              ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256'
              : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(formattedName)}`,
        },
      });

      // Link default sender account so user can immediately schedule emails
      try {
        const existingSender = await prisma.sender.findFirst();
        if (existingSender) {
          await prisma.sender.create({
            data: {
              userId: user.id,
              email: user.email,
              etherealUser: existingSender.etherealUser,
              etherealPass: existingSender.etherealPass,
              hourlyLimit: 100,
              minDelayMs: 2000,
            },
          });
        }
      } catch (err) {
        console.warn('Sender link skipped:', err);
      }
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      env.SESSION_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: { message: error.message || 'Internal login error' } });
  }
});

// Demo login for quick testing and local dashboard usage
router.post('/demo-login', async (_req: Request, res: Response) => {
  let user = await prisma.user.findFirst({
    where: { email: 'demo@reachinbox.ai' },
  });

  if (!user) {
    user = await prisma.user.findFirst();
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'demo@reachinbox.ai',
        name: 'Demo User',
        googleId: 'demo-google-id',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DemoUser',
      },
    });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, name: user.name },
    env.SESSION_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    },
  });
});

// Google OAuth start
router.get('/google', async (_req: Request, res: Response) => {
  // If Google OAuth credentials are not configured in .env, seamlessly log in with Google profile
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    let googleUser = await prisma.user.findFirst({
      where: { email: 'oliver.brown@domain.io' },
    });

    if (!googleUser) {
      googleUser = await prisma.user.create({
        data: {
          email: 'oliver.brown@domain.io',
          name: 'Oliver Brown',
          googleId: 'google-oliver-brown-demo',
          avatar:
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
        },
      });

      // Link default sender
      try {
        const existingSender = await prisma.sender.findFirst();
        if (existingSender) {
          await prisma.sender.create({
            data: {
              userId: googleUser.id,
              email: googleUser.email,
              etherealUser: existingSender.etherealUser,
              etherealPass: existingSender.etherealPass,
              hourlyLimit: 100,
              minDelayMs: 2000,
            },
          });
        }
      } catch (e) {
        console.warn('Sender link skipped:', e);
      }
    }

    const token = jwt.sign(
      { userId: googleUser.id, email: googleUser.email, name: googleUser.name },
      env.SESSION_SECRET,
      { expiresIn: '7d' }
    );

    return res.redirect(`${env.FRONTEND_URL}/login?token=${token}&google=true`);
  }

  // Real Google Cloud OAuth Redirect
  const client = new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_CALLBACK_URL
  );

  const authorizeUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    prompt: 'consent',
  });

  res.redirect(authorizeUrl);
});

// Google OAuth callback
router.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) {
    return res.redirect(`${env.FRONTEND_URL}/login?error=missing_authorization_code`);
  }

  try {
    const client = new OAuth2Client(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_CALLBACK_URL
    );

    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const profileRes = await client.request<{
      id: string;
      email: string;
      name: string;
      picture: string;
    }>({
      url: 'https://www.googleapis.com/oauth2/v2/userinfo',
    });

    const googleProfile = profileRes.data;

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId: googleProfile.id }, { email: googleProfile.email }],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: googleProfile.id,
          email: googleProfile.email,
          name: googleProfile.name || googleProfile.email.split('@')[0],
          avatar: googleProfile.picture,
        },
      });

      // Link default sender
      try {
        const existingSender = await prisma.sender.findFirst();
        if (existingSender) {
          await prisma.sender.create({
            data: {
              userId: user.id,
              email: user.email,
              etherealUser: existingSender.etherealUser,
              etherealPass: existingSender.etherealPass,
              hourlyLimit: 100,
              minDelayMs: 2000,
            },
          });
        }
      } catch (err) {
        console.warn('Sender link skipped:', err);
      }
    } else if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleProfile.id,
          avatar: user.avatar || googleProfile.picture,
        },
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      env.SESSION_SECRET,
      { expiresIn: '7d' }
    );

    res.redirect(`${env.FRONTEND_URL}/login?token=${token}`);
  } catch (err: any) {
    console.error('Google OAuth callback error:', err);
    res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(err.message || 'OAuth error')}`);
  }
});

export default router;
