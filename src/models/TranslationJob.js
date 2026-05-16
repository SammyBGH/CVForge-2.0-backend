import mongoose from 'mongoose';

/**
 * Paid translation pipeline — placeholder for future AI/provider integration.
 */
const translationJobSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sourceCvId: { type: mongoose.Schema.Types.ObjectId, ref: 'CV', required: true },
    targetLanguage: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending_payment', 'paid', 'processing', 'completed', 'failed'],
      default: 'pending_payment',
    },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    translatedCvId: { type: mongoose.Schema.Types.ObjectId, ref: 'CV' },
    errorMessage: { type: String, default: '' },
    /** Future: provider job id, model version, etc. */
    providerMeta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

translationJobSchema.index({ userId: 1, createdAt: -1 });

export const TranslationJob =
  mongoose.models.TranslationJob || mongoose.model('TranslationJob', translationJobSchema);
