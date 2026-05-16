import { Router } from 'express';
import * as tpl from '../controllers/template.controller.js';

const router = Router();

router.get('/', tpl.listTemplates);

export default router;
