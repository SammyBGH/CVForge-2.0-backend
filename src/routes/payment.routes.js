import { Router } from 'express';
import { z } from 'zod';
import * as payment from '../controllers/payment.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';

const router = Router();

const initBody = z.object({
  cvId: z.string(),
  kind: z.enum(['download', 'translation']),
  targetLanguage: z.string().optional(),
  email: z.string().email().optional(),
});

router.get('/config', payment.getPublicConfig);

router.post('/initialize', requireAuth, validateBody(initBody), payment.initializePayment);

const verifyQuery = z.object({
  reference: z.string(),
});

router.get('/verify', requireAuth, validateQuery(verifyQuery), payment.verifyPayment);

router.post('/webhook', payment.paystackWebhook);

export default router;
