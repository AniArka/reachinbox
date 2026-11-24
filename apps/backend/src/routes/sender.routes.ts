import { Router } from 'express';
import { z } from 'zod';
import { SenderController } from '../controllers/sender.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

const createSenderSchema = z.object({
  body: z.object({
    email: z.string().email().optional(),
    etherealUser: z.string().optional(),
    etherealPass: z.string().optional(),
    hourlyLimit: z.number().int().positive().default(100),
    minDelayMs: z.number().int().min(0).default(2000),
    autoProvision: z.boolean().optional(),
  }),
});

const router = Router();

router.get('/', requireAuth, SenderController.list);
router.post('/', requireAuth, validate(createSenderSchema), SenderController.create);

export default router;
