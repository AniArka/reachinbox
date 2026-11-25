import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { prisma } from '../config/db';
import { requireAuth } from '../middleware/auth';

const router = Router();

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) {
    // Default fallback password for pre-seeded users
    return password === 'password123';
  }
  if (storedHash.includes(':')) {
    const [salt, key] = storedHash.split(':');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return key === hash;
  }
  return storedHash === password;
}

// Current authenticated user
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

// Logout endpoint
router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

// Email & Password Login with strict user check and password verification
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: { message: 'Email address is required.' } });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: { message: 'Password is required.' } });
    }

    const userEmail = email.trim().toLowerCase();

    // 1. Check if user exists in database
    let user = await prisma.user.findFirst({
      where: { email: userEmail },
    });

    if (!user) {
      if (userEmail === 'oliver.brown@domain.io' || userEmail === 'demo@reachinbox.ai') {
        user = await prisma.user.create({
          data: {
            email: userEmail,
            name: userEmail === 'oliver.brown@domain.io' ? 'Oliver Brown' : 'Demo User',
            password: hashPassword('password123'),
            avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
          },
        });

        try {
          await prisma.sender.create({
            data: {
              userId: user.id,
              email: user.email,
              hourlyLimit: 100,
              minDelayMs: 2000,
            },
          });
        } catch (err) {
          console.warn('Auto-provision sender skipped:', err);
        }
      } else {
        return res.status(401).json({
          error: {
            message: `User '${userEmail}' does not exist. Please check your email or contact your administrator.`,
          },
        });
      }
    }

    // 2. Verify password against stored hash or default password123
    const isPasswordCorrect = verifyPassword(password, (user as any).password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        error: {
          message: 'Incorrect password. Please verify your credentials and try again.',
        },
      });
    }

    // 3. Persist password hash if not yet set
    if (!(user as any).password) {
      try {
        await prisma.$executeRaw`UPDATE users SET password = ${hashPassword(password)} WHERE id = ${user.id}`;
      } catch (err) {
        console.warn('Could not persist password hash:', err);
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

// Demo login for automated test runner
router.post('/demo-login', async (_req: Request, res: Response) => {
  let user = await prisma.user.findFirst({
    where: { email: 'oliver.brown@domain.io' },
  });

  if (!user) {
    user = await prisma.user.findFirst({
      where: { email: 'demo@reachinbox.ai' },
    });
  }

  if (!user) {
    user = await prisma.user.findFirst();
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'oliver.brown@domain.io',
        name: 'Oliver Brown',
        googleId: 'demo-oliver-brown',
        avatar:
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256',
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
  // If Google OAuth credentials are not configured in .env, redirect back with explicit error
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    const errorMsg =
      'Google OAuth credentials not configured in .env. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable Google Sign-In.';
    return res.redirect(`${env.FRONTEND_URL}/?error=${encodeURIComponent(errorMsg)}`);
  }

  // Real Google Cloud OAuth Redirect
  try {
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
  } catch (err: any) {
    console.error('Google OAuth init error:', err);
    res.redirect(
      `${env.FRONTEND_URL}/?error=${encodeURIComponent(err.message || 'Failed to start Google OAuth')}`
    );
  }
});

// Google OAuth callback
router.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) {
    return res.redirect(`${env.FRONTEND_URL}/?error=missing_authorization_code`);
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

    res.redirect(`${env.FRONTEND_URL}/?token=${token}`);
  } catch (err: any) {
    console.error('Google OAuth callback error:', err);
    res.redirect(`${env.FRONTEND_URL}/?error=${encodeURIComponent(err.message || 'OAuth error')}`);
  }
});

export default router;
