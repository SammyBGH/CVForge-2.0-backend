import dotenv from 'dotenv';

dotenv.config();

const requiredInProd = ['MONGODB_URI', 'JWT_SECRET', 'GOOGLE_CLIENT_ID'];

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: Number(process.env.PORT) || 4000,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  MONGODB_URI: process.env.MONGODB_URI || '',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-only-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || '',
  PAYSTACK_PUBLIC_KEY: process.env.PAYSTACK_PUBLIC_KEY || '',
  PAYSTACK_WEBHOOK_SECRET: process.env.PAYSTACK_WEBHOOK_SECRET || '',
  DOWNLOAD_ACCESS_DAYS: Number(process.env.DOWNLOAD_ACCESS_DAYS) || 25,
  TRANSLATION_PRICE_GHS: Number(process.env.TRANSLATION_PRICE_GHS) || 6,
  DOWNLOAD_PRICE_GHS: Number(process.env.DOWNLOAD_PRICE_GHS) || 25,
};

export function assertProductionConfig() {
  if (env.NODE_ENV !== 'production') return;
  const missing = requiredInProd.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required env: ${missing.join(', ')}`);
  }
}
