import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRateLimit, recordFailure, recordSuccess } from './rate-limit.js';

test('locks after five failures', () => {
  const key = `test-${Date.now()}`;
  for (let i = 0; i < 5; i += 1) recordFailure(key, { max: 5, windowMs: 60_000 });
  const limited = checkRateLimit(key, { max: 5, windowMs: 60_000 });
  assert.equal(limited.ok, false);
  assert.ok(limited.retryAfter > 0);
});

test('success clears the window', () => {
  const key = `ok-${Date.now()}`;
  recordFailure(key, { max: 5, windowMs: 60_000 });
  recordSuccess(key);
  assert.equal(checkRateLimit(key).ok, true);
});
