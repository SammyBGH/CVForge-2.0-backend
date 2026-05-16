import { Router } from 'express';
import * as dl from '../controllers/download.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/status/:cvId', dl.status);
router.get('/authorize/:cvId', dl.authorize);

export default router;
