import { env } from '../config/env.js';
import { verifyTransaction, updatePaymentByReference } from './paystack.service.js';
import { applyDownloadLocks } from './cv.service.js';
import { createDownloadAccess } from './download.service.js';
import { TranslationJob } from '../models/TranslationJob.js';
import { DownloadAccess } from '../models/DownloadAccess.js';
import { completeTranslationJob } from './translation.service.js';

export async function fulfillPaystackReference(reference) {
  const data = await verifyTransaction(reference);
  const paymentDoc = await updatePaymentByReference(reference, {
    status: data.status === 'success' ? 'success' : 'failed',
    channel: data.channel,
    paystackRaw: data,
  });

  if (!paymentDoc) {
    const err = new Error('Payment record not found');
    err.status = 404;
    throw err;
  }

  if (data.status !== 'success') {
    return { ok: false, status: data.status, payment: paymentDoc };
  }

  const userId = paymentDoc.userId.toString();
  const cvId = paymentDoc.cvId?.toString();

  if (paymentDoc.type === 'download' && cvId) {
    await applyDownloadLocks(paymentDoc.cvId, paymentDoc.userId);
    const paidAt = new Date(data.paid_at || Date.now());
    const existingAccess = await DownloadAccess.findOne({ paymentId: paymentDoc._id });
    if (!existingAccess) {
      await createDownloadAccess(paymentDoc.userId, paymentDoc.cvId, paymentDoc._id, paidAt);
    }
    return {
      ok: true,
      type: 'download',
      cvId,
      userId,
      validUntil: env.DOWNLOAD_ACCESS_DAYS,
      payment: paymentDoc,
    };
  }

  if (paymentDoc.type === 'translation' && cvId) {
    const meta = data.metadata || {};
    const jobId = meta.translation_job_id || meta.translationJobId;
    let job = jobId ? await TranslationJob.findById(jobId) : null;
    if (!job) {
      job = await TranslationJob.findOne({
        sourceCvId: paymentDoc.cvId,
        userId: paymentDoc.userId,
        status: { $in: ['pending_payment', 'paid', 'processing', 'failed'] },
      }).sort({ createdAt: -1 });
    }

    let translatedId = job?.translatedCvId?.toString() || null;
    let translationStatus = job?.status || 'missing';
    let translationError = job?.errorMessage || '';

    if (job && job.userId.toString() === userId) {
      if (!job.paymentId) {
        job.paymentId = paymentDoc._id;
      }
      if (job.status === 'pending_payment') {
        job.status = 'paid';
      }
      await job.save();

      if (job.status !== 'completed') {
        try {
          const { translated, job: done } = await completeTranslationJob(job._id, paymentDoc.userId);
          translatedId = translated?._id?.toString() || null;
          translationStatus = done?.status || 'completed';
        } catch (e) {
          translationStatus = 'failed';
          translationError = e.message || 'Translation failed';
        }
      } else {
        translationStatus = 'completed';
      }
    }

    return {
      ok: true,
      type: 'translation',
      cvId,
      userId,
      translationCvId: translatedId,
      translationStatus,
      translationError,
      payment: paymentDoc,
    };
  }

  return { ok: true, payment: paymentDoc, userId };
}
