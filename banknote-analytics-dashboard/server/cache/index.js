/**
 * Request cache: Redis when REDIS_URL is set, otherwise in-memory.
 * Keys include product + filters so Banknote and Coinzy never share a result.
 */
import { ttlFor } from './ttl.js';
import * as memory from './memory.js';
import * as redis from './redis.js';

let backend = 'memory';

export async function initCache() {
  const ok = await redis.initRedis();
  backend = ok ? 'redis' : 'memory';
  return backend;
}

export function cacheBackend() {
  return backend;
}

export function cacheKey(prefix, payload) {
  return `banknote:${prefix}:${JSON.stringify(payload)}`;
}

export async function cacheGet(key) {
  if (backend === 'redis') {
    const hit = await redis.redisGet(key);
    if (hit !== null) return hit;
  }
  return memory.memoryGet(key);
}

export async function cacheSet(key, value, ttlMs) {
  if (backend === 'redis') {
    await redis.redisSet(key, value, ttlMs);
  }
  memory.memorySet(key, value, ttlMs);
}

export async function cacheClear() {
  await redis.redisClear();
  memory.memoryClear();
}

export async function cached(metric, key, fn) {
  const ttlMs = ttlFor(metric);
  const hit = await cacheGet(key);
  if (hit !== null) {
    return { ...hit, cached: true, cacheBackend: backend };
  }
  const value = await fn();
  await cacheSet(key, value, ttlMs);
  return { ...value, cached: false, cacheBackend: backend };
}

export function cacheStats() {
  return {
    backend,
    redis: redis.isRedisAvailable(),
    memory: memory.memoryStats(),
  };
}
