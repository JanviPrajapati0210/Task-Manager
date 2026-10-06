const express = require('express');
const router = express.Router();

const { register, login, googleLogin, me } = require('../controllers/authController');
const requireAuth = require('../middleware/auth');

// POST /auth/register
router.post('/register', register);

// POST /auth/login
router.post('/login', login);

// POST /auth/google  (Google Sign-In: verifies the Google ID token, returns our own JWT)
router.post('/google', googleLogin);

// GET /auth/me  (protected - Supplementary Problem)
router.get('/me', requireAuth, me);

module.exports = router;