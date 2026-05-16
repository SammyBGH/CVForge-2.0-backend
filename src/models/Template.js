import mongoose from 'mongoose';

/**
 * Catalog of templates (can be seeded). Frontend may also ship static templates;
 * DB allows CMS-style overrides later.
 */
const templateSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    previewUrl: { type: String, default: '' },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Template = mongoose.models.Template || mongoose.model('Template', templateSchema);
