import { upsertUserFromGoogle, verifyGoogleIdToken, signUserJwt } from '../services/auth.service.js';
import { User } from '../models/User.js';

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
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({
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
