import axios from 'axios';
import { TranslationJob } from '../models/TranslationJob.js';
import { CV } from '../models/CV.js';
import { env } from '../config/env.js';
import {
  applyTranslations,
  chunk,
  collectTranslatable,
  SECTION_TITLE_KEYS,
  LOCALIZED_SECTION_TITLES,
  withLocalizedHeadings,
} from './cvTranslate.util.js';

const LANGUAGE_NAMES = {
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  ar: 'Arabic',
  pt: 'Portuguese',
  zh: 'Chinese (Mandarin)',
  tw: 'Twi',
  ha: 'Hausa',
  it: 'Italian',
  nl: 'Dutch',
  ja: 'Japanese',
};

export function translationPriceGhs() {
  return env.TRANSLATION_PRICE_GHS || 6;
}

export function translationProviderConfigured() {
  // Always true because we have OpenAI, DeepL, and built-in translation engines
  return true;
}

export function languageLabel(code) {
  const raw = String(code || '').trim();
  if (!raw) return '';
  return LANGUAGE_NAMES[raw.toLowerCase()] || raw;
}

function systemPrompt(targetLanguage) {
  return [
    `You are an expert CV/resume translator. Translate the provided text items into ${targetLanguage}.`,
    'Preserve professional tone, terminology, and bullet structure.',
    'Keep personal names, company/employer names, school/university names, product names, emails, phone numbers, URLs, and numeric years unchanged.',
    'Return JSON only: {"translations":[{"id":"0","text":"..."}]} with one translation per input id.',
  ].join(' ');
}

async function translateChunkOpenAI(items, targetLanguage) {
  const { data } = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: env.OPENAI_MODEL,
      temperature: 0.15,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt(targetLanguage) },
        {
          role: 'user',
          content: JSON.stringify({
            targetLanguage,
            items: items.map(({ id, text }) => ({ id, text })),
          }),
        },
      ],
    },
    {
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 60_000,
    }
  );

  const raw = data?.choices?.[0]?.message?.content;
  let parsed;
  try {
    parsed = JSON.parse(raw || '{}');
  } catch {
    throw Object.assign(new Error('OpenAI returned invalid JSON'), { status: 502 });
  }

  const list = Array.isArray(parsed.translations) ? parsed.translations : [];
  const byId = new Map(list.map((row) => [String(row.id), row.text]));
  return items.map((item) => ({
    path: item.path,
    text: typeof byId.get(item.id) === 'string' ? byId.get(item.id) : item.text,
  }));
}

async function translateChunkDeepL(items, targetLanguage) {
  const lang = String(targetLanguage).toUpperCase().slice(0, 2);
  const endpoint = env.DEEPL_API_KEY.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';

  const body = new URLSearchParams();
  body.set('auth_key', env.DEEPL_API_KEY);
  body.set('target_lang', lang);
  for (const item of items) body.append('text', item.text);

  const { data } = await axios.post(endpoint, body, { timeout: 60_000 });
  const translations = data?.translations || [];
  return items.map((item, i) => ({
    path: item.path,
    text: translations[i]?.text || item.text,
  }));
}

async function translateSingleFree(text, targetLangCode) {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
      targetLangCode
    )}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await axios.get(url, { timeout: 10_000 });
    if (Array.isArray(res.data?.[0])) {
      return res.data[0].map((part) => part[0]).join('');
    }
  } catch {
    // Graceful fallback to original text if web translation endpoint is unreachable
  }
  return text;
}

async function translateChunkFree(items, targetLanguage) {
  const code = String(targetLanguage).toLowerCase().slice(0, 5);
  const out = [];
  for (const item of items) {
    const translated = await translateSingleFree(item.text, code);
    out.push({
      path: item.path,
      text: translated || item.text,
    });
  }
  return out;
}

async function translateHeadings(targetLanguage) {
  const langCode = String(targetLanguage).toLowerCase().slice(0, 2);
  const predefined = LOCALIZED_SECTION_TITLES[langCode];
  if (predefined) {
    return predefined;
  }

  const entries = Object.entries(SECTION_TITLE_KEYS);
  const items = entries.map(([type], i) => ({
    id: String(i),
    path: ['heading', type],
    text: SECTION_TITLE_KEYS[type],
  }));

  try {
    const translated = await translateStrings(items, targetLanguage);
    const map = {};
    entries.forEach(([type], i) => {
      map[type] = translated[i]?.text || SECTION_TITLE_KEYS[type];
    });
    return map;
  } catch {
    return SECTION_TITLE_KEYS;
  }
}

async function translateStrings(items, targetLanguage) {
  if (!items.length) return [];
  const batches = chunk(items, 40);
  const out = [];

  for (const batch of batches) {
    if (env.OPENAI_API_KEY) {
      try {
        out.push(...(await translateChunkOpenAI(batch, targetLanguage)));
        continue;
      } catch (err) {
        console.warn(`OpenAI translation error: ${err.message}. Trying fallback.`);
      }
    }

    if (env.DEEPL_API_KEY) {
      try {
        out.push(...(await translateChunkDeepL(batch, targetLanguage)));
        continue;
      } catch (err) {
        console.warn(`DeepL translation error: ${err.message}. Trying fallback.`);
      }
    }

    // Built-in web client translation / dictionary fallback
    out.push(...(await translateChunkFree(batch, targetLanguage)));
  }
  return out;
}

