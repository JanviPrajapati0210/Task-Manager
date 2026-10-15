const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const User = require('../models/User');
const Task = require('../models/Task');
const taskCache = require('../utils/cache');

// Boot server instance if running standalone
require('../server');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

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
    xCache: response.headers.get('x-cache'),
    durationMs: parseFloat(durationMs.toFixed(2)),
    data,
  };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runBenchmark() {
  console.log('='.repeat(70));
  console.log('       TASK MANAGER API - IN-MEMORY CACHE BENCHMARK (node-cache)      ');
  console.log('='.repeat(70));

  await sleep(1500);

  // 1. Connect to Mongo to find test user & task
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: 'test@example.com' }) || (await User.findOne());
  if (!user) {
    console.error('No test user found in DB.');
    process.exit(1);
  }

  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role || 'user' },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  const authHeaders = { Authorization: `Bearer ${token}` };

  // Ensure test user has at least one task
  let sampleTask = await Task.findOne({ user: user._id });
  if (!sampleTask) {
    sampleTask = await Task.create({
      user: user._id,
      title: 'Benchmark Sample Task',
      description: 'Used for caching performance testing',
      priority: 'high',
      status: 'pending',
    });
  }
  const sampleTaskId = sampleTask._id.toString();

  console.log(`\nAuthenticated User: ${user.email} (Role: ${user.role || 'user'})`);
  console.log(`Target Sample Task ID: ${sampleTaskId}\n`);

  // Reset cache and metrics before starting benchmark
  taskCache.resetStats();
  taskCache.setTTL(60);

  // ==========================================
  // Test 1: GET /tasks (All Tasks) Benchmark
  // ==========================================
  console.log('--- [Test 1] GET /tasks (All Tasks) Response Times ---');
  const allTasksUncached = [];
  const allTasksCached = [];

  for (let i = 1; i <= 3; i++) {
    // Reset cache before each uncached reading to guarantee DB hit
    taskCache.clearAll();
    const resUncached = await request('/tasks', { headers: authHeaders });
    allTasksUncached.push(resUncached.durationMs);

    // Immediate second call guarantees cache hit
    const resCached = await request('/tasks', { headers: authHeaders });
    allTasksCached.push(resCached.durationMs);

    console.log(
      `  Sample #${i}: Uncached (DB): ${resUncached.durationMs} ms [X-Cache: ${resUncached.xCache}] | Cached (RAM): ${resCached.durationMs} ms [X-Cache: ${resCached.xCache}]`
    );
  }

  const avgAllUncached = (allTasksUncached.reduce((a, b) => a + b, 0) / 3).toFixed(2);
  const avgAllCached = (allTasksCached.reduce((a, b) => a + b, 0) / 3).toFixed(2);
  const speedupAll = (avgAllUncached / avgAllCached).toFixed(2);
  console.log(`  >> Average Uncached: ${avgAllUncached} ms | Average Cached: ${avgAllCached} ms | Speedup: ~${speedupAll}x faster\n`);

  // ==========================================
  // Test 2: GET /tasks/:id (Single Task) Benchmark
  // ==========================================
  console.log('--- [Test 2] GET /tasks/:id (Single Task) Response Times ---');
  const singleUncached = [];
  const singleCached = [];

  for (let i = 1; i <= 3; i++) {
    taskCache.clearAll();
    const resUncached = await request(`/tasks/${sampleTaskId}`, { headers: authHeaders });
    singleUncached.push(resUncached.durationMs);

    const resCached = await request(`/tasks/${sampleTaskId}`, { headers: authHeaders });
    singleCached.push(resCached.durationMs);

    console.log(
      `  Sample #${i}: Uncached (DB): ${resUncached.durationMs} ms [X-Cache: ${resUncached.xCache}] | Cached (RAM): ${resCached.durationMs} ms [X-Cache: ${resCached.xCache}]`
    );
  }

  const avgSingleUncached = (singleUncached.reduce((a, b) => a + b, 0) / 3).toFixed(2);
  const avgSingleCached = (singleCached.reduce((a, b) => a + b, 0) / 3).toFixed(2);
  const speedupSingle = (avgSingleUncached / avgSingleCached).toFixed(2);
  console.log(`  >> Average Uncached: ${avgSingleUncached} ms | Average Cached: ${avgSingleCached} ms | Speedup: ~${speedupSingle}x faster\n`);

  // ==========================================
  // Test 3: Invalidation Verification on Writes
  // ==========================================
  console.log('--- [Test 3] Cache Invalidation on Write Operations (POST, PUT, DELETE) ---');

  // Step 3a: Warm up cache
  await request('/tasks', { headers: authHeaders });
  await request(`/tasks/${sampleTaskId}`, { headers: authHeaders });
  let statsBefore = (await request('/cache/stats')).data.data;
  console.log(`  Active keys before write: ${statsBefore.cacheEngine.keysCount}`);

  // Step 3b: POST /tasks (Create new task) -> should invalidate all-tasks cache
  const postRes = await request('/tasks', {
    method: 'POST',
    headers: authHeaders,
    body: {
      title: `Temp Benchmark Task ${Date.now()}`,
      description: 'Testing cache invalidation on POST',
      priority: 'low',
      status: 'pending',
    },
  });
  const createdTaskId = postRes.data.task._id;
  console.log(`  Created task via POST /tasks (ID: ${createdTaskId})`);

  // Verify next GET /tasks is MISS
  const afterPostFetch = await request('/tasks', { headers: authHeaders });
  console.log(`  GET /tasks after POST: X-Cache = ${afterPostFetch.xCache} (Expected: MISS -> Fresh DB query)`);

  // Step 3c: PUT /tasks/:id (Update task) -> should invalidate single task & all tasks
  // Warm up single task cache
  await request(`/tasks/${sampleTaskId}`, { headers: authHeaders });
  const putRes = await request(`/tasks/${sampleTaskId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: {
      status: 'in-progress',
    },
  });
  console.log(`  Updated task via PUT /tasks/${sampleTaskId} (Status: in-progress)`);

  const afterPutSingleFetch = await request(`/tasks/${sampleTaskId}`, { headers: authHeaders });
  const afterPutAllFetch = await request('/tasks', { headers: authHeaders });
  console.log(`  GET /tasks/:id after PUT: X-Cache = ${afterPutSingleFetch.xCache} (Expected: MISS)`);
  console.log(`  GET /tasks after PUT: X-Cache = ${afterPutAllFetch.xCache} (Expected: MISS)`);

  // Step 3d: DELETE /tasks/:id (Delete temp task) -> should invalidate single task & all tasks
  await request(`/tasks/${createdTaskId}`, { headers: authHeaders }); // warm up
  await request(`/tasks/${createdTaskId}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  console.log(`  Deleted temp task via DELETE /tasks/${createdTaskId}`);

  const afterDeleteAllFetch = await request('/tasks', { headers: authHeaders });
  console.log(`  GET /tasks after DELETE: X-Cache = ${afterDeleteAllFetch.xCache} (Expected: MISS)`);

  // ==========================================
  // Test 4: Debug Endpoint & Cache Stats Counter
  // ==========================================
  console.log('\n--- [Test 4] Cache Hit/Miss Counters & Debug Endpoint ---');
  const statsRes = await request('/cache/stats');
  const stats = statsRes.data.data;
  console.log('  Debug Endpoint Response (/cache/stats):');
  console.log(`    Total Requests Tracked: ${stats.summary.totalRequests}`);
  console.log(`    Total Hits:             ${stats.summary.hits}`);
  console.log(`    Total Misses:           ${stats.summary.misses}`);
  console.log(`    Overall Hit Rate:       ${stats.summary.hitRate}`);
  console.log(`    allTasks Breakdown:     ${stats.breakdown.allTasks.hits} hits, ${stats.breakdown.allTasks.misses} misses (Hit Rate: ${stats.breakdown.allTasks.hitRate})`);
  console.log(`    singleTask Breakdown:   ${stats.breakdown.singleTask.hits} hits, ${stats.breakdown.singleTask.misses} misses (Hit Rate: ${stats.breakdown.singleTask.hitRate})`);
  console.log(`    Invalidation Events:    ${stats.invalidationStats.invalidationEvents}`);
  console.log(`    Active Keys Count:      ${stats.cacheEngine.keysCount}`);

  // ==========================================
  // Test 5: TTL Experiments (Staleness vs Performance)
  // ==========================================
  console.log('\n--- [Test 5] TTL Experiments (Perceived Staleness vs Performance) ---');

  // Test with short TTL (2 seconds)
  console.log('  Testing Short TTL = 2s...');
  await request('/cache/ttl', { method: 'POST', body: { ttl: 2 } });
  await request('/tasks', { headers: authHeaders }); // cache it
  const hitShort = await request('/tasks', { headers: authHeaders });
  console.log(`    Immediate fetch (within TTL): X-Cache = ${hitShort.xCache} (${hitShort.durationMs} ms)`);
  console.log('    Sleeping 2.5s for TTL expiration...');
  await sleep(2500);
  const expiredShort = await request('/tasks', { headers: authHeaders });
  console.log(`    Fetch after 2.5s (expired):   X-Cache = ${expiredShort.xCache} (${expiredShort.durationMs} ms)`);

  // Restore standard TTL = 60s
  await request('/cache/ttl', { method: 'POST', body: { ttl: 60 } });
  console.log('  Restored default TTL = 60s.');

  console.log('\n' + '='.repeat(70));
  console.log('               BENCHMARK SUITE COMPLETED SUCCESSFULLY                 ');
  console.log('='.repeat(70) + '\n');

  process.exit(0);
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
