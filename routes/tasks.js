const express = require('express');
const router = express.Router();

const controller = require('../controllers/taskController');
const validateContentType = require('../middleware/validateContentType');
const validateTaskId = require('../middleware/validateTaskId');
const validateTask = require('../middleware/validateTask');
const requireAuth = require('../middleware/auth');

// Every task route below requires a valid JWT (Practical 7 requirement)
router.use(requireAuth);

// GET /tasks         -> list all tasks
router.get('/', controller.getAllTasks);

// GET /tasks/:id      -> get one task (id format checked first)
router.get('/:id', validateTaskId, controller.getTaskById);

// POST /tasks         -> create a task (Content-Type + body validated first)
router.post('/', validateContentType, validateTask, controller.createTask);

// PUT /tasks/:id      -> update a task (id format + Content-Type + body validated first)
router.put('/:id', validateTaskId, validateContentType, validateTask, controller.updateTask);

// DELETE /tasks/:id   -> delete a task (id format checked first)
router.delete('/:id', validateTaskId, controller.deleteTask);

module.exports = router;