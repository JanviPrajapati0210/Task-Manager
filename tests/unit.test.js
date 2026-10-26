const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const taskCache = require('../utils/cache');
const notificationEmitter = require('../utils/notificationEmitter');
const validateTaskId = require('../middleware/validateTaskId');
const validateTask = require('../middleware/validateTask');
const validateContentType = require('../middleware/validateContentType');

describe('Task Management API - Automated Unit Test Suite', () => {

  describe('1. In-Memory Cache (node-cache)', () => {
    beforeEach(() => {
      taskCache.resetStats();
    });

    it('should set and retrieve cached data (Cache Hit)', () => {
      const mockTasks = [{ id: 1, title: 'Test Task' }];
      const key = 'tasks_all:user:123:role:user';
      taskCache.set('allTasks', key, mockTasks);

      const cached = taskCache.get('allTasks', key);
      assert.deepEqual(cached, mockTasks);

      const stats = taskCache.getStats();
      assert.equal(stats.data.breakdown.allTasks.hits, 1);
      assert.equal(stats.data.summary.hits, 1);
    });

    it('should record a cache miss when key does not exist', () => {
      const result = taskCache.get('allTasks', 'tasks_all:non_existent_key');
      assert.equal(result, undefined);

      const stats = taskCache.getStats();
      assert.equal(stats.data.breakdown.allTasks.misses, 1);
      assert.equal(stats.data.summary.misses, 1);
    });

    it('should invalidate cache on write operation', () => {
      const key = 'tasks_all:user:456:role:user';
      taskCache.set('allTasks', key, [{ id: 1 }]);
      assert.ok(taskCache.get('allTasks', key));

      taskCache.invalidateAllTasks('create_task');
      assert.equal(taskCache.get('allTasks', key), undefined);
    });

    it('should dynamically update TTL', () => {
      const newTtl = taskCache.setTTL(45);
      assert.equal(newTtl, 45);
      assert.equal(taskCache.getTTL(), 45);
      taskCache.setTTL(60); // restore default
    });
  });

  describe('2. Background Notification System (EventEmitter)', () => {
    it('should register listeners for task-created, task-deleted, and error', () => {
      const eventNames = notificationEmitter.eventNames();
      assert.ok(eventNames.includes('task-created'), 'Has task-created listener');
      assert.ok(eventNames.includes('task-deleted'), 'Has task-deleted listener');
      assert.ok(eventNames.includes('error'), 'Has error listener');
    });

    it('should catch handler errors in error listener without throwing', (t, done) => {
      const testError = new Error('Test pipeline error catching');

      const errorHandler = (err) => {
        assert.equal(err.message, testError.message);
        notificationEmitter.removeListener('error', errorHandler);
        done();
      };

      notificationEmitter.on('error', errorHandler);
      notificationEmitter.emit('error', testError);
    });
  });

  describe('3. Validation Middlewares', () => {
    it('validateTaskId should reject malformed MongoDB ObjectId', () => {
      const req = { params: { id: 'invalid-id-123' } };
      let statusCode = null;
      let jsonPayload = null;
      const res = {
        status(code) {
          statusCode = code;
          return {
            json(payload) {
              jsonPayload = payload;
            },
          };
        },
      };
      let nextCalled = false;

      validateTaskId(req, res, () => {
        nextCalled = true;
      });

      assert.equal(statusCode, 400);
      assert.equal(jsonPayload.message, 'Invalid Task ID');
      assert.equal(nextCalled, false);
    });

    it('validateTaskId should accept a valid 24-character hex ObjectId', () => {
      const req = { params: { id: '507f1f77bcf86cd799439011' } };
      let nextCalled = false;
      const res = {};

      validateTaskId(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
    });

    it('validateTask should reject POST request missing title', () => {
      const req = { method: 'POST', body: { description: 'No title provided' } };
      let statusCode = null;
      let jsonPayload = null;
      const res = {
        status(code) {
          statusCode = code;
          return {
            json(payload) {
              jsonPayload = payload;
            },
          };
        },
      };
      let nextCalled = false;

      validateTask(req, res, () => {
        nextCalled = true;
      });

      assert.equal(statusCode, 400);
      assert.equal(jsonPayload.error, 'Validation Error');
      assert.equal(nextCalled, false);
    });

    it('validateTask should accept POST request with valid title', () => {
      const req = { method: 'POST', body: { title: 'Complete Practical 10' } };
      let nextCalled = false;
      const res = {};

      validateTask(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
    });

    it('validateContentType should reject POST with non-JSON content-type', () => {
      const req = {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
      };
      let statusCode = null;
      let jsonPayload = null;
      const res = {
        status(code) {
          statusCode = code;
          return {
            json(payload) {
              jsonPayload = payload;
            },
          };
        },
      };
      let nextCalled = false;

      validateContentType(req, res, () => {
        nextCalled = true;
      });

      assert.equal(statusCode, 400);
      assert.equal(jsonPayload.error, 'Content-Type must be application/json');
      assert.equal(nextCalled, false);
    });
  });

});
