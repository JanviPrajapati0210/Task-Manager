const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { applyConfiguredRole } = require('../utils/roles');

// Protects any route it's applied to. Expects: Authorization: Bearer <token>
// On success, req.user is the full user document (id, email, username, role...),
// loaded fresh from the database so role changes apply immediately.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No token provided. Include an Authorization: Bearer <token> header.',
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    // Covers both an invalid signature AND an expired token
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token.',
    });
  }

  try {
    const user = await User.findById(decoded.id).select(
      '-password -resetPasswordToken -resetPasswordExpires'
    );

    if (!user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User no longer exists.',
      });
    }

    // Auto-promote users whose email is listed in ADMIN_EMAILS / MANAGER_EMAILS
    if (applyConfiguredRole(user)) {
      await User.updateOne({ _id: user._id }, { role: user.role });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = requireAuth;