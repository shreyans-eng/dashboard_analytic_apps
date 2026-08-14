/**
 * Optional Redis cache. Requires REDIS_URL env var.
 * Uses dynamic import so the app runs without redis installed.
 */

let client = null;
let available = false;
let initAttempted = false;

export async function initRedis() {
  if (initAttempted) return available;
  initAttempted = true;

  const url = process.env.REDIS_URL;
  if (!url) return false;

  try {
    const { createClient } = await import('redis');
    client = createClient({ url });
    client.on('error', (err) => console.warn('Redis error:', err.message));
    await client.connect();
    available = true;
    console.log('Redis cache connected');
  } catch (e) {
    console.warn('Redis unavailable, using in-memory cache:', e.message);
    available = false;
  }
  return available;
}

export function isRedisAvailable() {
  return available;
}

export async function redisGet(key) {
  if (!available || !client) return null;
  try {
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function redisSet(key, value, ttlMs) {
  if (!available || !client) return;
  try {
    await client.set(key, JSON.stringify(value), { PX: ttlMs });
  } catch {
    /* ignore */
  }
}

export async function redisDelete(key) {
  if (!available || !client) return;
  try {
    await client.del(key);
  } catch {
    /* ignore */
  }
}

export async function redisClear() {
  if (!available || !client) return;
  try {
    await client.flushDb();
  } catch {
    /* ignore */
  }
}
