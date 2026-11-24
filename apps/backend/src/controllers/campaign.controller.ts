import { Request, Response, NextFunction } from 'express';
import { CampaignService } from '../services/campaign.service';

export class CampaignController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const idempotencyKey = (req.headers['x-idempotency-key'] as string) || req.body.idempotencyKey;
      const result = await CampaignService.createCampaign(userId, {
        ...req.body,
        idempotencyKey,
      });
      res.status(201).json({ data: result });
    } catch (error: any) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const result = await CampaignService.getCampaigns(userId, page, limit);
      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const campaignId = req.params.id;
      const result = await CampaignService.getCampaignById(campaignId, userId);
      res.json({ data: result });
    } catch (error: any) {
      next(error);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const campaignId = req.params.id;
      const result = await CampaignService.cancelCampaign(campaignId, userId);
      res.json({ data: result });
    } catch (error: any) {
      next(error);
    }
  }
}
