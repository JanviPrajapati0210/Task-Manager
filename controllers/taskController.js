const PDFDocument = require('pdfkit');
const Task = require('../models/Task');
const { sendTaskCompletedEmail } = require('../utils/taskEmail');
const taskCache = require('../utils/cache');

const VALID_STATUSES = ['pending', 'in-progress', 'completed'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

// Status workflow is forward-only: pending -> in-progress -> completed
const STATUS_RANKS = { pending: 1, 'in-progress': 2, completed: 3 };

// Which fields of the task owner are sent along with a task
const OWNER_FIELDS = 'username email role';

// Admins and managers can see/manage everyone's tasks; normal users only their own
const isStaff = (user) => user.role === 'admin' || user.role === 'manager';

const badRequest = (res, message) =>
  res.status(400).json({ error: 'Validation Error', message });

const notFound = (res, id) =>
  res.status(404).json({
    error: 'Not Found',
    message: `Task with id ${id} does not exist.`,
  });

// Turns ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD into a MongoDB date filter.
// endDate is inclusive (we move it to the end of that day).
function buildDateRange(startDate, endDate) {
  if (!startDate && !endDate) return { range: null };

  const range = {};
  if (startDate) {
    const start = new Date(startDate);
    if (Number.isNaN(start.getTime())) return { error: 'Invalid start date.' };
    range.$gte = start;
  }
  if (endDate) {
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) return { error: 'Invalid end date.' };
    end.setUTCHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return { range };
}

// Who's tasks a report covers (shared by the stats and PDF endpoints):
//  - normal users: always their own tasks
//  - admin/manager: their own, a specific ?userId=, or everyone with ?allUsers=true
function reportScope(req) {
  const { userId, allUsers } = req.query;
  const staff = isStaff(req.user);
  const query = {};
  if (!staff || allUsers !== 'true') {
    query.user = staff && userId ? userId : req.user._id;
  }
  return { query, showOwner: staff && allUsers === 'true' };
}

// GET /tasks
async function getAllTasks(req, res, next) {
  const startTime = process.hrtime.bigint();
  try {
    const cacheKey = taskCache.makeAllTasksKey(req);
    const cached = taskCache.get('allTasks', cacheKey);
    if (cached) {
      const elapsedMs = (Number(process.hrtime.bigint() - startTime) / 1e6).toFixed(2);
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-TTL', `${taskCache.getTTL()}s`);
      res.setHeader('X-Response-Time', `${elapsedMs}ms`);
      return res.status(200).json(cached);
    }

    const { status, priority, startDate, endDate, userId, self } = req.query;
    const query = {};

    // Role-based scope
    if (!isStaff(req.user) || self === 'true') {
      query.user = req.user._id;
    } else if (userId) {
      query.user = userId;
    }

    if (VALID_STATUSES.includes(status)) query.status = status;
    if (VALID_PRIORITIES.includes(priority)) query.priority = priority;

    const { range, error } = buildDateRange(startDate, endDate);
    if (error) return badRequest(res, error);
    if (range) query.createdAt = range;

    const tasks = await Task.find(query).populate('user', OWNER_FIELDS).sort({ createdAt: -1 });
    taskCache.set('allTasks', cacheKey, tasks);

    const elapsedMs = (Number(process.hrtime.bigint() - startTime) / 1e6).toFixed(2);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Cache-TTL', `${taskCache.getTTL()}s`);
    res.setHeader('X-Response-Time', `${elapsedMs}ms`);
    res.status(200).json(tasks);
  } catch (err) {
    next(err);
  }
}

// GET /tasks/:id
async function getTaskById(req, res, next) {
  const startTime = process.hrtime.bigint();
  try {
    const cacheKey = taskCache.makeSingleTaskKey(req);
    const cached = taskCache.get('singleTask', cacheKey);
    if (cached) {
      const elapsedMs = (Number(process.hrtime.bigint() - startTime) / 1e6).toFixed(2);
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-TTL', `${taskCache.getTTL()}s`);
      res.setHeader('X-Response-Time', `${elapsedMs}ms`);
      return res.status(200).json(cached);
    }

    const query = { _id: req.params.id };
    if (!isStaff(req.user)) query.user = req.user._id;

    const task = await Task.findOne(query).populate('user', OWNER_FIELDS);
    if (!task) return notFound(res, req.params.id);

    taskCache.set('singleTask', cacheKey, task);

    const elapsedMs = (Number(process.hrtime.bigint() - startTime) / 1e6).toFixed(2);
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('X-Cache-TTL', `${taskCache.getTTL()}s`);
    res.setHeader('X-Response-Time', `${elapsedMs}ms`);
    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
}

// POST /tasks
async function createTask(req, res, next) {
  try {
    const { title, description, priority, status } = req.body;

    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return badRequest(res, 'Invalid status. Must be pending, in-progress, or completed.');
    }
    if (priority !== undefined && !VALID_PRIORITIES.includes(priority)) {
      return badRequest(res, 'Invalid priority. Must be low, medium, or high.');
    }

    const taskStatus = status || 'pending';
    const assignedUser = isStaff(req.user) && req.body.userId ? req.body.userId : req.user._id;

    const task = await Task.create({
      user: assignedUser,
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : '',
      priority: priority || 'medium',
      status: taskStatus,
      completed: taskStatus === 'completed',
    });
    await task.populate('user', OWNER_FIELDS);

    // Invalidate collection caches on write operation (POST)
    taskCache.invalidateAllTasks('create_task');

    // Created directly as completed -> send the notification email
    if (task.status === 'completed') {
      sendTaskCompletedEmail(req.user, task).catch((err) =>
        console.error('Task completion email error:', err.message)
      );
    }

    res.status(201).json({ message: 'Task Created Successfully', task });
  } catch (err) {
    next(err);
  }
}

// PUT /tasks/:id
async function updateTask(req, res, next) {
  try {
    const { title, description, priority } = req.body;
    let { status } = req.body;

    // Older clients send `completed` instead of `status`
    if (status === undefined && req.body.completed !== undefined) {
      status = req.body.completed ? 'completed' : 'pending';
    }

    // Normal users can only touch their own tasks; admin/manager can touch any
    const scope = { _id: req.params.id };
    if (!isStaff(req.user)) scope.user = req.user._id;

    const existing = await Task.findOne(scope);
    if (!existing) return notFound(res, req.params.id);

    const updates = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined && typeof description === 'string') {
      updates.description = description.trim();
    }

    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) {
        return badRequest(res, 'Invalid priority. Must be low, medium, or high.');
      }
      updates.priority = priority;
    }

    let becameCompleted = false;
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return badRequest(res, 'Invalid status. Must be pending, in-progress, or completed.');
      }

      // Forward-only workflow: a task can never move backwards
      if (STATUS_RANKS[status] < STATUS_RANKS[existing.status || 'pending']) {
        return badRequest(
          res,
          `Tasks cannot move backwards from '${existing.status}' to '${status}'. ` +
            'The workflow is forward-only: Pending -> In Progress -> Completed.'
        );
      }

      updates.status = status;
      updates.completed = status === 'completed';
      becameCompleted = existing.status !== 'completed' && status === 'completed';
    }

    const updated = await Task.findOneAndUpdate(scope, updates, {
      new: true,
      runValidators: true,
    }).populate('user', OWNER_FIELDS);

    // Invalidate single task cache and all list caches on write operation (PUT)
    taskCache.invalidateSingleTask(req.params.id, 'update_task');

    // Email the task OWNER when their task transitions to completed
    if (becameCompleted) {
      sendTaskCompletedEmail(updated.user || req.user, updated).catch((err) =>
        console.error('Task completion email error:', err.message)
      );
    }

    res.status(200).json({ task: updated });
  } catch (err) {
    next(err);
  }
}

