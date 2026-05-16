import { getDownloadStatus, assertDownloadAllowed } from '../services/download.service.js';
import { getCvForUser } from '../services/cv.service.js';

export async function status(req, res, next) {
  try {
    const { cvId } = req.params;
    const statusPayload = await getDownloadStatus(req.user.id, cvId);
    res.json(statusPayload);
  } catch (e) {
    next(e);
  }
}

/** Ensures user may export PDF — call before streaming PDF from API if moved server-side */
export async function authorize(req, res, next) {
  try {
    const { cvId } = req.params;
    await getCvForUser(cvId, req.user.id);
    await assertDownloadAllowed(req.user.id, cvId);
    res.json({ authorized: true });
  } catch (e) {
    next(e);
  }
}
