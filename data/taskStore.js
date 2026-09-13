// In-memory "database" for tasks.
// Swap this module out for a real DB layer later without touching controllers much.

let tasks = [
  { id: 1, title: 'Setup project repo', completed: false },
  { id: 2, title: 'Design API routes', completed: true },
];

let nextId = 3;

module.exports = {
  getAll: () => tasks,
  getById: (id) => tasks.find((t) => t.id === id),
  create: (title) => {
    const task = { id: nextId++, title, completed: false };
    tasks.push(task);
    return task;
  },
  update: (id, updates) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return null;
    if (updates.title !== undefined) task.title = updates.title;
    if (updates.completed !== undefined) task.completed = updates.completed;
    return task;
  },
  remove: (id) => {
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) return false;
    tasks.splice(index, 1);
    return true;
  },
};
