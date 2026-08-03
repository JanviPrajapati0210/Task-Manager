const express = require('express');
const router = express.Router();

const controller = require('../controllers/taskController');
const validateContentType = require('../middleware/validateContentType');
const validateTaskId = require('../middleware/validateTaskId');

// GET /tasks         -> list all tasks
router.get('/', controller.getAllTasks);

// GET /tasks/:id      -> get one task (id format checked first)
router.get('/:id', validateTaskId, controller.getTaskById);

// POST /tasks         -> create a task (Content-Type checked first)
router.post('/', validateContentType, controller.createTask);

// PUT /tasks/:id      -> update a task (id format + Content-Type checked first)
router.put('/:id', validateTaskId, validateContentType, controller.updateTask);

// DELETE /tasks/:id   -> delete a task (id format checked first)
router.delete('/:id', validateTaskId, controller.deleteTask);

module.exports = router;
