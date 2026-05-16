import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export async function connectDb() {
  if (!env.MONGODB_URI) {
    logger.warn('MONGODB_URI not set — database operations will fail until configured.');
    return;
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI);
  logger.info('MongoDB connected');
}