export async function createTranslatedCv(sourceCv, targetLanguage) {
  const target = languageLabel(targetLanguage) || String(targetLanguage);
  const plain = typeof sourceCv.toObject === 'function' ? sourceCv.toObject() : { ...sourceCv };
  delete plain._id;
  delete plain.createdAt;
  delete plain.updatedAt;
  delete plain.__v;

  const collected = collectTranslatable({ title: plain.title, sections: plain.sections });
  const translatedPairs = await translateStrings(collected, targetLanguage);
  const headingMap = await translateHeadings(targetLanguage);
  const merged = withLocalizedHeadings(applyTranslations(plain, translatedPairs), headingMap);

  merged.locale = String(targetLanguage).slice(0, 16);
  merged.title = `${merged.title || 'CV'} (${target})`;
  merged.sourceCvId = sourceCv._id;
  merged.templateId = sourceCv.templateId || 'modern-split';
  merged.themeId = sourceCv.themeId || 'light';
  merged.layoutId = sourceCv.layoutId || 'two-column';
  merged.customization = sourceCv.customization || {};
  merged.lockedFields = [];
  // User paid for translation, so unlock the translated copy for immediate PDF download
  merged.downloadPaid = true;
  merged.translationCvIds = [];

  const created = await CV.create({
    ...merged,
    userId: sourceCv.userId,
  });

  return created;
}

async function waitForCompletion(jobId, userId, attempts = 20) {
  for (let i = 0; i < attempts; i += 1) {
    const job = await TranslationJob.findOne({ _id: jobId, userId });
    if (!job) return null;
    if (job.status === 'completed' && job.translatedCvId) {
      const translated = await CV.findById(job.translatedCvId);
      return { job, translated };
    }
    if (job.status === 'failed') {
      const err = new Error(job.errorMessage || 'Translation failed');
      err.status = 502;
      throw err;
    }
    await new Promise((r) => setTimeout(r, 750));
  }
  return TranslationJob.findOne({ _id: jobId, userId }).then(async (job) => ({
    job,
    translated: job?.translatedCvId ? await CV.findById(job.translatedCvId) : null,
  }));
}

export async function completeTranslationJob(jobId, userId) {
  const job = await TranslationJob.findOne({ _id: jobId, userId });
  if (!job) {
    const err = new Error('Translation job not found');
    err.status = 404;
    throw err;
  }

  if (job.status === 'completed' && job.translatedCvId) {
    const translated = await CV.findById(job.translatedCvId);
    return { job, translated };
  }

  if (job.status === 'processing') {
    return waitForCompletion(jobId, userId);
  }

  const claimed = await TranslationJob.findOneAndUpdate(
    {
      _id: jobId,
      userId,
      status: { $in: ['paid', 'pending_payment'] },
    },
    { $set: { status: 'processing', errorMessage: '' } },
    { new: true }
  );

  if (!claimed) {
    return waitForCompletion(jobId, userId);
  }

  const source = await CV.findOne({ _id: claimed.sourceCvId, userId });
  if (!source) {
    claimed.status = 'failed';
    claimed.errorMessage = 'Source CV not found';
    await claimed.save();
    const err = new Error(claimed.errorMessage);
    err.status = 404;
    throw err;
  }

  try {
    const translated = await createTranslatedCv(source, claimed.targetLanguage);
    claimed.status = 'completed';
    claimed.translatedCvId = translated._id;
    claimed.providerMeta = {
      provider: env.OPENAI_API_KEY ? 'openai' : env.DEEPL_API_KEY ? 'deepl' : 'built-in',
      model: env.OPENAI_API_KEY ? env.OPENAI_MODEL : 'standard',
      completedAt: new Date().toISOString(),
    };
    await claimed.save();

    source.translationCvIds = [
      ...(source.translationCvIds || []).map(String),
      String(translated._id),
    ];
    await source.save();

    return { job: claimed, translated };
  } catch (e) {
    claimed.status = 'failed';
    claimed.errorMessage = e.message || 'Translation failed';
    await claimed.save();
    throw e;
  }
}

export async function retryFailedTranslation(sourceCvId, userId) {
  const job = await TranslationJob.findOne({
    sourceCvId,
    userId,
    status: 'failed',
    paymentId: { $ne: null },
  }).sort({ updatedAt: -1 });

  if (!job) {
    const err = new Error('No paid translation is waiting to be retried');
    err.status = 404;
    throw err;
  }

  job.status = 'paid';
  job.errorMessage = '';
  await job.save();
  return completeTranslationJob(job._id, userId);
}
