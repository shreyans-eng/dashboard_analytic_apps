/**
 * Dashboard SQL library — disk files mirrored in Mongo so admins can edit
 * queries without a deploy. Runtime prefers the Mongo copy when present.
 */
import fs from 'fs';
import path from 'path';
import { getDb, isMongoConnected } from '../db.js';
import { readSqlFile } from './analytics/sql-utils.js';

const COLLECTION = 'dashboard_queries';

export function assertSafeSqlPath(rel) {
  const raw = String(rel || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!raw || raw.includes('..') || raw.startsWith('/') || !raw.endsWith('.sql')) {
    throw new Error('Invalid SQL path');
  }
  if (!/^[a-zA-Z0-9._/-]+$/.test(raw)) {
    throw new Error('Invalid SQL path');
  }
  return raw;
}

export function listDiskSql(sqlRoot) {
  const out = [];
  function walk(rel) {
    const full = rel ? path.join(sqlRoot, rel) : sqlRoot;
    if (!fs.existsSync(full)) return;
    let entries;
    try {
      entries = fs.readdirSync(full, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
      const next = rel ? `${rel}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(next);
      else if (ent.name.endsWith('.sql')) {
        out.push({
          path: next,
          dir: rel || '.',
          name: ent.name,
        });
      }
    }
  }
  walk('');
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

function col() {
  return getDb().collection(COLLECTION);
}

export async function ensureQueryIndexes() {
  if (!isMongoConnected()) return;
  await col().createIndex({ path: 1 }, { unique: true });
  await col().createIndex({ dir: 1, name: 1 });
}

function publicRow(doc, { includeSql = false } = {}) {
  const diskSql = doc.diskSql || '';
  const sql = doc.sql || '';
  const row = {
    path: doc.path,
    dir: doc.dir,
    name: doc.name,
    source: doc.source || 'disk',
    dirty: Boolean(doc.source === 'custom' ? false : sql !== diskSql),
    sqlLength: sql.length,
    updatedAt: doc.updatedAt || null,
    updatedBy: doc.updatedBy || null,
    createdAt: doc.createdAt || null,
  };
  if (includeSql) {
    row.sql = sql;
    row.diskSql = doc.source === 'custom' ? null : diskSql;
  }
  return row;
}

export async function listQueries() {
  if (!isMongoConnected()) return [];
  const rows = await col().find({}).sort({ path: 1 }).toArray();
  return rows.map((d) => publicRow(d));
}

export async function getQuery(relPath) {
  const pathKey = assertSafeSqlPath(relPath);
  if (!isMongoConnected()) return null;
  const doc = await col().findOne({ path: pathKey });
  return doc ? publicRow(doc, { includeSql: true }) : null;
}

export async function importFromDisk(sqlRoot, { force = false, actor } = {}) {
  if (!isMongoConnected()) {
    throw new Error('MongoDB is not connected — cannot store queries');
  }
  const files = listDiskSql(sqlRoot);
  const now = new Date();
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  for (const f of files) {
    const sql = fs.readFileSync(path.join(sqlRoot, f.path), 'utf8');
    const existing = await col().findOne({ path: f.path });
    if (!existing) {
      await col().insertOne({
        path: f.path,
        dir: f.dir,
        name: f.name,
        sql,
        diskSql: sql,
        source: 'disk',
        createdAt: now,
        updatedAt: now,
        updatedBy: actor || 'import',
      });
      inserted += 1;
      continue;
    }
    const dirty = existing.source !== 'custom' && existing.sql !== existing.diskSql;
    if (dirty && !force) {
      skipped += 1;
      continue;
    }
    await col().updateOne(
      { path: f.path },
      {
        $set: {
          dir: f.dir,
          name: f.name,
          sql: force || !dirty ? sql : existing.sql,
          diskSql: sql,
          source: existing.source === 'custom' ? 'custom' : 'disk',
          updatedAt: now,
          updatedBy: actor || 'import',
        },
      },
    );
    updated += 1;
  }
  return { inserted, updated, skipped, total: files.length };
}

export async function saveQuery(relPath, sql, actor) {
  const pathKey = assertSafeSqlPath(relPath);
  if (!isMongoConnected()) throw new Error('MongoDB is not connected');
  if (typeof sql !== 'string' || !sql.trim()) throw new Error('SQL is required');
  const existing = await col().findOne({ path: pathKey });
  if (!existing) throw new Error(`Query not found: ${pathKey}`);
  const now = new Date();
  await col().updateOne(
    { path: pathKey },
    {
      $set: {
        sql,
        updatedAt: now,
        updatedBy: actor || 'unknown',
      },
    },
  );
  return getQuery(pathKey);
}

export async function revertQuery(relPath, actor) {
  const pathKey = assertSafeSqlPath(relPath);
  if (!isMongoConnected()) throw new Error('MongoDB is not connected');
  const existing = await col().findOne({ path: pathKey });
  if (!existing) throw new Error(`Query not found: ${pathKey}`);
  if (existing.source === 'custom' || !existing.diskSql) {
    throw new Error('Custom queries have no disk original to revert to');
  }
  const now = new Date();
  await col().updateOne(
    { path: pathKey },
    {
      $set: {
        sql: existing.diskSql,
        updatedAt: now,
        updatedBy: actor || 'unknown',
      },
    },
  );
  return getQuery(pathKey);
}

export async function createCustomQuery({ name, sql, actor }) {
  if (!isMongoConnected()) throw new Error('MongoDB is not connected');
  const base = String(name || '').trim().replace(/\.sql$/i, '');
  if (!base) throw new Error('Name is required');
  const safe = base.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
  if (!safe) throw new Error('Name is required');
  const pathKey = assertSafeSqlPath(`custom/${safe}.sql`);
  const existing = await col().findOne({ path: pathKey });
  if (existing) throw new Error(`A query named ${safe}.sql already exists`);
  if (typeof sql !== 'string' || !sql.trim()) throw new Error('SQL is required');
  const now = new Date();
  await col().insertOne({
    path: pathKey,
    dir: 'custom',
    name: `${safe}.sql`,
    sql,
    diskSql: '',
    source: 'custom',
    createdAt: now,
    updatedAt: now,
    updatedBy: actor || 'unknown',
  });
  return getQuery(pathKey);
}

export async function deleteQuery(relPath) {
  const pathKey = assertSafeSqlPath(relPath);
  if (!isMongoConnected()) throw new Error('MongoDB is not connected');
  const existing = await col().findOne({ path: pathKey });
  if (!existing) throw new Error(`Query not found: ${pathKey}`);
  if (existing.source !== 'custom') {
    throw new Error('Only custom queries can be deleted. Disk queries can be reverted.');
  }
  await col().deleteOne({ path: pathKey });
  return { ok: true, path: pathKey };
}

/**
 * Dashboard runtime: Mongo copy wins when present, else the file on disk.
 */
export async function resolveSql(sqlRoot, relativePath) {
  const pathKey = String(relativePath || '').replace(/\\/g, '/');
  if (isMongoConnected()) {
    try {
      const doc = await col().findOne({ path: pathKey }, { projection: { sql: 1 } });
      if (doc?.sql) return doc.sql;
    } catch {
      // fall through to disk
    }
  }
  return readSqlFile(sqlRoot, pathKey);
}
