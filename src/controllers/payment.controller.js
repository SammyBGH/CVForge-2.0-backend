import crypto from 'crypto';
import { env } from '../config/env.js';
import { initializeTransaction, recordPendingPayment, verifyPaystackSignature } from '../services/paystack.service.js';
import { getCvForUser } from '../services/cv.service.js';
import { TranslationJob } from '../models/TranslationJob.js';
import { translationProviderConfigured } from '../services/translation.service.js';
import { fulfillPaystackReference } from '../services/payment.fulfill.service.js';

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
    translationAvailable: translationProviderConfigured(),
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
      if (!translationProviderConfigured()) {
        return res.status(503).json({
          error:
            'Translation is not available yet. The server needs OPENAI_API_KEY or DEEPL_API_KEY before checkout can start.',
        });
      }
      amountGhs = env.TRANSLATION_PRICE_GHS;
      type = 'translation';
      metadata.target_language = String(targetLanguage);

      let job = await TranslationJob.findOne({
        sourceCvId: cvId,
        userId,
        targetLanguage,
        status: 'pending_payment',
      }).sort({ createdAt: -1 });

      if (!job) {
        job = await TranslationJob.create({
          sourceCvId: cvId,
          userId,
          targetLanguage,
          status: 'pending_payment',
        });
      }
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

    const result = await fulfillPaystackReference(reference);
    const paymentDoc = result.payment;

    if (paymentDoc.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (!result.ok) {
      return res.json({ ok: false, status: result.status });
    }

    if (result.type === 'download') {
      return res.json({
        ok: true,
        type: 'download',
        cvId: result.cvId,
        validUntil: result.validUntil,
      });
    }

    if (result.type === 'translation') {
      return res.json({
        ok: true,
        type: 'translation',
        cvId: result.cvId,
        translationCvId: result.translationCvId,
        translationStatus: result.translationStatus,
        translationError: result.translationError || undefined,
      });
    }

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

export async function paystackWebhook(req, res, next) {
  try {
    if (env.PAYSTACK_WEBHOOK_SECRET) {
      const signature = req.headers['x-paystack-signature'];
      const raw = req.rawBody || JSON.stringify(req.body);
      if (!verifyPaystackSignature(raw, signature)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const event = req.body?.event;
    const reference = req.body?.data?.reference;
    if (event === 'charge.success' && reference) {
      try {
        await fulfillPaystackReference(reference);
      } catch (e) {
        // Acknowledge receipt so Paystack does not retry forever on app errors after verify
        console.error('Paystack webhook fulfillment failed', e.message);
      }
    }

    res.json({ received: true });
  } catch (e) {
    next(e);
  }
}
