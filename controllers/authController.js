const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { applyConfiguredRole } = require('../utils/roles');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Issues OUR app's JWT (same format for password login and Google login)
function signToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role || 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
}

// The user fields that are safe to send to the browser
function publicUser(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role || 'user',
    name: user.name,
    picture: user.picture,
    authProvider: user.authProvider,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
  };
}

// Builds a unique username (used for Google sign-ups and older accounts)
async function generateUniqueUsername(base) {
  let clean = (base || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
  if (clean.length < 3) clean = `user${clean}`;

  for (let i = 0; i < 10; i += 1) {
    const candidate = i === 0 ? clean : `${clean}${Math.floor(1000 + Math.random() * 9000)}`;
    // eslint-disable-next-line no-await-in-loop
    const taken = await User.exists({ username: candidate });
    if (!taken) return candidate;
  }
  return `${clean}${Date.now()}`.slice(0, 30);
}

// POST /auth/register
async function register(req, res, next) {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Username, email and password are required.',
      });
    }

    const cleanUsername = String(username).trim();
    const cleanEmail = String(email).trim().toLowerCase();

    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Username must be between 3 and 30 characters.',
      });
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Please enter a valid email address.',
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Password must be at least 6 characters.',
      });
    }

    if (await User.findOne({ username: cleanUsername })) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Username already exists.',
      });
    }

    if (await User.findOne({ email: cleanEmail })) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'An account with this email already exists.',
      });
    }

    // Hash the password before ever saving it (Practical 7 requirement).
    // The role is NOT taken from the request: everyone starts as "user";
    // admins/managers are set through ADMIN_EMAILS / MANAGER_EMAILS in .env.
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username: cleanUsername,
      email: cleanEmail,
      password: hashedPassword,
      authProvider: 'local',
    });
    applyConfiguredRole(user);
    await user.save();

    res.status(201).json({
      message: 'User registered successfully.',
      user: { id: user._id, username: user.username, email: user.email, role: user.role },
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

    const user = await User.findOne({ email: String(email).trim().toLowerCase() });
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

    // Older accounts have no username yet: give them one
    if (!user.username) {
      user.username = await generateUniqueUsername(user.name || user.email.split('@')[0]);
    }
    applyConfiguredRole(user);
    user.lastLogin = new Date();
    await user.save();

    const token = signToken(user);

    res.status(200).json({
      message: 'Login successful.',
      token,
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
}

// POST /auth/logout  (protected)
// JWTs are stateless, so the real logout is the client deleting its token.
// This endpoint exists so the client has a proper API call to make.
function logout(req, res) {
  res.status(200).json({ message: 'Logout successful.' });
}

// GET /auth/google/client-id
// Lets a frontend ask the server which Google client id to use.
function getGoogleClientId(req, res) {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({
      error: 'Server Misconfigured',
      message: 'GOOGLE_CLIENT_ID is not set on the server.',
    });
  }
  res.status(200).json({ clientId: process.env.GOOGLE_CLIENT_ID });
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
      user = new User({
        username: await generateUniqueUsername(email.split('@')[0]),
        email,
        googleId: payload.sub,
        authProvider: 'google',
        name: payload.name || '',
        picture: payload.picture || '',
      });
    } else {
      if (!user.googleId) user.googleId = payload.sub;
      if (!user.name) user.name = payload.name || '';
      if (!user.picture) user.picture = payload.picture || '';
      if (!user.username) {
        user.username = await generateUniqueUsername(email.split('@')[0]);
      }
    }

    applyConfiguredRole(user);
    user.lastLogin = new Date();
    await user.save();

    const token = signToken(user);

    res.status(200).json({
      message: 'Google login successful.',
      token,
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
}

// POST /auth/forgot-password
// Body: { email }. Always answers with the same message, so nobody can use
// this endpoint to find out which emails are registered.
async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email is required.',
      });
    }

    const genericResponse = {
      message: 'If an account with that email exists, a password reset link has been sent.',
    };

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(200).json(genericResponse);
    }

    // Random token goes in the email; only its hash is stored in the database
    const rawToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await user.save();

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password/${rawToken}`;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Reset your Task Manager password',
        text:
          `You asked to reset your password.\n\n` +
          `Open this link within 15 minutes to choose a new password:\n${resetUrl}\n\n` +
          `If you did not request this, you can ignore this email.`,
        html:
          `<p>You asked to reset your password.</p>` +
          `<p><a href="${resetUrl}">Click here to choose a new password</a> (valid for 15 minutes).</p>` +
          `<p>If you did not request this, you can ignore this email.</p>`,
      });
    } catch (mailErr) {
      // Email failed: invalidate the token and log the real reason server-side only
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      console.error('Failed to send reset email:', mailErr.message);
    }

    res.status(200).json(genericResponse);
  } catch (err) {
    next(err);
  }
}

// POST /auth/reset-password/:token
// Body: { password }
async function resetPassword(req, res, next) {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Password must be at least 6 characters.',
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid Token',
        message: 'This reset link is invalid or has expired. Please request a new one.',
      });
    }

    user.password = await bcrypt.hash(password, 10);
    // One-time use: clear the token so the link cannot be reused
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password updated successfully. You can now log in.' });
  } catch (err) {
    next(err);
  }
}

// GET /auth/me  (protected) - req.user is loaded by the auth middleware
function me(req, res) {
  res.status(200).json({ user: publicUser(req.user) });
}

// GET /auth/users (protected) - Returns team members / users
async function getAllUsers(req, res, next) {
  try {
    const users = await User.find(
      {},
      'username email role name picture createdAt lastLogin'
    ).sort({ createdAt: -1 });

    res.status(200).json({
      users: users.map((u) => ({
        id: u._id,
        _id: u._id,
        username: u.username || u.email.split('@')[0],
        email: u.email,
        role: u.role || 'user',
        name: u.name,
        picture: u.picture,
        createdAt: u.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// PUT /auth/users/:id/role (admin only) - Update user role
async function updateUserRole(req, res, next) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only administrators can update user roles.',
      });
    }

    const { role } = req.body;
    const VALID_ROLES = ['user', 'employee', 'manager', 'admin'];
    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
      });
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, select: 'username email role name picture createdAt' }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found.' });
    }

    res.status(200).json({
      message: 'User role updated successfully.',
      user: {
        id: updated._id,
        _id: updated._id,
        username: updated.username || updated.email.split('@')[0],
        email: updated.email,
        role: updated.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  logout,
  googleLogin,
  getGoogleClientId,
  forgotPassword,
  resetPassword,
  me,
  getAllUsers,
  updateUserRole,
};