const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
    },
    description: {
      type: String,
      default: '',
    },
    completed: {
      type: Boolean,
      default: false,
    },
    // Supplementary Problem 1: enum-restricted priority field
    priority: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high'],
        message: 'priority must be one of: low, medium, high',
      },
      default: 'medium',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Makes the "id" virtual (string version of _id) show up in res.json()
    // output, so the existing public/script.js (which reads task.id)
    // keeps working with zero frontend changes.
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Supplementary Problem 2: trim whitespace from title before saving.
// Runs on .save() / Task.create() — NOT on findByIdAndUpdate by default,
// which is why the controller also trims on update.
taskSchema.pre('save', function (next) {
  if (this.title) {
    this.title = this.title.trim();
  }
  next();
});

module.exports = mongoose.model('Task', taskSchema);