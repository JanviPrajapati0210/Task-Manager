const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const requestLogger = require('./middleware/logger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const taskRoutes = require('./routes/tasks');

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

// 2. Global logging middleware - runs for every request
app.use(requestLogger);

// 3. Serve the frontend UI (public/index.html, style.css, script.js)
app.use(express.static(path.join(__dirname, 'public')));

// 4. API routes
app.use('/tasks', taskRoutes);

// 5. 404 handler - catches anything that didn't match a route above
app.use(notFound);

// 6. Global error handler - ALWAYS LAST
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Task Manager API running on http://localhost:${PORT}`);
});

module.exports = app; // exported for potential testing (supertest etc.)