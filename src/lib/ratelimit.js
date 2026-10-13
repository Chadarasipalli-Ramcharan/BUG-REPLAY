// Minimal in-memory fixed-window rate limiter for ingestion endpoints.
// MVP-level protection against accidental floods; resets on server restart.

const windows = new Map();

export function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  let w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    w = { start: now, count: 0 };
    windows.set(key, w);
  }
  w.count += 1;
  if (windows.size > 10000) {
    for (const [k, v] of windows) {
      if (now - v.start >= windowMs) windows.delete(k);
    }
  }
  return w.count <= limit;
}
