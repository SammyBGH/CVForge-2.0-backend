import { Router } from 'express';
import { z } from 'zod';
import { googleLogin, login, register, devLogin, me } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

const googleBody = z.object({
  idToken: z.string().min(10),
});

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().optional(),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});

const devLoginBody = z.object({
  email: z.string().email().optional(),
}).optional();

router.post('/google', validateBody(googleBody), googleLogin);
router.post('/register', validateBody(registerBody), register);
router.post('/login', validateBody(loginBody), login);
router.post('/dev-login', validateBody(devLoginBody), devLogin);
router.get('/me', requireAuth, me);

export default router;
