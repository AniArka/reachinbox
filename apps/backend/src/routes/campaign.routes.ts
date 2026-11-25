import { Router } from 'express';
import { z } from 'zod';
import { CampaignController } from '../controllers/campaign.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

const createCampaignSchema = z.object({
  body: z.object({
    subject: z.string().min(1, 'Subject is required').max(500),
    body: z.string().min(1, 'Email body is required'),
    senderId: z.string().min(1, 'Sender ID is required'),
    recipients: z.array(z.string().email('Invalid email address')).min(1, 'At least one recipient is required'),
    startAt: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid startAt datetime format' }),
    delaySeconds: z.coerce.number().int().min(0).default(2),
    hourlyLimit: z.coerce.number().int().positive().optional(),
    idempotencyKey: z.string().optional(),
  }),
});

const router = Router();

router.post('/', requireAuth, validate(createCampaignSchema), CampaignController.create);
router.get('/', requireAuth, CampaignController.list);
router.get('/:id', requireAuth, CampaignController.getById);
router.post('/:id/cancel', requireAuth, CampaignController.cancel);

export default router;
