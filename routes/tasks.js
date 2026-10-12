const express = require('express');
const router = express.Router();

const controller = require('../controllers/taskController');
const validateContentType = require('../middleware/validateContentType');
const validateTaskId = require('../middleware/validateTaskId');
const validateTask = require('../middleware/validateTask');
const requireAuth = require('../middleware/auth');

// Every task route below requires a valid JWT (Practical 7 requirement)
router.use(requireAuth);

// GET /tasks         -> list tasks (own tasks; admin/manager see everyone's)
router.get('/', controller.getAllTasks);

// NOTE: the fixed-path routes below MUST come before '/:id',
// otherwise Express would treat "report" / "download" as a task id.

// GET /tasks/report/stats          -> counts + completion rate (optional date range)
router.get('/report/stats', controller.getTaskStats);

// GET /tasks/report/pdf            -> PDF report (date range is admin-only)
router.get('/report/pdf', controller.downloadTasksPDF);

// GET /tasks/download/:status      -> PDF of tasks with one status
router.get('/download/:status', controller.downloadTasksPDF);

// GET /tasks/:id      -> get one task (id format checked first)
router.get('/:id', validateTaskId, controller.getTaskById);

// POST /tasks         -> create a task (Content-Type + body validated first)
router.post('/', validateContentType, validateTask, controller.createTask);

// PUT /tasks/:id      -> update a task (id format + Content-Type + body validated first)
router.put('/:id', validateTaskId, validateContentType, validateTask, controller.updateTask);

// DELETE /tasks/:id   -> delete a task (id format checked first)
router.delete('/:id', validateTaskId, controller.deleteTask);

module.exports = router;