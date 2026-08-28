import { Router } from 'express';
import { canAccessPage } from '../access.js';
import { cacheClear } from '../cache/index.js';
import { isMongoConnected } from '../db.js';
import {
  listQueries,
  getQuery,
  importFromDisk,
  saveQuery,
  revertQuery,
  createCustomQuery,
  deleteQuery,
  listDiskSql,
} from '../services/query-library.js';

export function mountQueryLibraryRoutes(app, { sqlRoot }) {
  const router = Router();

  router.use((req, res, next) => {
    if (!canAccessPage(req.auth, 'sql')) {
      return res.status(403).json({ error: 'Query library access required' });
    }
    next();
  });

  router.get('/', async (_req, res) => {
    try {
      if (!isMongoConnected()) {
        const files = listDiskSql(sqlRoot);
        return res.json({
          mongo: false,
          queries: files.map((f) => ({
            path: f.path,
            dir: f.dir,
            name: f.name,
            source: 'disk',
            dirty: false,
            sqlLength: 0,
            updatedAt: null,
            updatedBy: null,
          })),
          message: 'MongoDB is not connected — showing files on disk only. Connect Mongo to edit and save.',
        });
      }
      let queries = await listQueries();
      if (!queries.length) {
        await importFromDisk(sqlRoot, { actor: 'auto-import' });
        queries = await listQueries();
      }
      res.json({ mongo: true, queries });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/import', async (req, res) => {
    try {
      const result = await importFromDisk(sqlRoot, {
        force: Boolean(req.body?.force),
        actor: req.auth?.username,
      });
      const queries = await listQueries();
      res.json({ ok: true, ...result, queries });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/content', async (req, res) => {
    try {
      const row = await getQuery(req.query.path);
      if (!row) return res.status(404).json({ error: 'Query not found. Import from disk first.' });
      res.json(row);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.put('/', async (req, res) => {
    try {
      const row = await saveQuery(req.body?.path, req.body?.sql, req.auth?.username);
      await cacheClear();
      res.json({ ok: true, query: row });
    } catch (e) {
      const code = String(e.message || '').includes('not found') ? 404 : 400;
      res.status(code).json({ error: e.message });
    }
  });

  router.post('/revert', async (req, res) => {
    try {
      const row = await revertQuery(req.body?.path, req.auth?.username);
      await cacheClear();
      res.json({ ok: true, query: row });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.post('/custom', async (req, res) => {
    try {
      const row = await createCustomQuery({
        name: req.body?.name,
        sql: req.body?.sql,
        actor: req.auth?.username,
      });
      res.json({ ok: true, query: row });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  router.delete('/', async (req, res) => {
    try {
      const result = await deleteQuery(req.query.path || req.body?.path);
      await cacheClear();
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });

  app.use('/api/queries', router);
}
