const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema(
  {
    // Owner of the task. Normal users only ever see/change their own tasks.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Task user is required'],
      index: true,
    },
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
    // status field for Pending / In Progress / Completed board
    status: {
      type: String,
      enum: {
        values: ['pending', 'in-progress', 'completed'],
        message: 'status must be one of: pending, in-progress, completed',
      },
      default: 'pending',
    },
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

taskSchema.pre('save', function (next) {
  if (this.title) {
    this.title = this.title.trim();
  }
  // Keep the legacy `completed` flag in sync with `status`
  this.completed = this.status === 'completed';
  next();
});

module.exports = mongoose.model('Task', taskSchema);