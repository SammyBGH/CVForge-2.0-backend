import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

let googleClient = null;
function getGoogleClient() {
  if (!googleClient && env.GOOGLE_CLIENT_ID) {
    googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  }
  return googleClient;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, key] = storedHash.split(':');
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

export async function registerWithEmail({ email, password, name }) {
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    const err = new Error('An account with this email already exists. Please log in.');
    err.status = 409;
    throw err;
  }

  const passwordHash = hashPassword(password);
  const user = await User.create({
    email: normalizedEmail,
    passwordHash,
    name: (name || '').trim(),
    lastLoginAt: new Date(),
  });

  return user;
}

export async function loginWithEmail({ email, password }) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  if (!user.passwordHash) {
    const err = new Error('This account was registered using Google. Please sign in with Google.');
    err.status = 400;
    throw err;
  }

  const valid = verifyPassword(password, user.passwordHash);
  if (!valid) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

/**
 * Dev login that works even when MongoDB is completely unreachable.
 * If the database is connected, it creates/fetches a real user.
 * If the database is down (common locally when Atlas IP isn't whitelisted),
 * it returns a synthetic in-memory user object with a stable _id so
 * JWTs are consistent across restarts.
 */
export async function devLogin(devEmail = 'developer@cvforge.local') {
  const email = devEmail.toLowerCase().trim();

  // Check if MongoDB is actually connected (readyState 1 = connected)
  const dbReady = mongoose.connection.readyState === 1;

  if (dbReady) {
    try {
      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          email,
          name: 'Developer Account',
          picture: '',
          lastLoginAt: new Date(),
        });
      } else {
        user.lastLoginAt = new Date();
        await user.save();
      }
      return user;
    } catch (dbErr) {
      // If the DB call fails unexpectedly, fall through to offline user
      console.warn(`Dev login DB error (falling back to offline user): ${dbErr.message}`);
    }
  }

  // Offline fallback: generate a deterministic _id from the email so
  // the same email always produces the same user id across restarts.
  const hash = crypto.createHash('sha256').update(email).digest('hex');
  const objectIdHex = hash.slice(0, 24);

  return {
    _id: new mongoose.Types.ObjectId(objectIdHex),
    email,
    name: 'Developer (offline)',
    picture: '',
    lastLoginAt: new Date(),
  };
}

export async function verifyGoogleIdToken(idToken) {
  const client = getGoogleClient();
  if (!client) {
    throw Object.assign(new Error('Google Client ID is not configured on the server.'), { status: 503 });
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw Object.assign(new Error('Invalid Google token'), { status: 401 });
  }
  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || '',
    picture: payload.picture || '',
  };
}

export async function upsertUserFromGoogle(profile) {
  const user = await User.findOneAndUpdate(
    { $or: [{ googleId: profile.googleId }, { email: profile.email.toLowerCase().trim() }] },
    {
      $set: {
        googleId: profile.googleId,
        email: profile.email.toLowerCase().trim(),
        name: profile.name,
        picture: profile.picture,
        lastLoginAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
  return user;
}

export function signUserJwt(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}
