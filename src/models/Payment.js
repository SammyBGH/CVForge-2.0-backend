import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    cvId: { type: mongoose.Schema.Types.ObjectId, ref: 'CV', index: true },
    /** Paystack reference */
    reference: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'GHS' },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'abandoned'],
      default: 'pending',
    },
    channel: { type: String, default: '' },
    type: {
      type: String,
      enum: ['download', 'translation'],
      required: true,
    },
    paystackRaw: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

paymentSchema.index({ userId: 1, createdAt: -1 });

export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
