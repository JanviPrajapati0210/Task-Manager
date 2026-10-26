/**
 * Simple in-memory rate limiter for AI requests to prevent excessive API usage.
 * Requirement: Max 1 AI request per user/client per minute (60 seconds).
 */

const userRequests = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 60 seconds

function aiRateLimiter(req, res, next) {
  // Allow bypassing rate limit explicitly during unit tests if requested
  if (req.headers['x-skip-rate-limit'] === 'true') {
    return next();
  }

  const clientId = (req.user && req.user._id ? req.user._id.toString() : req.ip) || 'anonymous';
  const now = Date.now();
  const lastRequestTime = userRequests.get(clientId);

  if (lastRequestTime && now - lastRequestTime < RATE_LIMIT_WINDOW_MS) {
    const remainingMs = RATE_LIMIT_WINDOW_MS - (now - lastRequestTime);
    const retryAfter = Math.ceil(remainingMs / 1000);

    res.setHeader('Retry-After', retryAfter);
    res.setHeader('X-RateLimit-Limit', '1');
    res.setHeader('X-RateLimit-Remaining', '0');

    return res.status(429).json({
      error: 'Rate Limit Exceeded',
      message: `Rate limit reached. Please wait ${retryAfter}s before requesting another suggestion for this task title.`,
      retryAfterSeconds: retryAfter,
    });
  }

  // Record this request timestamp
  userRequests.set(clientId, now);

  res.setHeader('X-RateLimit-Limit', '1');
  res.setHeader('X-RateLimit-Remaining', '0');
  next();
}

/**
 * Reset helper for testing
 */
aiRateLimiter.reset = () => {
  userRequests.clear();
};

/**
 * Get current rate limit stats for inspection
 */
aiRateLimiter.getStats = () => ({
  activeTrackedUsers: userRequests.size,
  windowSeconds: RATE_LIMIT_WINDOW_MS / 1000,
});

module.exports = aiRateLimiter;
