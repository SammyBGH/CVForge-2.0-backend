import { Router } from 'express';
import { z } from 'zod';
import { googleLogin, me } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

const googleBody = z.object({
  idToken: z.string().min(10),
});

router.post('/google', validateBody(googleBody), googleLogin);
router.get('/me', requireAuth, me);

export default router;
