import dns from 'dns';
import { MongoClient } from 'mongodb';

dns.setDefaultResultOrder('ipv4first');

let client;
let db;
let connecting;

function readUri() {
  const raw = String(process.env.MONGODB_URI || process.env.MONGO_URL || '').trim();
  return raw.replace(/^['"]|['"]$/g, '').trim();
}

export function mongoConfigured() {
  return Boolean(readUri());
}

export function isMongoConnected() {
  return Boolean(db);
}

export function mongoStatus() {
  return {
    configured: mongoConfigured(),
    connected: isMongoConnected(),
    db: String(process.env.MONGODB_DB || 'analytics_dashboard').trim(),
  };
}

export function getDb() {
  if (!db) throw new Error('MongoDB is not connected. Set MONGODB_URI on the host (Render → Environment) and allow 0.0.0.0/0 in Atlas Network Access.');
  return db;
}

export async function connectDb() {
  const uri = readUri();
  if (!uri) {
    console.warn('  MongoDB: MONGODB_URI not set — falling back to env login');
    return null;
  }
  if (db) return db;
  if (connecting) return connecting;

  connecting = (async () => {
    const dbName = String(process.env.MONGODB_DB || 'analytics_dashboard').trim();
    const next = new MongoClient(uri, {
      maxPoolSize: 8,
      serverSelectionTimeoutMS: 20000,
      connectTimeoutMS: 20000,
      retryWrites: true,
    });
    await next.connect();
    const nextDb = next.db(dbName);
    await nextDb.collection('users').createIndex({ username: 1 }, { unique: true });
    client = next;
    db = nextDb;
    try {
      const { ensureCohortLtvIndexes } = await import('./services/analytics/cohort-ltv-mongo.js');
      await ensureCohortLtvIndexes();
    } catch (e) {
      console.warn(`  MongoDB: cohort_ltv indexes skipped (${e.message})`);
    }
    console.log(`  MongoDB: connected (${dbName})`);
    return db;
  })();

  try {
    return await connecting;
  } catch (err) {
    connecting = null;
    throw err;
  }
}

export async function ensureDb() {
  if (db) return db;
  if (!mongoConfigured()) {
    throw new Error('MongoDB is not connected. Add MONGODB_URI on Render (Environment) and redeploy. In Atlas → Network Access, allow 0.0.0.0/0.');
  }
  return connectDb();
}

export async function closeDb() {
  connecting = null;
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
