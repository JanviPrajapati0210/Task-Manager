const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const User = require('../models/User');
const Task = require('../models/Task');
const notificationEmitter = require('../utils/notificationEmitter');

require('../server');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTimingBenchmark() {
  await sleep(1500);
  await mongoose.connect(process.env.MONGO_URI);

  const user = (await User.findOne({ email: 'test@example.com' })) || (await User.findOne());
  const token = jwt.sign(
    { id: user._id, role: user.role, email: user.email, username: user.username },
    process.env.JWT_SECRET || 'fallback_secret',
    { expiresIn: '1h' }
  );

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const results = [];
  const createdIds = [];

  console.log('\nCollecting 5 sample readings for POST /tasks with 2000ms background notification simulation...\n');

  for (let i = 1; i <= 5; i++) {
    const title = `Benchmark Notification Task #${i}`;
    const start = process.hrtime.bigint();

    const res = await fetch('http://localhost:5000/tasks', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title,
        priority: 'medium',
        status: 'pending',
      }),
    });

    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    const data = await res.json();
    if (data?.task?._id) createdIds.push(data.task._id);

    results.push({
      Sample: `#${i}`,
      'API Response (ms)': parseFloat(elapsedMs.toFixed(2)),
      'HTTP Status': res.status,
      'Background Delay': '2000ms (Async EventEmitter)',
      'Response Blocked?': elapsedMs < 2000 ? 'NO (Instant)' : 'YES (Blocked)',
    });

    await sleep(200);
  }

  console.table(results);

  // Clean up benchmark tasks
  for (const id of createdIds) {
    await Task.findByIdAndDelete(id);
  }

  // Wait for handlers to complete so console clears
  await sleep(2500);
  process.exit(0);
}

runTimingBenchmark().catch((err) => {
  console.error(err);
  process.exit(1);
});
