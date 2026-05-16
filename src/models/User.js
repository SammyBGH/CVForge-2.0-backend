import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, default: '' },
    picture: { type: String, default: '' },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
