import { TranslationJob } from '../models/TranslationJob.js';
import { CV } from '../models/CV.js';
import { env } from '../config/env.js';

/**
 * TODO: Replace stub with AI translation provider (OpenAI, DeepL, etc.)
 * For now: clones CV with locale + marks strings for future translation.
 */
export async function createTranslatedCvStub(sourceCv, targetLanguage) {
  const plain = sourceCv.toObject();
  delete plain._id;
  delete plain.createdAt;
  delete plain.updatedAt;
  plain.locale = targetLanguage;
  plain.title = `${plain.title} (${targetLanguage})`;
  plain.sourceCvId = sourceCv._id;
  plain.lockedFields = [];
  plain.downloadPaid = false;
  plain.translationCvIds = [];
  const copy = await CV.create({
    ...plain,
    userId: sourceCv.userId,
  });
  return copy;
}

export function translationPriceGhs() {
  return env.TRANSLATION_PRICE_GHS;
}

export async function completeTranslationJob(jobId, userId) {
  const job = await TranslationJob.findOne({ _id: jobId, userId });
  if (!job) {
    const err = new Error('Translation job not found');
    err.status = 404;
    throw err;
  }
  const source = await CV.findOne({ _id: job.sourceCvId, userId });
  if (!source) {
    const err = new Error('Source CV not found');
    err.status = 404;
    throw err;
  }
  const translated = await createTranslatedCvStub(source, job.targetLanguage);
  job.status = 'completed';
  job.translatedCvId = translated._id;
  await job.save();

  source.translationCvIds = [...(source.translationCvIds || []).map(String), String(translated._id)];
  await source.save();

  return { job, translated };
}
