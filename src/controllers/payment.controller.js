import crypto from 'crypto';
import { env } from '../config/env.js';
import {
  initializeTransaction,
  verifyTransaction,
  recordPendingPayment,
  updatePaymentByReference,
} from '../services/paystack.service.js';
import { getCvForUser, applyDownloadLocks } from '../services/cv.service.js';
import { createDownloadAccess } from '../services/download.service.js';
import { TranslationJob } from '../models/TranslationJob.js';
import { DownloadAccess } from '../models/DownloadAccess.js';
import { completeTranslationJob } from '../services/translation.service.js';

function ref(kind, cvId) {
  return `cv_${kind}_${cvId}_${crypto.randomBytes(8).toString('hex')}`;
}

function amountToPesewas(ghs) {
  return Math.round(Number(ghs) * 100);
}

export async function getPublicConfig(req, res) {
  res.json({
    paystackPublicKey: env.PAYSTACK_PUBLIC_KEY,
    downloadPriceGhs: env.DOWNLOAD_PRICE_GHS,
    translationPriceGhs: env.TRANSLATION_PRICE_GHS,
    downloadAccessDays: env.DOWNLOAD_ACCESS_DAYS,
  });
}

export async function initializePayment(req, res, next) {
  try {
    const { cvId, kind, targetLanguage } = req.body;
    const userId = req.user.id;

    await getCvForUser(cvId, userId);

    let amountGhs;
    let type;
    let metadata = { cvId, userId, kind };

    if (kind === 'download') {
      amountGhs = env.DOWNLOAD_PRICE_GHS;
      type = 'download';
    } else if (kind === 'translation') {
      if (!targetLanguage) {
        return res.status(400).json({ error: 'targetLanguage required for translation' });
      }
      amountGhs = env.TRANSLATION_PRICE_GHS;
      type = 'translation';
      metadata.target_language = String(targetLanguage);

      const job = await TranslationJob.create({
        sourceCvId: cvId,
        userId,
        targetLanguage,
        status: 'pending_payment',
      });
      metadata.translation_job_id = job._id.toString();
    } else {
      return res.status(400).json({ error: 'kind must be download or translation' });
    }

    if (!env.PAYSTACK_SECRET_KEY) {
      return res.status(503).json({ error: 'Payments not configured' });
    }

    const reference = ref(kind, cvId);
    const email = req.user.email || req.body.email;
    if (!email) {
      return res.status(400).json({ error: 'Email required for checkout' });
    }

    await recordPendingPayment({
      userId,
      cvId,
      reference,
      amount: amountGhs,
      currency: 'GHS',
      status: 'pending',
      type,
      paystackRaw: {},
    });

    const callback_url = `${env.CLIENT_ORIGIN.replace(/\/$/, '')}/payments/callback`;

    const init = await initializeTransaction({
      email,
      amountKobo: amountToPesewas(amountGhs),
      reference,
      metadata,
      callback_url,
    });

    res.json({
      authorizationUrl: init.authorization_url,
      reference: init.reference || reference,
      amountGhs,
    });
  } catch (e) {
    next(e);
  }
}

export async function verifyPayment(req, res, next) {
  try {
    const { reference } = req.query;
    if (!reference) {
      return res.status(400).json({ error: 'reference required' });
    }

    const data = await verifyTransaction(reference);
    const paymentDoc = await updatePaymentByReference(reference, {
      status: data.status === 'success' ? 'success' : 'failed',
      channel: data.channel,
      paystackRaw: data,
    });

    if (!paymentDoc) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    if (paymentDoc.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (data.status !== 'success') {
      return res.json({ ok: false, status: data.status });
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
      return res.json({
        ok: true,
        type: 'download',
        cvId,
        validUntil: env.DOWNLOAD_ACCESS_DAYS,
      });
    }

    if (paymentDoc.type === 'translation' && cvId) {
      const meta = data.metadata || {};
      const jobId = meta.translation_job_id || meta.translationJobId;
      let job = jobId ? await TranslationJob.findById(jobId) : null;
      if (!job) {
        job = await TranslationJob.findOne({
          sourceCvId: paymentDoc.cvId,
          userId: paymentDoc.userId,
          status: 'pending_payment',
        }).sort({ createdAt: -1 });
      }

      let translatedId = job?.translatedCvId?.toString() || null;
      if (job && job.userId.toString() === userId && job.status !== 'completed') {
        job.status = 'paid';
        job.paymentId = paymentDoc._id;
        await job.save();
        const { translated } = await completeTranslationJob(job._id, paymentDoc.userId);
        translatedId = translated?._id?.toString() || null;
      }

      return res.json({ ok: true, type: 'translation', cvId, translationCvId: translatedId });
    }

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
