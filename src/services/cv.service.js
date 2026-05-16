import { CV } from '../models/CV.js';

const DEFAULT_SECTIONS = () => [
  {
    key: 'personal',
    type: 'personal',
    order: 0,
    visible: true,
    data: {
      fullName: '',
      headline: '',
      email: '',
      phone: '',
      location: '',
      website: '',
      linkedin: '',
    },
  },
  {
    key: 'summary',
    type: 'summary',
    order: 1,
    visible: true,
    data: { html: '' },
  },
  {
    key: 'experience',
    type: 'experience',
    order: 2,
    visible: true,
    data: { items: [] },
  },
  {
    key: 'education',
    type: 'education',
    order: 3,
    visible: true,
    data: { items: [] },
  },
  {
    key: 'skills',
    type: 'skills',
    order: 4,
    visible: true,
    data: { items: [] },
  },
  {
    key: 'projects',
    type: 'projects',
    order: 5,
    visible: true,
    data: { items: [] },
  },
  {
    key: 'certifications',
    type: 'certifications',
    order: 6,
    visible: true,
    data: { items: [] },
  },
];

export async function createCv(userId, payload = {}) {
  const doc = await CV.create({
    userId,
    title: payload.title || 'Untitled CV',
    templateId: payload.templateId || 'modern-split',
    themeId: payload.themeId || 'light',
    layoutId: payload.layoutId || 'two-column',
    sections: payload.sections?.length ? payload.sections : DEFAULT_SECTIONS(),
    customization: payload.customization || {},
  });
  return doc;
}

export async function listCvs(userId) {
  return CV.find({ userId }).sort({ updatedAt: -1 }).lean();
}

export async function getCvForUser(cvId, userId) {
  const cv = await CV.findOne({ _id: cvId, userId });
  if (!cv) {
    const err = new Error('CV not found');
    err.status = 404;
    throw err;
  }
  return cv;
}

function pathTouchesLocked(sectionKey, fieldPath, lockedFields) {
  const prefix = `sections.${sectionKey}.data`;
  return lockedFields.some((lf) => lf === prefix || lf.startsWith(`${prefix}.`) || lf === `sections.${sectionKey}`);
}

function mergeSectionData(existing, incoming, sectionKey, lockedFields) {
  if (!pathTouchesLocked(sectionKey, '', lockedFields)) {
    return incoming;
  }
  const out = { ...existing };
  for (const [k, v] of Object.entries(incoming || {})) {
    const p = `sections.${sectionKey}.data.${k}`;
    if (lockedFields.includes(p)) continue;
    out[k] = v;
  }
  return out;
}

export async function updateCv(cvId, userId, body) {
  const cv = await getCvForUser(cvId, userId);
  const locked = cv.lockedFields || [];

  if (body.title !== undefined) cv.title = body.title;
  if (body.templateId !== undefined) cv.templateId = body.templateId;
  if (body.themeId !== undefined) cv.themeId = body.themeId;
  if (body.layoutId !== undefined) cv.layoutId = body.layoutId;
  if (body.customization !== undefined) cv.customization = { ...cv.customization.toObject?.() || cv.customization, ...body.customization };

  if (body.sections !== undefined) {
    const merged = body.sections.map((s) => {
      const prev = cv.sections.find((x) => x.key === s.key);
      const baseData = prev?.data || {};
      const newData = mergeSectionData(baseData, s.data, s.key, locked);
      return {
        ...s,
        data: newData,
      };
    });
    cv.sections = merged;
  }

  cv.markModified('sections');
  await cv.save();
  return cv;
}

export async function duplicateCv(cvId, userId) {
  const original = await getCvForUser(cvId, userId);
  const plain = original.toObject();
  delete plain._id;
  delete plain.createdAt;
  delete plain.updatedAt;
  plain.title = `${plain.title} (copy)`;
  plain.lockedFields = [];
  plain.downloadPaid = false;
  plain.translationCvIds = [];
  plain.sourceCvId = original._id;
  const suf = Date.now().toString(36);
  plain.sections = plain.sections.map((s, i) => ({
    ...s,
    key: `${s.type}-${suf}-${i}`,
  }));
  const copy = await CV.create({ ...plain, userId });
  return copy;
}

export async function deleteCv(cvId, userId) {
  const res = await CV.deleteOne({ _id: cvId, userId });
  if (!res.deletedCount) {
    const err = new Error('CV not found');
    err.status = 404;
    throw err;
  }
}

/** Apply anti-theft locks after successful download payment */
export async function applyDownloadLocks(cvId, userId) {
  const cv = await getCvForUser(cvId, userId);
  const personal = cv.sections.find((s) => s.type === 'personal');
  const locks = new Set(cv.lockedFields || []);
  if (personal) {
    locks.add(`sections.${personal.key}.data.fullName`);
    locks.add(`sections.${personal.key}.data.email`);
    locks.add(`sections.${personal.key}.data.phone`);
    locks.add(`sections.${personal.key}.data.location`);
  }
  cv.lockedFields = [...locks];
  cv.downloadPaid = true;
  await cv.save();
  return cv;
}
