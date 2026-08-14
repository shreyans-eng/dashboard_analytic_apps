import { MongoClient } from 'mongodb';

let client;
let db;

export function mongoConfigured() {
  return Boolean(String(process.env.MONGODB_URI || '').trim());
}

export function getDb() {
  if (!db) throw new Error('MongoDB is not connected');
  return db;
}

export async function connectDb() {
  const uri = String(process.env.MONGODB_URI || '').trim();
  if (!uri) {
    console.warn('  MongoDB: MONGODB_URI not set — falling back to env login');
    return null;
  }

  const dbName = String(process.env.MONGODB_DB || 'analytics_dashboard').trim();
  client = new MongoClient(uri, {
    maxPoolSize: 8,
    serverSelectionTimeoutMS: 12000,
  });
  await client.connect();
  db = client.db(dbName);

  await db.collection('users').createIndex({ username: 1 }, { unique: true });

  console.log(`  MongoDB: connected (${dbName})`);
  return db;
}

export async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
