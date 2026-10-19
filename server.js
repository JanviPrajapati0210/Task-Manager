const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const requestLogger = require('./middleware/logger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const taskRoutes = require('./routes/tasks');
const authRoutes = require('./routes/auth');
const taskCache = require('./utils/cache');
const notificationEmitter = require('./utils/notificationEmitter');

const app = express();
const PORT = process.env.PORT || 5000;

// --- MongoDB connection (Practical 5) ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

// --- Pipeline order matters! ---

// 1. Built-in body parser so req.body works on POST/PUT
app.use(express.json());

// 2. CORS - allows the React dev server (localhost:5173) to call this API (Practical 6)
app.use(cors());

// 3. Global logging middleware - runs for every request
app.use(requestLogger);

// 4. Serve the frontend UI (public/index.html, style.css, script.js)
app.use(express.static(path.join(__dirname, 'public')));

// 5. Cache debug endpoints (Public debug inspection)
app.get('/cache/stats', (req, res) => res.status(200).json(taskCache.getStats()));
app.post('/cache/reset', (req, res) => {
  taskCache.resetStats();
  res.status(200).json({ message: 'Cache and statistics reset successfully', ...taskCache.getStats() });
});
app.post('/cache/ttl', (req, res) => {
  try {
    const { ttl } = req.body || {};
    if (ttl === undefined) {
      return res.status(400).json({ error: 'Validation Error', message: 'ttl parameter is required (in seconds).' });
    }
    const newTTL = taskCache.setTTL(ttl);
    res.status(200).json({ message: `Cache TTL updated to ${newTTL} seconds`, ttlSeconds: newTTL });
  } catch (err) {
    res.status(400).json({ error: 'Validation Error', message: err.message });
  }
});

// 5b. Notification debug endpoints (Public debug inspection)
app.get('/notifications/logs', (req, res) => {
  res.status(200).json({
    stats: notificationEmitter.getStats(),
    logs: notificationEmitter.getLogs(),
  });
});
app.post('/notifications/reset', (req, res) => {
  notificationEmitter.clearLogs();
  res.status(200).json({
    message: 'Notification logs and metrics reset successfully',
    ...notificationEmitter.getStats(),
  });
});

// 6. Auth routes (Practical 7) - register/login are public, /me is protected internally
app.use('/auth', authRoutes);

// 7. Task routes - ALL protected by JWT auth middleware (Practical 7)
app.use('/tasks', taskRoutes);

// 7. 404 handler - catches anything that didn't match a route above
app.use(notFound);

// 8. Global error handler - ALWAYS LAST
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Task Manager API running on http://localhost:${PORT}`);
});

module.exports = app;