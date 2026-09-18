// Rejects malformed task requests BEFORE they reach the database (Practical 7 requirement)
function validateTask(req, res, next) {
  const { title } = req.body;

  if (req.method === 'POST') {
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Title is required and must be a non-empty string.',
      });
    }
  }

  if (req.method === 'PUT') {
    // On update, title is optional, but if it IS provided it must still be valid
    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Title, if provided, must be a non-empty string.',
      });
    }
  }

  next();
}

module.exports = validateTask;