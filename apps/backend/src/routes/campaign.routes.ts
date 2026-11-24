import { Router } from 'express';
import { z } from 'zod';
import { CampaignController } from '../controllers/campaign.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

const createCampaignSchema = z.object({
  body: z.object({
    subject: z.string().min(1, 'Subject is required').max(500),
    body: z.string().min(1, 'Email body is required'),
    senderId: z.string().uuid('Invalid sender UUID'),
    recipients: z.array(z.string().email('Invalid email address')).min(1, 'At least one recipient is required'),
    startAt: z.string().datetime({ message: 'startAt must be a valid ISO 8601 datetime' }),
    delaySeconds: z.number().int().min(0).default(2),
    hourlyLimit: z.number().int().positive().optional(),
    idempotencyKey: z.string().optional(),
  }),
});

const router = Router();

router.post('/', requireAuth, validate(createCampaignSchema), CampaignController.create);
router.get('/', requireAuth, CampaignController.list);
router.get('/:id', requireAuth, CampaignController.getById);
router.post('/:id/cancel', requireAuth, CampaignController.cancel);

export default router;
