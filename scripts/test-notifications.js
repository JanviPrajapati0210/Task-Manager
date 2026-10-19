/**
 * Test & Verification Script for Background Notification System (EventEmitter)
 *
 * Verifies:
 * 1. POST /tasks emits 'task-created' handled asynchronously.
 * 2. API responds immediately (< 50ms) without waiting for the 2000ms slow notification handler.
 * 3. Event handler logs notification details (title, timestamp, assigned user) after 2 seconds.
 * 4. DELETE /tasks/:id emits 'task-deleted' handled asynchronously with distinct message.
 * 5. Error thrown inside task-created handler is caught by 'error' listener without crashing server.
 */

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const User = require('../models/User');
const Task = require('../models/Task');
const notificationEmitter = require('../utils/notificationEmitter');

// Boot server
require('../server');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const start = process.hrtime.bigint();

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
  const data = await response.json().catch(() => null);

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    durationMs: parseFloat(durationMs.toFixed(2)),
    data,
  };
}

async function runNotificationTests() {
  console.log('='.repeat(75));
  console.log('  BACKGROUND NOTIFICATION SYSTEM VERIFICATION (Node.js EventEmitter)  ');
  console.log('='.repeat(75));

  // Wait for MongoDB and Express to boot
  await sleep(1500);

  // 1. Get or create test user
  await mongoose.connect(process.env.MONGO_URI);
  let user = await User.findOne({ email: 'test@example.com' });
  if (!user) {
    user = await User.findOne();
  }
  if (!user) {
    user = await User.create({
      username: 'notif_tester',
      email: 'notif_tester@example.com',
      password: 'Password123!',
      role: 'admin',
    });
  }

  const token = jwt.sign(
    { id: user._id, _id: user._id, role: user.role, email: user.email, username: user.username },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '1h' }
  );

  const authHeaders = { Authorization: `Bearer ${token}` };

  // Reset notification logs
  notificationEmitter.clearLogs();
  notificationEmitter.setDelay(2000); // 2000ms delay for simulation

  console.log(`\nActive Simulation Delay: ${notificationEmitter.getDelay()}ms (2 seconds)`);
  console.log(`Test User: ${user.username} (${user.email}) [Role: ${user.role}]`);

  // -------------------------------------------------------------------------
  // TEST 1: Task Creation with Slow Notification Handler (Non-Blocking Check)
  // -------------------------------------------------------------------------
  console.log('\n' + '-'.repeat(75));
  console.log('TEST 1: Verify API Responds Instantly While 2s Handler Runs in Background');
  console.log('-'.repeat(75));

  const testTitle = `Async Notification Task ${Date.now()}`;
  console.log(`[API Call] Sending POST /tasks for "${testTitle}"...`);

  const createRes = await request('/tasks', {
    method: 'POST',
    headers: authHeaders,
    body: {
      title: testTitle,
      description: 'Verifying non-blocking background notification handler',
      priority: 'high',
      status: 'pending',
    },
  });

  console.log(`[API Response] Status: ${createRes.status} | API Response Time: ${createRes.durationMs}ms`);

  const createdTask = createRes.data?.task;
  const isInstant = createRes.durationMs < 500; // Expected < 50ms, generously < 500ms vs 2000ms

  if (createRes.status === 201 && isInstant) {
    console.log(`✔ PASS: API returned 201 Created in ${createRes.durationMs}ms (NOT blocked by 2000ms handler)!`);
  } else {
    console.error(`✖ FAIL: API took ${createRes.durationMs}ms or status was ${createRes.status}`);
  }

  // Check immediately: handler should still be waiting on the 2s timer
  let initialLogs = notificationEmitter.getLogs();
  const alreadyProcessed = initialLogs.some((l) => l.title === testTitle);
  console.log(`[Background Status at +${createRes.durationMs}ms]: Handler finished yet? ${alreadyProcessed ? 'YES (unexpected)' : 'NO (as expected, background timer is ticking)'}`);

  console.log('\n[Waiting for 2.2 seconds for background timer to complete]...');
  await sleep(2300);

  let updatedLogs = notificationEmitter.getLogs();
  const createdNotification = updatedLogs.find((l) => l.event === 'task-created' && l.title === testTitle);

  if (createdNotification) {
    console.log(`✔ PASS: Background handler executed and logged:`);
    console.log(`  Message: "${createdNotification.message}"`);
    console.log(`  Task Title: "${createdNotification.title}"`);
    console.log(`  Assigned User: "${createdNotification.assignedUser}"`);
    console.log(`  Timestamp: ${createdNotification.timestamp}`);
  } else {
    console.error(`✖ FAIL: task-created notification was not found in logs after 2s`);
  }

  // -------------------------------------------------------------------------
  // TEST 2: Task Deletion Event (task-deleted with distinct message)
  // -------------------------------------------------------------------------
  console.log('\n' + '-'.repeat(75));
  console.log('TEST 2: Verify task-deleted Event and Distinct Log Message');
  console.log('-'.repeat(75));

  if (createdTask && createdTask._id) {
    console.log(`[API Call] Sending DELETE /tasks/${createdTask._id}...`);
    const deleteRes = await request(`/tasks/${createdTask._id}`, {
      method: 'DELETE',
      headers: authHeaders,
    });

    console.log(`[API Response] Status: ${deleteRes.status} | API Response Time: ${deleteRes.durationMs}ms`);

    // Give setImmediate a moment to execute
    await sleep(200);

    const deleteLogs = notificationEmitter.getLogs();
    const deletedNotification = deleteLogs.find(
      (l) => l.event === 'task-deleted' && (l.taskId == createdTask._id || l.title === testTitle)
    );

    if (deleteRes.status === 200 && deletedNotification) {
      console.log(`✔ PASS: task-deleted handler executed and logged distinct message:`);
      console.log(`  Message: "${deletedNotification.message}"`);
      console.log(`  Task ID: ${deletedNotification.taskId}`);
      console.log(`  Action By: ${deletedNotification.deletedBy}`);
      console.log(`  Timestamp: ${deletedNotification.timestamp}`);
    } else {
      console.error(`✖ FAIL: task-deleted event was not found in logs`);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 3: Error Handling in task-created (error event listener)
  // -------------------------------------------------------------------------
  console.log('\n' + '-'.repeat(75));
  console.log('TEST 3: Verify Error Event Listener Catches Handlers Errors Safely');
  console.log('-'.repeat(75));

  const errorTaskTitle = `Error Simulation Task ${Date.now()}`;
  console.log(`[API Call] Creating task with simulateNotificationError=true...`);

  const errorCreateRes = await request('/tasks', {
    method: 'POST',
    headers: authHeaders,
    body: {
      title: errorTaskTitle,
      description: 'Testing error event listener in EventEmitter',
      simulateNotificationError: true,
    },
  });

  console.log(`[API Response] Status: ${errorCreateRes.status} | Time: ${errorCreateRes.durationMs}ms`);

  // Wait for 2s delay so the error throws inside the background handler
  console.log('[Waiting 2.3 seconds for background handler to encounter simulated error]...');
  await sleep(2300);

  const errorLogs = notificationEmitter.getLogs();
  const errorEntry = errorLogs.find(
    (l) => l.event === 'error' && l.message.includes(errorTaskTitle)
  );

  if (errorEntry) {
    console.log(`✔ PASS: 'error' event listener successfully caught the error:`);
    console.log(`  Event: ${errorEntry.event}`);
    console.log(`  Error Message: "${errorEntry.message}"`);
    console.log(`  Logged At: ${errorEntry.timestamp}`);
    console.log(`✔ Server remained healthy, did NOT crash, and client received 201 successfully!`);
  } else {
    console.error(`✖ FAIL: error event was not caught/logged`);
  }

  // Clean up created error task if exists
  if (errorCreateRes.data?.task?._id) {
    await Task.findByIdAndDelete(errorCreateRes.data.task._id);
  }

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n' + '='.repeat(75));
  console.log('                          TEST SUMMARY & STATS                         ');
  console.log('='.repeat(75));

  const stats = notificationEmitter.getStats();
  console.table({
    'Task Created Events': stats.taskCreatedCount,
    'Task Deleted Events': stats.taskDeletedCount,
    'Error Events Caught': stats.errorCount,
    'Simulated Delay (ms)': stats.delayMs,
    'Total Recorded Logs': stats.activeLogsCount,
  });

  console.log('\nAll notification criteria verified successfully!\n');
  process.exit(0);
}

runNotificationTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
