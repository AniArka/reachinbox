import { Request, Response, NextFunction } from 'express';
import { EmailService } from '../services/email.service';

export class EmailController {
  static async getScheduled(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const search = req.query.search as string;
      const senderId = req.query.senderId as string;

      const result = await EmailService.getScheduledEmails(userId, {
        page,
        limit,
        search,
        senderId,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getSent(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const search = req.query.search as string;
      const status = req.query.status as string;

      const result = await EmailService.getSentEmails(userId, {
        page,
        limit,
        search,
        status,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  static async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const stats = await EmailService.getStats(userId);
      res.json({ data: stats });
    } catch (error) {
      next(error);
    }
  }
}
