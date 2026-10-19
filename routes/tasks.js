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

// Cache debug & admin endpoints (MUST come before '/:id')
// GET /tasks/cache/stats          -> inspect cache hits, misses, hit rate, and active keys
router.get('/cache/stats', controller.getCacheStats);

// POST /tasks/cache/reset         -> reset cache and metrics (useful for testing)
router.post('/cache/reset', controller.resetCacheStats);

// POST /tasks/cache/ttl           -> dynamically update TTL for experiments ({ ttl: 30 })
router.post('/cache/ttl', controller.setCacheTTL);

// Background Notification System endpoints (MUST come before '/:id')
// GET /tasks/notifications/logs    -> inspect recent background notifications & error events
router.get('/notifications/logs', controller.getNotificationLogs);

// POST /tasks/notifications/reset  -> clear notification history and stats
router.post('/notifications/reset', controller.resetNotificationLogs);

// POST /tasks/notifications/delay  -> set simulation delay in ms ({ delayMs: 2000 })
router.post('/notifications/delay', controller.setNotificationDelay);

// POST /tasks/notifications/simulate-error -> trigger error handler test
router.post('/notifications/simulate-error', controller.simulateNotificationError);

// GET /tasks/:id      -> get one task (id format checked first)
router.get('/:id', validateTaskId, controller.getTaskById);

// POST /tasks         -> create a task (Content-Type + body validated first)
router.post('/', validateContentType, validateTask, controller.createTask);

// PUT /tasks/:id      -> update a task (id format + Content-Type + body validated first)
router.put('/:id', validateTaskId, validateContentType, validateTask, controller.updateTask);

// DELETE /tasks/:id   -> delete a task (id format checked first)
router.delete('/:id', validateTaskId, controller.deleteTask);

module.exports = router;