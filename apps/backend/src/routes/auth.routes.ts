import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
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

// Demo login for quick testing and local dashboard usage
router.post('/demo-login', async (_req: Request, res: Response) => {
  const user = await prisma.user.findFirst({
    where: { email: 'demo@reachinbox.ai' },
  });

  if (!user) {
    return res.status(404).json({ error: { message: 'Demo user not seeded' } });
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
router.get('/google', (_req: Request, res: Response) => {
  if (!env.GOOGLE_CLIENT_ID) {
    // When Google OAuth credentials are not yet configured in .env, redirect to frontend with demo token
    return res.redirect(`${env.FRONTEND_URL}/login?mockGoogleAuth=true`);
  }
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = {
    redirect_uri: env.GOOGLE_CALLBACK_URL,
    client_id: env.GOOGLE_CLIENT_ID,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
  };
  const qs = new URLSearchParams(options);
  res.redirect(`${rootUrl}?${qs.toString()}`);
});

// Google OAuth callback
router.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;
  if (!code) {
    return res.redirect(`${env.FRONTEND_URL}/login?error=missing_code`);
  }
  try {
    // Exchange code for token (will be connected in Sprint 5)
    res.redirect(`${env.FRONTEND_URL}/dashboard`);
  } catch (err: any) {
    res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(err.message)}`);
  }
});

export default router;
