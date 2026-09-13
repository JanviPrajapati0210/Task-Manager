// Route-specific middleware that validates :id is a well-formed Mongo
// ObjectId BEFORE it ever reaches the controller. Previously checked for a
// positive integer (Practical 4); now IDs are Mongoose ObjectIds.
const mongoose = require('mongoose');

function validateTaskId(req, res, next) {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid Task ID' });
  }
  next();
}

module.exports = validateTaskId;