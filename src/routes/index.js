import { Router } from 'express';
import authRoutes from './auth.routes.js';
import cvRoutes from './cv.routes.js';
import paymentRoutes from './payment.routes.js';
import downloadRoutes from './download.routes.js';
import templateRoutes from './template.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/cvs', cvRoutes);
router.use('/payments', paymentRoutes);
router.use('/downloads', downloadRoutes);
router.use('/templates', templateRoutes);

router.get('/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

export default router;
