// Global error handler. Express recognizes this as an error handler because
// it takes FOUR arguments (err, req, res, next). It must be registered LAST,
// after all routes, or it will never be reached.
function errorHandler(err, req, res, next) {
  // Log the full stack server-side for debugging...
  console.error(err.stack);

  // Mongoose validation errors (e.g. missing "title", bad "priority" enum
  // value) come through as err.name === 'ValidationError' with a nested
  // `errors` object per field. Reshape into a clean, flat JSON array instead
  // of leaking the raw Mongoose error object to the client.
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      error: 'Validation Error',
      messages,
    });
  }

  // Mongoose CastError happens when an ObjectId-shaped param/body value is
  // malformed in a way validateTaskId didn't already catch.
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: 'Invalid Data',
      message: `Invalid value for field "${err.path}": ${err.value}`,
    });
  }

  // ...anything else: never leak the raw stack trace to the client.
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    status,
    message: err.message || 'Something went wrong',
    timestamp: new Date().toISOString(),
  });
}

module.exports = errorHandler;