import mongoose from 'mongoose';

/**
 * Placeholder for future monetizable features (cover letters, ATS scan, etc.)
 */
const futureAddonSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    priceGhs: { type: Number, default: 0 },
    active: { type: Boolean, default: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const FutureAddon =
  mongoose.models.FutureAddon || mongoose.model('FutureAddon', futureAddonSchema);
