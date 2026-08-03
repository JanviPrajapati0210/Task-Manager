const store = require('../data/taskStore');


function getAllTasks(req, res) {
  res.status(200).json(store.getAll());
}


function getTaskById(req, res) {
  const id = Number(req.params.id);
  const task = store.getById(id);

  if (!task) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }
  res.status(200).json(task);
}


function createTask(req, res, next) {
  try {
    const { title, completed } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'title is required and must be a non-empty string' });
    }

    const task = store.create(title.trim(), Boolean(completed));
    res.status(201).json({ message: 'Task Created Successfully', task });
  } catch (err) {
    next(err); 
  }
}

function updateTask(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { title, completed } = req.body;

    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      return res.status(400).json({ error: 'title must be a non-empty string' });
    }
    if (completed !== undefined && typeof completed !== 'boolean') {
      return res.status(400).json({ error: 'completed must be a boolean' });
    }

    const updated = store.update(id, { title, completed });
    if (!updated) {
      return res.status(404).json({ error: `Task ${id} not found` });
    }
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

function deleteTask(req, res) {
  const id = Number(req.params.id);
  const deleted = store.remove(id);

  if (!deleted) {
    return res.status(404).json({ error: `Task ${id} not found` });
  }
  res.status(200).json({ message: `Task ${id} deleted` });
}

module.exports = { getAllTasks, getTaskById, createTask, updateTask, deleteTask };