// DELETE /tasks/:id
async function deleteTask(req, res, next) {
  try {
    const scope = { _id: req.params.id };
    if (!isStaff(req.user)) scope.user = req.user._id;

    const deleted = await Task.findOneAndDelete(scope);
    if (!deleted) return notFound(res, req.params.id);

    // Invalidate single task cache and all list caches on write operation (DELETE)
    taskCache.invalidateSingleTask(req.params.id, 'delete_task');

    res.status(200).json({ message: 'Task deleted successfully.', task: deleted });
  } catch (err) {
    next(err);
  }
}

// GET /tasks/report/stats?startDate=&endDate=&status=&userId=&allUsers=true
async function getTaskStats(req, res, next) {
  try {
    const { startDate, endDate, status } = req.query;
    const { query } = reportScope(req);

    const { range, error } = buildDateRange(startDate, endDate);
    if (error) return badRequest(res, error);
    if (range) query.createdAt = range;
    if (VALID_STATUSES.includes(status)) query.status = status;

    const [total, pending, inProgress, completed] = await Promise.all([
      Task.countDocuments(query),
      Task.countDocuments({ ...query, status: 'pending' }),
      Task.countDocuments({ ...query, status: 'in-progress' }),
      Task.countDocuments({ ...query, status: 'completed' }),
    ]);

    res.status(200).json({
      stats: {
        total,
        pending,
        inProgress,
        completed,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        dateRange: { startDate: startDate || null, endDate: endDate || null },
      },
    });
  } catch (err) {
    next(err);
  }
}

