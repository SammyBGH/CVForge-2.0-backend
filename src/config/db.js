import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export async function connectDb() {
  if (!env.MONGODB_URI) {
    logger.warn('MONGODB_URI not set — database operations will fail until configured.');
    return;
  }
  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: env.NODE_ENV === 'production' ? 15000 : 5000,
    });
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error(`MongoDB connection error: ${err.message}`);
    if (env.NODE_ENV === 'production') {
      throw err;
    } else {
      logger.warn('Continuing in development mode despite database connection issue. Check internet connection or MongoDB Atlas access.');
    }
  }

  mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB runtime error: ${err.message}`);
  });
}
