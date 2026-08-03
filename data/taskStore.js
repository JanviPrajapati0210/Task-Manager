
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'tasks.json');

function loadTasks() {
  if (!fs.existsSync(DATA_FILE)) {
    const seed = [
      { id: 1, title: 'Flask Learning', completed: false },
      { id: 2, title: 'Portfolio Created', completed: true },
    ];
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  return raw.trim() ? JSON.parse(raw) : [];
}

function saveTasks(tasks) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2));
}

let tasks = loadTasks();

function nextId() {
  return tasks.length ? Math.max(...tasks.map((t) => t.id)) + 1 : 1;
}

module.exports = {
  getAll: () => tasks,

  getById: (id) => tasks.find((t) => t.id === id),

  create: (title, completed = false) => {
    const task = { id: nextId(), title, completed };
    tasks.push(task);
    saveTasks(tasks);
    return task;
  },

  update: (id, updates) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return null;
    if (updates.title !== undefined) task.title = updates.title;
    if (updates.completed !== undefined) task.completed = updates.completed;
    saveTasks(tasks);
    return task;
  },

  remove: (id) => {
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) return false;
    tasks.splice(index, 1);
    saveTasks(tasks);
    return true;
  },
};
