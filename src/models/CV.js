import mongoose from 'mongoose';

/**
 * Dynamic section: ordered blocks (personal, experience, education, etc.)
 * After payment, `lockedPaths` on parent CV restricts edits to identity fields.
 */
const sectionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'personal',
        'summary',
        'experience',
        'education',
        'skills',
        'projects',
        'certifications',
        'languages',
        'custom',
      ],
      required: true,
    },
    order: { type: Number, default: 0 },
    visible: { type: Boolean, default: true },
    /** Flexible payload per section type */
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const customizationSchema = new mongoose.Schema(
  {
    fontFamily: { type: String, default: 'system' },
    accentColor: { type: String, default: '' },
    density: { type: String, enum: ['compact', 'comfortable', 'spacious'], default: 'comfortable' },
  },
  { _id: false }
);

const cvSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, default: 'Untitled CV' },
    templateId: { type: String, default: 'modern-split' },
    themeId: { type: String, default: 'light' },
    layoutId: { type: String, default: 'two-column' },
    sections: { type: [sectionSchema], default: [] },
    customization: { type: customizationSchema, default: () => ({}) },
    /**
     * Dot-paths or section keys locked after successful download payment (anti-theft).
     * Example: ['sections.personal.data.fullName', 'sections.personal.data.email']
     */
    lockedFields: { type: [String], default: [] },
    /** Flag set true after at least one completed download payment */
    downloadPaid: { type: Boolean, default: false },
    /** References to translated CV documents */
    translationCvIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CV' }],
    sourceCvId: { type: mongoose.Schema.Types.ObjectId, ref: 'CV', default: null },
    locale: { type: String, default: 'en' },
  },
  { timestamps: true }
);

cvSchema.index({ userId: 1, updatedAt: -1 });

export const CV = mongoose.models.CV || mongoose.model('CV', cvSchema);
