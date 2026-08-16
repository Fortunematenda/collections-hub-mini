const windows = new Map();

export function checkRateLimit(key, { max = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const now = Date.now();
  const row = windows.get(key) || { count: 0, lockedUntil: 0 };
  if (row.lockedUntil > now) {
    return { ok: false, retryAfter: Math.ceil((row.lockedUntil - now) / 1000) };
  }
  if (row.lockedUntil && row.lockedUntil <= now) {
    row.count = 0;
    row.lockedUntil = 0;
  }
  return { ok: true, remaining: Math.max(0, max - row.count) };
}

export function recordFailure(key, { max = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const now = Date.now();
  const row = windows.get(key) || { count: 0, lockedUntil: 0 };
  if (row.lockedUntil && row.lockedUntil <= now) {
    row.count = 0;
    row.lockedUntil = 0;
  }
  row.count += 1;
  if (row.count >= max) {
    row.lockedUntil = now + windowMs;
    row.count = 0;
  }
  windows.set(key, row);
  return row;
}

export function recordSuccess(key) {
  windows.delete(key);
}
