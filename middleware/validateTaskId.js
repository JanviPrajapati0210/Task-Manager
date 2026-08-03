// Route-specific middleware that validates :id is a positive integer BEFORE
// it ever reaches the controller. Keeps the controller free of format checks
// and lets it assume req.params.id is already clean.
function validateTaskId(req, res, next) {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ message: 'Invalid Task ID' });
  }
  next();
}

module.exports = validateTaskId;
