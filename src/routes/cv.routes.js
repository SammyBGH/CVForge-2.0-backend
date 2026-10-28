import { Router } from 'express';
import { z } from 'zod';
import * as cv from '../controllers/cv.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

const createBody = z.object({
  title: z.string().optional(),
  templateId: z.string().optional(),
  themeId: z.string().optional(),
  layoutId: z.string().optional(),
  sections: z.array(z.any()).optional(),
  customization: z.record(z.string(), z.any()).optional(),
});

const patchBody = z.object({
  title: z.string().optional(),
  templateId: z.string().optional(),
  themeId: z.string().optional(),
  layoutId: z.string().optional(),
  sections: z.array(z.any()).optional(),
  customization: z.record(z.string(), z.any()).optional(),
});

router.use(requireAuth);

router.get('/', cv.list);
router.post('/', validateBody(createBody), cv.create);
router.get('/:id', cv.getOne);
router.patch('/:id', validateBody(patchBody), cv.patch);
router.post('/:id/duplicate', cv.duplicate);
router.post('/:id/translations/retry', cv.retryTranslation);
router.delete('/:id', cv.remove);

export default router;
