const NodeCache = require('node-cache');

// Standard TTL in seconds (default 60 seconds if not configured via environment)
let defaultTTL = parseInt(process.env.CACHE_TTL, 10) || 60;

// Initialize node-cache instance
// stdTTL: default time-to-live in seconds
// checkperiod: automatic delete check interval in seconds (every 120s)
// useClones: false for performance (avoid deep copy overhead on in-memory read)
const cache = new NodeCache({
  stdTTL: defaultTTL,
  checkperiod: 120,
  useClones: false,
});

// Category-specific hit/miss metrics and invalidation audit
const metrics = {
  allTasks: { hits: 0, misses: 0 },
  singleTask: { hits: 0, misses: 0 },
  invalidations: 0,
  lastInvalidation: null,
  lastInvalidationReason: null,
};

/**
 * Returns current configured TTL in seconds.
 */
function getTTL() {
  return defaultTTL;
}

/**
 * Dynamically updates the default TTL in seconds.
 * If 0 is provided, caching is bypassed/disabled for benchmarking.
 */
function setTTL(newTTL) {
  const parsed = parseInt(newTTL, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error('TTL must be a non-negative number of seconds.');
  }
  defaultTTL = parsed;
  // Clear cached entries so new TTL applies to all subsequent requests immediately
  clearAll('ttl_change');
  return defaultTTL;
}

/**
 * Generates deterministic cache key for GET /tasks
 * Scoped by user ID and role for tenant isolation, plus sorted query parameters.
 */
function makeAllTasksKey(req) {
  const userId = req.user ? req.user._id.toString() : 'public';
  const role = req.user ? req.user.role : 'user';

  // Sort query parameters so parameter order does not cause duplicate cache entries
  const queryKeys = Object.keys(req.query || {}).sort();
  const queryString = queryKeys
    .map((k) => `${k}=${encodeURIComponent(req.query[k])}`)
    .join('&');

  return `tasks_all:user:${userId}:role:${role}${queryString ? `?${queryString}` : ''}`;
}

/**
 * Generates deterministic cache key for GET /tasks/:id
 * Scoped by user ID and taskId for tenant isolation.
 */
function makeSingleTaskKey(req, taskId) {
  const id = taskId || req.params.id;
  const userId = req.user ? req.user._id.toString() : 'public';
  return `tasks_single:user:${userId}:task:${id}`;
}

/**
 * Retrieve cached item by key for a specific category ('allTasks' | 'singleTask')
 */
function get(category, key) {
  // If TTL is set to 0, caching is disabled
  if (defaultTTL <= 0) {
    if (metrics[category]) metrics[category].misses += 1;
    return undefined;
  }

  const value = cache.get(key);
  if (value !== undefined) {
    if (metrics[category]) metrics[category].hits += 1;
    return value;
  }

  if (metrics[category]) metrics[category].misses += 1;
  return undefined;
}

/**
 * Store an item in the cache with the active TTL
 */
function set(category, key, value, ttl = defaultTTL) {
  if (ttl <= 0) return false;
  return cache.set(key, value, ttl);
}

/**
 * Invalidates all list caches (keys starting with 'tasks_all:')
 * Triggered on any write operation (POST, PUT, DELETE) so stale list data is never served.
 */
function invalidateAllTasks(reason = 'write_operation') {
  const allKeys = cache.keys();
  const keysToDelete = allKeys.filter((k) => k.startsWith('tasks_all:'));
  if (keysToDelete.length > 0) {
    cache.del(keysToDelete);
  }

  metrics.invalidations += 1;
  metrics.lastInvalidation = new Date().toISOString();
  metrics.lastInvalidationReason = reason;

  return keysToDelete.length;
}

/**
 * Invalidates a single task's cached entries and all list caches.
 * Triggered on PUT and DELETE operations.
 */
function invalidateSingleTask(taskId, reason = 'task_write_operation') {
  const allKeys = cache.keys();
  const keysToDelete = allKeys.filter(
    (k) => k.includes(`:task:${taskId}`) || k.endsWith(`:${taskId}`)
  );
  if (keysToDelete.length > 0) {
    cache.del(keysToDelete);
  }

  // Any update or deletion of a task also invalidates task lists
  invalidateAllTasks(reason);

  return keysToDelete.length;
}

/**
 * Flushes all keys in the cache
 */
function clearAll(reason = 'manual_flush') {
  cache.flushAll();
  metrics.invalidations += 1;
  metrics.lastInvalidation = new Date().toISOString();
  metrics.lastInvalidationReason = reason;
}

/**
 * Resets all cache data and hit/miss statistics (useful for benchmarking)
 */
function resetStats() {
  cache.flushAll();
  cache.flushStats();
  metrics.allTasks.hits = 0;
  metrics.allTasks.misses = 0;
  metrics.singleTask.hits = 0;
  metrics.singleTask.misses = 0;
  metrics.invalidations = 0;
  metrics.lastInvalidation = null;
  metrics.lastInvalidationReason = null;
}

/**
 * Formats hit rate percentage
 */
function calcHitRate(hits, misses) {
  const total = hits + misses;
  return total > 0 ? `${((hits / total) * 100).toFixed(2)}%` : '0.00%';
}

/**
 * Expose comprehensive statistics for the debug endpoint
 */
function getStats() {
  const totalHits = metrics.allTasks.hits + metrics.singleTask.hits;
  const totalMisses = metrics.allTasks.misses + metrics.singleTask.misses;
  const totalRequests = totalHits + totalMisses;

  const nodeStats = cache.getStats();
  const activeKeys = cache.keys();

  return {
    status: 'success',
    data: {
      ttlSeconds: defaultTTL,
      summary: {
        hits: totalHits,
        misses: totalMisses,
        totalRequests,
        hitRate: calcHitRate(totalHits, totalMisses),
      },
      breakdown: {
        allTasks: {
          hits: metrics.allTasks.hits,
          misses: metrics.allTasks.misses,
          total: metrics.allTasks.hits + metrics.allTasks.misses,
          hitRate: calcHitRate(metrics.allTasks.hits, metrics.allTasks.misses),
        },
        singleTask: {
          hits: metrics.singleTask.hits,
          misses: metrics.singleTask.misses,
          total: metrics.singleTask.hits + metrics.singleTask.misses,
          hitRate: calcHitRate(metrics.singleTask.hits, metrics.singleTask.misses),
        },
      },
      invalidationStats: {
        invalidationEvents: metrics.invalidations,
        lastInvalidation: metrics.lastInvalidation,
        lastReason: metrics.lastInvalidationReason,
      },
      cacheEngine: {
        keysCount: activeKeys.length,
        keys: activeKeys,
        nodeCacheStats: {
          hits: nodeStats.hits,
          misses: nodeStats.misses,
          keys: nodeStats.keys,
          ksize: nodeStats.ksize,
          vsize: nodeStats.vsize,
        },
      },
    },
  };
}

module.exports = {
  cache,
  getTTL,
  setTTL,
  makeAllTasksKey,
  makeSingleTaskKey,
  get,
  set,
  invalidateAllTasks,
  invalidateSingleTask,
  clearAll,
  resetStats,
  getStats,
};
