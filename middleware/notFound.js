// Catches any request that didn't match a defined route.
// Registered AFTER all routes but BEFORE the error handler.
function notFound(req, res, next) {
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    path: req.originalUrl,
  });
}

module.exports = notFound;
