import {
  createCv,
  listCvs,
  getCvForUser,
  updateCv,
  duplicateCv,
  deleteCv,
} from '../services/cv.service.js';
import { retryFailedTranslation } from '../services/translation.service.js';

export async function list(req, res, next) {
  try {
    const rows = await listCvs(req.user.id);
    res.json({ cvs: rows });
  } catch (e) {
    next(e);
  }
}

export async function create(req, res, next) {
  try {
    const cv = await createCv(req.user.id, req.body);
    res.status(201).json({ cv });
  } catch (e) {
    next(e);
  }
}

export async function getOne(req, res, next) {
  try {
    const cv = await getCvForUser(req.params.id, req.user.id);
    res.json({ cv });
  } catch (e) {
    next(e);
  }
}

export async function patch(req, res, next) {
  try {
    const cv = await updateCv(req.params.id, req.user.id, req.body);
    res.json({ cv });
  } catch (e) {
    next(e);
  }
}

export async function duplicate(req, res, next) {
  try {
    const cv = await duplicateCv(req.params.id, req.user.id);
    res.status(201).json({ cv });
  } catch (e) {
    next(e);
  }
}

export async function remove(req, res, next) {
  try {
    await deleteCv(req.params.id, req.user.id);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

export async function retryTranslation(req, res, next) {
  try {
    await getCvForUser(req.params.id, req.user.id);
    const { job, translated } = await retryFailedTranslation(req.params.id, req.user.id);
    res.json({
      job: {
        id: job?._id,
        status: job?.status,
        errorMessage: job?.errorMessage,
      },
      cv: translated,
    });
  } catch (e) {
    next(e);
  }
}
