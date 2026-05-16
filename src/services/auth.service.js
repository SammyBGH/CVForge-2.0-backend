import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

export async function verifyGoogleIdToken(idToken) {
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
    { googleId: profile.googleId },
    {
      $set: {
        email: profile.email,
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
