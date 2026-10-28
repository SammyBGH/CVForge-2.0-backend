import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './auth.routes.js';
import cvRoutes from './cv.routes.js';
import paymentRoutes from './payment.routes.js';
import downloadRoutes from './download.routes.js';
import templateRoutes from './template.routes.js';

const router = Router();

/**
 * Middleware that returns a clear error if the database isn't connected,
 * instead of letting requests hang until a Mongoose timeout.
 */
function requireDb(req, res, next) {
  if (mongoose.connection.readyState === 1) return next();
  return res.status(503).json({
    error: 'Database is currently unavailable. If you are running locally, check your MongoDB Atlas IP whitelist or internet connection.',
  });
}

router.use('/auth', authRoutes);
router.use('/cvs', requireDb, cvRoutes);
router.use('/payments', requireDb, paymentRoutes);
router.use('/downloads', requireDb, downloadRoutes);
router.use('/templates', templateRoutes);

router.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.json({ ok: dbState === 1, db: dbStatus[dbState] || 'unknown', ts: new Date().toISOString() });
});

export default router;
