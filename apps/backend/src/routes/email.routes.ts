import { Router } from 'express';
import { EmailController } from '../controllers/email.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/search', requireAuth, EmailController.search);
router.get('/scheduled', requireAuth, EmailController.getScheduled);
router.get('/sent', requireAuth, EmailController.getSent);
router.get('/stats', requireAuth, EmailController.getStats);

export default router;
