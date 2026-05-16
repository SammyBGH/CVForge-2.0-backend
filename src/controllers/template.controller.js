import { Template } from '../models/Template.js';

const FALLBACK = [
  { slug: 'modern-split', name: 'Modern split', description: 'Sidebar + main', sortOrder: 0 },
  { slug: 'minimal', name: 'Minimal', description: 'Single column clarity', sortOrder: 1 },
  { slug: 'accent-header', name: 'Accent header', description: 'Bold top band', sortOrder: 2 },
];

export async function listTemplates(req, res, next) {
  try {
    const rows = await Template.find({ active: true }).sort({ sortOrder: 1 }).lean();
    res.json({ templates: rows.length ? rows : FALLBACK });
  } catch (e) {
    next(e);
  }
}
