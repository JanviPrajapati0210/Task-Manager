const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Issues OUR app's JWT (same format for password login and Google login)
function signToken(user) {
  return jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });
}

// POST /auth/register
async function register(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email and password are required.',
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'An account with this email already exists.',
      });
    }

    // Hash the password before ever saving it (Practical 7 requirement)
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashedPassword });

    res.status(201).json({
      message: 'User registered successfully.',
      user: { id: user._id, email: user.email },
    });
  } catch (err) {
    next(err);
  }
}

// POST /auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email and password are required.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    // `!user.password` covers accounts that were created with Google only
    if (!user || !user.password) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid email or password.',
      });
    }

    const token = signToken(user);

    res.status(200).json({
      message: 'Login successful.',
      token,
      user: { id: user._id, email: user.email },
    });
  } catch (err) {
    next(err);
  }
}

// POST /auth/google
// Body: { credential }  <- the Google ID token (JWT) from the Google Sign-In button
async function googleLogin(req, res, next) {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Google credential is required.',
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        error: 'Server Misconfigured',
        message: 'GOOGLE_CLIENT_ID is not set on the server.',
      });
    }

    // Verify signature, expiry and that the token was issued for OUR client id.
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid Google credential.',
      });
    }

    if (!payload || !payload.email || !payload.email_verified) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Your Google account email is not verified.',
      });
    }

    const email = payload.email.toLowerCase();

    // 1) returning Google user, 2) existing email/password user -> link, 3) brand new user
    let user = (await User.findOne({ googleId: payload.sub })) || (await User.findOne({ email }));

    if (!user) {
      user = await User.create({
        email,
        googleId: payload.sub,
        name: payload.name || '',
        picture: payload.picture || '',
      });
    } else if (!user.googleId) {
      user.googleId = payload.sub;
      if (!user.name) user.name = payload.name || '';
      if (!user.picture) user.picture = payload.picture || '';
      await user.save();
    }

    const token = signToken(user);

    res.status(200).json({
      message: 'Google login successful.',
      token,
      user: { id: user._id, email: user.email, name: user.name, picture: user.picture },
    });
  } catch (err) {
    next(err);
  }
}

// GET /auth/me  (Supplementary Problem)
async function me(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'User not found.',
      });
    }
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, googleLogin, me };