function labelValue(doc, label, value, y) {
  doc
    .fillColor('#1e293b')
    .fontSize(10)
    .font('Helvetica-Bold')
    .text(`${label}: `, 40, y, { continued: true })
    .font('Helvetica')
    .text(value);
}

// GET /tasks/report/pdf   or   GET /tasks/download/:status
// Optional query: status, priority, startDate, endDate, userId, allUsers=true
async function downloadTasksPDF(req, res, next) {
  try {
    const { startDate, endDate, priority } = req.query;
    const selectedStatus = req.params.status || req.query.status;

    // Date-range reports are admin-only
    if ((startDate || endDate) && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only administrators can generate date-range reports.',
      });
    }

    if (selectedStatus && !VALID_STATUSES.includes(selectedStatus)) {
      return badRequest(res, 'Invalid status. Must be pending, in-progress, or completed.');
    }

    const { query, showOwner } = reportScope(req);
    if (selectedStatus) query.status = selectedStatus;
    if (VALID_PRIORITIES.includes(priority)) query.priority = priority;

    let dateRangeLabel = 'All Time';
    const { range, error } = buildDateRange(startDate, endDate);
    if (error) return badRequest(res, error);
    if (range) {
      query.createdAt = range;
      if (startDate && endDate) dateRangeLabel = `${startDate} to ${endDate}`;
      else if (startDate) dateRangeLabel = `From ${startDate}`;
      else dateRangeLabel = `Until ${endDate}`;
    }

    const tasks = await Task.find(query).populate('user', OWNER_FIELDS).sort({ createdAt: -1 });

    const total = tasks.length;
    const pending = tasks.filter((t) => t.status === 'pending').length;
    const inProgress = tasks.filter((t) => t.status === 'in-progress').length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // bufferPages lets us go back and write "Page X of Y" on every page
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="task-report-${selectedStatus || 'all'}-${Date.now()}.pdf"`
    );
    doc.pipe(res);

    // ----- Header banner -----
    doc.rect(0, 0, doc.page.width, 90).fill('#4f46e5');
    doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('TASK MANAGER', 40, 25);
    doc
      .fontSize(11)
      .font('Helvetica')
      .fillColor('#e0e7ff')
      .text('Task Progress Report', 40, 52);

    // ----- Metadata -----
    const who = req.user.username || req.user.name || req.user.email;
    labelValue(doc, 'Generated By', `${who} (${req.user.email}) [${req.user.role.toUpperCase()}]`, 105);
    labelValue(doc, 'Date Filter', dateRangeLabel, 122);
    labelValue(doc, 'Generated On', new Date().toLocaleString(), 139);
    doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, 160).lineTo(555, 160).stroke();

    // ----- Summary box -----
    doc.rect(40, 172, 515, 60).fillAndStroke('#f8fafc', '#cbd5e1');
    doc.fillColor('#475569').fontSize(9).font('Helvetica-Bold');
    doc.text('TOTAL TASKS', 60, 185);
    doc.text('PENDING', 165, 185);
    doc.text('IN PROGRESS', 265, 185);
    doc.text('COMPLETED', 380, 185);
    doc.text('COMPLETION', 475, 185);

    doc.fontSize(16).font('Helvetica-Bold');
    doc.fillColor('#1e293b').text(`${total}`, 60, 202);
    doc.fillColor('#eab308').text(`${pending}`, 165, 202);
    doc.fillColor('#3b82f6').text(`${inProgress}`, 265, 202);
    doc.fillColor('#10b981').text(`${completed}`, 380, 202);
    doc.fillColor('#6366f1').text(`${rate}%`, 475, 202);

    // ----- Task list -----
    doc
      .fillColor('#1e293b')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text(`Tasks (${selectedStatus ? selectedStatus.toUpperCase() : 'ALL STATUSES'})`, 40, 255);

    if (tasks.length === 0) {
      doc
        .fontSize(12)
        .font('Helvetica')
        .fillColor('#64748b')
        .text('No tasks found for the selected filters.', 40, 290, { align: 'center', width: 515 });
    } else {
      const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#10b981' };
      let y = 285;

      tasks.forEach((task, index) => {
        if (y > 720) {
          doc.addPage();
          y = 50;
        }

        doc.rect(40, y, 515, 65).fillAndStroke('#ffffff', '#e2e8f0');
        doc.rect(40, y, 4, 65).fill(PRIORITY_COLORS[task.priority] || '#64748b');

        doc
          .fillColor('#0f172a')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(`${index + 1}. ${task.title}`, 52, y + 10, { width: 490, height: 14, ellipsis: true });

        const parts = [
          `Status: ${String(task.status).toUpperCase()}`,
          `Priority: ${(task.priority || 'medium').toUpperCase()}`,
          `Created: ${new Date(task.createdAt).toLocaleDateString()}`,
        ];
        if (showOwner) {
          const owner = task.user && (task.user.username || task.user.email);
          parts.push(`Assigned: ${owner || 'unknown'}`);
        }
        doc.fontSize(9).font('Helvetica').fillColor('#475569').text(parts.join(' | '), 52, y + 28, {
          width: 490,
          height: 12,
          ellipsis: true,
        });

        doc
          .fontSize(8.5)
          .font('Helvetica-Oblique')
          .fillColor(task.description ? '#64748b' : '#94a3b8')
          .text(task.description || 'No description provided.', 52, y + 44, {
            width: 490,
            height: 12,
            ellipsis: true,
          });

        y += 75;
      });
    }

    // ----- Footer on every page -----
    const pages = doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i += 1) {
      doc.switchToPage(i);
      // Drop the bottom margin so writing near the page edge doesn't add a new page
      doc.page.margins.bottom = 0;
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#94a3b8')
        .text(`Page ${i + 1} of ${pages.count} | Task Manager report`, 40, 805, {
          align: 'center',
          width: 515,
          lineBreak: false,
        });
    }

    doc.end();
  } catch (err) {
    next(err);
  }
}

// GET /tasks/cache/stats
function getCacheStats(req, res) {
  res.status(200).json(taskCache.getStats());
}

// POST /tasks/cache/reset
function resetCacheStats(req, res) {
  taskCache.resetStats();
  res.status(200).json({
    message: 'Cache and statistics reset successfully.',
    ...taskCache.getStats(),
  });
}

// POST /tasks/cache/ttl
function setCacheTTL(req, res) {
  try {
    const { ttl } = req.body || {};
    if (ttl === undefined) {
      return badRequest(res, 'ttl parameter is required (in seconds).');
    }
    const newTTL = taskCache.setTTL(ttl);
    res.status(200).json({
      message: `Cache TTL updated to ${newTTL} seconds.`,
      ttlSeconds: newTTL,
    });
  } catch (err) {
    badRequest(res, err.message);
  }
}

module.exports = {
  getAllTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getTaskStats,
  downloadTasksPDF,
  getCacheStats,
  resetCacheStats,
  setCacheTTL,
};