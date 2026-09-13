// Catches any request that didn't match a defined route.
// Registered AFTER all routes but BEFORE the error handler.
function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    status: 404,
    message: 'Route Not Found',
    method: req.method,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
}

module.exports = notFound;
