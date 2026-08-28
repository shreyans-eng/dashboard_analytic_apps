/**
 * Product Analytics API.
 * Serves Banknote + Coinzy (and Compare) from BigQuery summaries / views / raw,
 * plus Mongo for auth and Cohort LTV. Static `dist/` is served in production.
 */
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { initCache, cacheClear } from './cache/index.js';
import { prepareSql, readSqlFile } from './services/analytics/sql-utils.js';
import {
  createProductRepos,
  ProductAnalyticsFacade,
} from './services/analytics/product-registry.js';
import { mountDashboardRoutes } from './routes/dashboard.js';
import { mountHealthRoutes } from './routes/health.js';
import { mountFunnelRoutes } from './routes/funnels.js';
import { mountAuth, authStatus } from './auth.js';
import { materializeCredentials } from './credentials.js';
import { connectDb, mongoConfigured } from './db.js';
import { seedAdmin } from './users.js';
import { mountAdminUserRoutes } from './routes/admin-users.js';
import { mountQueryLibraryRoutes } from './routes/queries.js';
import { startReportScheduler } from './reports.js';
import { isAdmin } from './access.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env'), override: true });
materializeCredentials(ROOT);

const SQL_ROOT = process.env.SQL_ROOT
  ? path.resolve(process.env.SQL_ROOT)
  : path.resolve(ROOT, '..', 'sql');
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';

const registry = createProductRepos(ROOT, SQL_ROOT);
const facade = new ProductAnalyticsFacade(registry);

const primary = registry.configs[registry.primaryId];

// Default process env credentials to primary product
if (primary?.credentialsPath) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = primary.credentialsPath;
}

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));
mountAuth(app);

const distPath = path.join(ROOT, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

mountHealthRoutes(app, {
  facade,
  registry,
  credentialsPath: primary?.credentialsPath,
  project: primary?.project,
  dataset: primary?.dataset,
  summaryDataset: primary?.summaryDataset,
});
mountDashboardRoutes(app, facade);
mountFunnelRoutes(app, facade);
mountQueryLibraryRoutes(app, { sqlRoot: SQL_ROOT });

app.get('/api/test/bigquery', async (req, res) => {
  try {
    const product = String(req.query.product || 'banknote');
    const { rows: ping } = await facade.ping(product === 'coinzy' ? 'coinzy' : 'banknote');
    res.json({ product, ping });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/sql/files', (_req, res) => {
  const dirs = [
    'dashboard',
    'dashboard/summary',
    'dashboard/raw',
    'dashboard/product',
    'dashboard/product/banknote',
    'dashboard/product/coinzy',
    'validation',
    'summary',
    'scheduled',
  ];
  const files = [];
  for (const dir of dirs) {
    const dirPath = path.join(SQL_ROOT, dir);
    if (!fs.existsSync(dirPath)) continue;
    for (const f of fs.readdirSync(dirPath).filter((x) => x.endsWith('.sql')).sort()) {
      files.push({ dir, name: f, path: `${dir}/${f}` });
    }
  }
  res.json(files);
});

/** Nested library paths (e.g. dashboard/product/banknote/08_….sql) */
app.get('/api/sql/content', (req, res) => {
  try {
    const rel = String(req.query.path || '').replace(/^\/+/, '');
    if (!rel || rel.includes('..') || !rel.endsWith('.sql')) {
      return res.status(400).json({ error: 'Invalid SQL path' });
    }
    const content = readSqlFile(SQL_ROOT, rel);
    res.json({ path: rel, content });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

app.get('/api/sql/files/:dir/:file', (req, res) => {
  try {
    const content = readSqlFile(SQL_ROOT, `${req.params.dir}/${req.params.file}`);
    res.json({ path: `${req.params.dir}/${req.params.file}`, content });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

app.get('/api/sql/files/:dir/:subdir/:file', (req, res) => {
  try {
    const rel = `${req.params.dir}/${req.params.subdir}/${req.params.file}`;
    const content = readSqlFile(SQL_ROOT, rel);
    res.json({ path: rel, content });
  } catch (e) {
    res.status(404).json({ error: e.message });
  }
});

app.post('/api/query/run', async (req, res) => {
  try {
    const { sql, params } = req.body;
    if (!sql?.trim()) return res.status(400).json({ error: 'SQL is required' });
    const product = facade.resolveProduct(params || {});
    const repo = registry.getRepo(product === 'compare' ? registry.primaryId : product);
    const prepared = prepareSql(sql, params || {}, repo.config);
    const { rows, bytesProcessed } = await repo.runRawSql(prepared);
    res.json({ sql: prepared, rows, count: rows.length, bytesProcessed, product });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/refresh-summaries', async (req, res) => {
  if (!isAdmin(req.auth)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  try {
    await cacheClear();
    const script = path.join(ROOT, 'scripts', 'refresh-summaries.js');
    const child = spawn('node', [script], { cwd: ROOT, env: process.env });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });

    child.on('close', (code) => {
      if (code === 0) res.json({ ok: true, output: stdout });
      else res.status(500).json({ ok: false, error: stderr || stdout });
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

mountAdminUserRoutes(app, facade);

app.get('*', (_req, res) => {
  const index = path.join(distPath, 'index.html');
  if (fs.existsSync(index)) res.sendFile(index);
  else res.status(404).send('Build frontend with: npm run build');
});

async function start() {
  await initCache();
  if (mongoConfigured()) {
    try {
      await connectDb();
      await seedAdmin();
    } catch (err) {
      console.error('MongoDB connection failed:', err.message);
      console.error('  Check MONGODB_URI and Atlas Network Access (allow 0.0.0.0/0).');
    }
  } else {
    console.warn('  MongoDB: MONGODB_URI is not set — Users & access will not save until you add it on Render.');
  }
  await Promise.all(
    registry.productIds.map((id) => registry.repos[id].init()),
  );

  app.listen(PORT, HOST, () => {
    const auth = authStatus();
    console.log(`Product Analytics API → http://${HOST}:${PORT}`);
    console.log(`  SQL_ROOT=${SQL_ROOT}`);
    console.log(
      auth.enabled
        ? `  Auth: enabled (${auth.mongo ? 'MongoDB users' : 'env login'})`
        : '  Auth: DISABLED — set MONGODB_URI or DASHBOARD_USERNAME / DASHBOARD_PASSWORD in .env',
    );
    for (const p of registry.list()) {
      console.log(
        `  ${p.label}: ${p.project}.${p.dataset} (creds: ${p.credentialsConfigured}, raw=${p.preferRaw})`,
      );
    }
    startReportScheduler(facade);
  });
}

start();
