const express = require('express');
const router = express.Router();

const { register, login, me } = require('../controllers/authController');
const requireAuth = require('../middleware/auth');

// POST /auth/register
router.post('/register', register);

// POST /auth/login
router.post('/login', login);

// GET /auth/me  (protected - Supplementary Problem)
router.get('/me', requireAuth, me);

module.exports = router;