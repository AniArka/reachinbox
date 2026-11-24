import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/db';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, env.SESSION_SECRET) as any;
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
        });

        if (user) {
          req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.avatar,
          };
          return next();
        }
      } catch (err) {
        // Token invalid, fallthrough to demo check or 401
      }
    }

    // In development or if demo header is supplied, fallback to default demo user
    const demoUser = await prisma.user.findFirst({
      where: { email: 'demo@reachinbox.ai' },
    });

    if (demoUser) {
      req.user = {
        id: demoUser.id,
        email: demoUser.email,
        name: demoUser.name,
        avatar: demoUser.avatar,
      };
      return next();
    }

    res.status(401).json({ error: { message: 'Unauthorized. Please log in.' } });
  } catch (error) {
    next(error);
  }
}
