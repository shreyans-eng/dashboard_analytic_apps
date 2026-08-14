import { Router } from 'express';
import { PAGE_CATALOG, PRODUCT_OPTIONS, isAdmin } from '../access.js';
import { mongoStatus } from '../db.js';
import { createUser, deleteUser, listUsersPaged, updateUser } from '../users.js';
import { getReportSettings, saveReportSettings, sendMonthlyReports, previousMonthRange } from '../reports.js';

export function mountAdminUserRoutes(app, facade) {
  const router = Router();

  router.use((req, res, next) => {
    if (!isAdmin(req.auth)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });

  router.get('/meta', (_req, res) => {
    res.json({
      pages: PAGE_CATALOG,
      products: PRODUCT_OPTIONS,
      roles: [
        { id: 'sub_admin', label: 'Sub-admin' },
        { id: 'admin', label: 'Admin' },
      ],
      mongo: mongoStatus(),
    });
  });

  router.get('/users', async (req, res) => {
    try {
      const result = await listUsersPaged({
        page: req.query.page,
        limit: req.query.limit,
        q: req.query.q,
        product: req.query.product,
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/users', async (req, res) => {
    try {
      const user = await createUser({
        username: req.body?.username,
        password: req.body?.password,
        displayName: req.body?.displayName,
        email: req.body?.email,
        receiveReports: req.body?.receiveReports,
        role: req.body?.role === 'admin' ? 'admin' : 'sub_admin',
        permissions: req.body?.permissions || {
          products: req.body?.products,
          pages: req.body?.pages,
        },
        createdBy: req.auth?.username,
      });
      res.status(201).json({ user });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.patch('/users/:id', async (req, res) => {
    try {
      const user = await updateUser(req.params.id, {
        displayName: req.body?.displayName,
        email: req.body?.email,
        receiveReports: req.body?.receiveReports,
        role: req.body?.role,
        active: req.body?.active,
        permissions: req.body?.permissions || {
          products: req.body?.products,
          pages: req.body?.pages,
        },
        password: req.body?.password,
      }, { actor: req.auth });
      res.json({ user });
    } catch (err) {
      const status = err.message === 'User not found' ? 404 : 400;
      res.status(status).json({ error: err.message });
    }
  });

  router.delete('/users/:id', async (req, res) => {
    try {
      await deleteUser(req.params.id, { actor: req.auth });
      res.json({ ok: true });
    } catch (err) {
      const status = err.message === 'User not found' ? 404 : 400;
      res.status(status).json({ error: err.message });
    }
  });

  router.get('/reports', async (_req, res) => {
    try {
      const settings = await getReportSettings();
      res.json({ settings, period: previousMonthRange() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put('/reports', async (req, res) => {
    try {
      const settings = await saveReportSettings(req.body || {});
      res.json({ settings });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/reports/send', async (_req, res) => {
    try {
      const result = await sendMonthlyReports(facade, { force: true });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.use('/api/admin', router);
}
