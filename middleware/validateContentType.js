// Supplementary Problem 1:
// Reject POST/PUT requests that don't declare Content-Type: application/json.
// This is a route-level middleware (applied only where a body is expected),
// not a global one, since GET/DELETE requests have no body to type-check.
function validateContentType(req, res, next) {
  const contentType = req.headers['content-type'];

  if (!contentType || !contentType.includes('application/json')) {
    return res.status(400).json({
      error: 'Content-Type must be application/json',
    });
  }
  next();
}

module.exports = validateContentType;
