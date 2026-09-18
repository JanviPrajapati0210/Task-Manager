const jwt = require('jsonwebtoken');

// Protects any route it's applied to. Expects: Authorization: Bearer <token>
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'No token provided. Include an Authorization: Bearer <token> header.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, iat, exp }
    next();
  } catch (err) {
    // Covers both an invalid signature AND an expired token
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token.',
    });
  }
}

module.exports = requireAuth;