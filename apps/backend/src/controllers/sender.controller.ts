import { Request, Response, NextFunction } from 'express';
import { SenderService } from '../services/sender.service';

export class SenderController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const senders = await SenderService.listSenders(userId);
      res.json({ data: senders });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const sender = await SenderService.createSender(userId, req.body);
      res.status(201).json({ data: sender });
    } catch (error) {
      next(error);
    }
  }
}
