import {
  upsertUserFromGoogle,
  verifyGoogleIdToken,
  signUserJwt,
  registerWithEmail,
  loginWithEmail,
  devLogin as devLoginService,
} from '../services/auth.service.js';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { env } from '../config/env.js';

export async function register(req, res, next) {
  try {
    const { email, password, name } = req.body;
    const user = await registerWithEmail({ email, password, name });
    const token = signUserJwt(user);
    res.status(201).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (e) {
    next(e);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await loginWithEmail({ email, password });
    const token = signUserJwt(user);
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (e) {
    next(e);
  }
}

export async function devLogin(req, res, next) {
  try {
    if (env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Dev login is disabled in production.' });
    }
    const devEmail = req.body?.email || 'developer@cvforge.local';
    const user = await devLoginService(devEmail);
    const token = signUserJwt(user);
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (e) {
    next(e);
  }
}

export async function googleLogin(req, res, next) {
  try {
    const { idToken } = req.body;
    const profile = await verifyGoogleIdToken(idToken);
    const user = await upsertUserFromGoogle(profile);
    const token = signUserJwt(user);
    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (e) {
    next(e);
  }
}

export async function me(req, res, next) {
  try {
    const dbReady = mongoose.connection.readyState === 1;

    if (dbReady) {
      const user = await User.findById(req.user.id).lean();
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json({
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          picture: user.picture,
        },
      });
    }

    // DB is offline — return what we know from the JWT token
    return res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.email.split('@')[0],
        picture: '',
      },
    });
  } catch (e) {
    next(e);
  }
}
