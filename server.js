const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const requestLogger = require('./middleware/logger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const taskRoutes = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// --- Pipeline order matters! ---

// 1. Built-in body parser so req.body works on POST/PUT
app.use(express.json());

// 2. Global logging middleware - runs for every request
app.use(requestLogger);

// 3. Routes
app.use('/tasks', taskRoutes);

// simple health check, handy for quick sanity testing
app.get('/', (req, res) => {
  res.status(200).json({ status: 'Task Manager API is running' });
});

// 4. 404 handler - catches anything that didn't match a route above
app.use(notFound);

// 5. Global error handler - ALWAYS LAST
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app; // exported for potential testing (supertest etc.)
