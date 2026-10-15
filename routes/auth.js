const express = require('express');
const router = express.Router();

const {
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
} = require('../controllers/authController');
const requireAuth = require('../middleware/auth');

// POST /auth/register
router.post('/register', register);

// POST /auth/login
router.post('/login', login);

// POST /auth/logout  (protected)
router.post('/logout', requireAuth, logout);

// GET /auth/google/client-id  (which Google client id the frontend should use)
router.get('/google/client-id', getGoogleClientId);

// POST /auth/google  (Google Sign-In: verifies the Google ID token, returns our own JWT)
router.post('/google', googleLogin);

// POST /auth/forgot-password  (emails a one-time reset link)
router.post('/forgot-password', forgotPassword);

// POST /auth/reset-password/:token  (sets a new password)
router.post('/reset-password/:token', resetPassword);

// GET /auth/me  (protected - Supplementary Problem)
router.get('/me', requireAuth, me);

// GET /auth/users  (protected - Team & Roles management)
router.get('/users', requireAuth, getAllUsers);

// PUT /auth/users/:id/role  (protected admin-only - Update user role)
router.put('/users/:id/role', requireAuth, updateUserRole);

module.exports = router;