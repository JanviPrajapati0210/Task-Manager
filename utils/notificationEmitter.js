const EventEmitter = require('events');

/**
 * Background Notification System using Node.js built-in EventEmitter
 *
 * Requirements:
 * 1. Emits 'task-created' on task creation, handled asynchronously without blocking the API response.
 * 2. Event handler logs task title, timestamp, assigned user.
 * 3. Simulates a slow notification handler (2000ms delay) while API response returns immediately.
 * 4. Emits 'task-deleted' on task deletion with its own listener logging a distinct message.
 * 5. Emits 'error' and has an error event listener that catches and logs any errors thrown inside handlers.
 */
class NotificationEmitter extends EventEmitter {
  constructor(options = {}) {
    super({ captureRejections: true, ...options });

    // Configurable slow handler simulation delay (default 2000ms = 2s)
    this.delayMs = options.delayMs !== undefined ? options.delayMs : 2000;

    // In-memory audit log for inspection and verification
    this.logs = [];

    // Metrics tracking
    this.stats = {
      taskCreatedCount: 0,
      taskDeletedCount: 0,
      errorCount: 0,
    };

    // Register event listeners
    this.registerListeners();
  }

  /**
   * Helper to append an entry to in-memory notification logs
   */
  recordLog(entry) {
    this.logs.unshift(entry);
    // Keep last 100 entries
    if (this.logs.length > 100) {
      this.logs.pop();
    }
  }

  getLogs() {
    return [...this.logs];
  }

  getStats() {
    return {
      ...this.stats,
      delayMs: this.delayMs,
      activeLogsCount: this.logs.length,
    };
  }

  clearLogs() {
    this.logs = [];
    this.stats = {
      taskCreatedCount: 0,
      taskDeletedCount: 0,
      errorCount: 0,
    };
  }

  setDelay(ms) {
    const parsed = parseInt(ms, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      throw new Error('delayMs must be a non-negative integer.');
    }
    this.delayMs = parsed;
    return this.delayMs;
  }

  getDelay() {
    return this.delayMs;
  }

  /**
   * Register core event listeners
   */
  registerListeners() {
    // ------------------------------------------------------------------------
    // 1. 'task-created' listener: Handled asynchronously (non-blocking)
    // ------------------------------------------------------------------------
    this.on('task-created', (data) => {
      // Use setImmediate to ensure the handler is completely decoupled
      // from the synchronous request/response call stack
      setImmediate(async () => {
        try {
          // Simulate slow background notification processing (2000ms)
          if (this.delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, this.delayMs));
          }

          // Support error simulation for testing the error event listener
          if (data && data.simulateError) {
            throw new Error(
              `Simulated notification processing error for task: "${data.task?.title || 'Unknown Task'}"`
            );
          }

          const task = data?.task || {};
          const title = task.title || 'Untitled Task';
          const timestamp = data?.timestamp || new Date().toISOString();

          // Resolve assigned user from populated user doc or raw id
          const assignedUser =
            task.user?.username ||
            task.user?.email ||
            data?.user?.username ||
            data?.user?.email ||
            (typeof task.user === 'string' ? task.user : 'Unassigned');

          this.stats.taskCreatedCount++;

          const formattedMessage = `[Background Notification] Task Created: "${title}" | Timestamp: ${timestamp} | Assigned User: ${assignedUser}`;

          console.log(formattedMessage);

          this.recordLog({
            id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            event: 'task-created',
            title,
            timestamp,
            assignedUser,
            taskId: task._id || null,
            message: formattedMessage,
            processedAt: new Date().toISOString(),
          });
        } catch (err) {
          // Catch and forward any error thrown inside the handler to the 'error' listener
          this.emit('error', err);
        }
      });
    });

    // ------------------------------------------------------------------------
    // 2. 'task-deleted' listener: Logs distinct notification message
    // ------------------------------------------------------------------------
    this.on('task-deleted', (data) => {
      setImmediate(async () => {
        try {
          const task = data?.task || {};
          const title = task.title || 'Untitled Task';
          const taskId = task._id || data?.taskId || 'Unknown ID';
          const timestamp = data?.timestamp || new Date().toISOString();

          const deletedBy =
            data?.user?.username ||
            data?.user?.email ||
            task.user?.username ||
            task.user?.email ||
            'User';

          this.stats.taskDeletedCount++;

          const formattedMessage = `[Background Notification] Task Deleted: "${title}" (ID: ${taskId}) | Timestamp: ${timestamp} | Action By: ${deletedBy}`;

          console.log(formattedMessage);

          this.recordLog({
            id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            event: 'task-deleted',
            title,
            taskId,
            timestamp,
            deletedBy,
            message: formattedMessage,
            processedAt: new Date().toISOString(),
          });
        } catch (err) {
          this.emit('error', err);
        }
      });
    });

    // ------------------------------------------------------------------------
    // 3. 'error' listener: Catches and logs any errors thrown in handlers
    // ------------------------------------------------------------------------
    this.on('error', (err) => {
      this.stats.errorCount++;

      const errorMessage = `[Notification System Error] ${err && err.message ? err.message : String(err)}`;

      console.error(errorMessage);

      this.recordLog({
        id: `err-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        event: 'error',
        message: errorMessage,
        stack: err && err.stack ? err.stack : undefined,
        timestamp: new Date().toISOString(),
      });
    });
  }
}

// Singleton instance
const notificationEmitter = new NotificationEmitter();

module.exports = notificationEmitter;
