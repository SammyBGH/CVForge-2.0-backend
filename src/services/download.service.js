import { DownloadAccess } from '../models/DownloadAccess.js';
import { env } from '../config/env.js';

export async function createDownloadAccess(userId, cvId, paymentId, paidAt = new Date()) {
  const validFrom = paidAt;
  const validUntil = new Date(paidAt);
  validUntil.setDate(validUntil.getDate() + env.DOWNLOAD_ACCESS_DAYS);

  const doc = await DownloadAccess.create({
    userId,
    cvId,
    paymentId,
    validFrom,
    validUntil,
  });
  return doc;
}

/**
 * Returns active access row or null
 */
export async function getActiveDownloadAccess(userId, cvId) {
  const now = new Date();
  return DownloadAccess.findOne({
    userId,
    cvId,
    revoked: false,
    validUntil: { $gte: now },
    validFrom: { $lte: now },
  }).sort({ validUntil: -1 });
}

export async function assertDownloadAllowed(userId, cvId) {
  const access = await getActiveDownloadAccess(userId, cvId);
  if (!access) {
    const err = new Error('Payment required for download');
    err.status = 402;
    throw err;
  }
  return access;
}

export async function getDownloadStatus(userId, cvId) {
  const access = await getActiveDownloadAccess(userId, cvId);
  if (!access) {
    return { allowed: false, validUntil: null, secondsRemaining: 0 };
  }
  const ms = access.validUntil.getTime() - Date.now();
  return {
    allowed: true,
    validUntil: access.validUntil.toISOString(),
    secondsRemaining: Math.max(0, Math.floor(ms / 1000)),
  };
}
