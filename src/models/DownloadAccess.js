import mongoose from 'mongoose';

/**
 * Grants free re-download until validUntil (typically paidAt + 25 days).
 */
const downloadAccessSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    cvId: { type: mongoose.Schema.Types.ObjectId, ref: 'CV', required: true, index: true },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true },
    validFrom: { type: Date, required: true },
    validUntil: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

downloadAccessSchema.index({ userId: 1, cvId: 1 });
downloadAccessSchema.index({ validUntil: 1 });

export const DownloadAccess =
  mongoose.models.DownloadAccess || mongoose.model('DownloadAccess', downloadAccessSchema);
