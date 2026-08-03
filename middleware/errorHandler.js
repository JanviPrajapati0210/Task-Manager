
function errorHandler(err, req, res, next) {
  
  console.error(err.stack);


  const status = err.status || 500;
  res.status(status).json({
    success: false,
    status,
    message: err.message || 'Something went wrong',
    timestamp: new Date().toISOString(),
  });
}

module.exports = errorHandler;
