/** In-memory TTL cache — fallback when Redis is unavailable */

const store = new Map();

export function memoryGet(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function memorySet(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function memoryDelete(key) {
  store.delete(key);
}

export function memoryClear() {
  store.clear();
}

export function memoryStats() {
  const now = Date.now();
  let active = 0;
  for (const [, entry] of store) {
    if (now <= entry.expiresAt) active += 1;
  }
  return { entries: store.size, active };
}
