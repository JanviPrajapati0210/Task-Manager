const Task = require('../models/Task');

// GET /tasks
async function getAllTasks(req, res, next) {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 });
    res.status(200).json(tasks);
  } catch (err) {
    next(err);
  }
}

// GET /tasks/:id
async function getTaskById(req, res, next) {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Task with id ${req.params.id} does not exist.`,
      });
    }
    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
}

// POST /tasks
async function createTask(req, res, next) {
  try {
    const { title, description, completed, priority, status } = req.body;
    const task = await Task.create({ title, description, completed, priority, status });
    res.status(201).json({ message: 'Task Created Successfully', task });
  } catch (err) {
    next(err);
  }
}

// PUT /tasks/:id
async function updateTask(req, res, next) {
  try {
    const { title, description, completed, priority, status } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description;
    if (completed !== undefined) updates.completed = completed;
    if (priority !== undefined) updates.priority = priority;
    if (status !== undefined) updates.status = status;

    const updated = await Task.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Task with id ${req.params.id} does not exist.`,
      });
    }
    res.status(200).json({ task: updated });
  } catch (err) {
    next(err);
  }
}

// DELETE /tasks/:id
async function deleteTask(req, res, next) {
  try {
    const deleted = await Task.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Task with id ${req.params.id} does not exist.`,
      });
    }
    res.status(200).json({ message: 'Task deleted successfully.', task: deleted });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAllTasks, getTaskById, createTask, updateTask, deleteTask };