function validateTaskId(req, res, next) {
  const { id } = req.params;
  if (!/^[0-9a-fA-F]{24}$/.test(id)) {
    return res.status(400).json({
      error: `Invalid task id format: "${id}". Expected a 24-character MongoDB ObjectId.`,
    });
  }
  next();
}

module.exports = validateTaskId;