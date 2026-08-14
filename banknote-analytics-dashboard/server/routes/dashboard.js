import { Router } from 'express';

export function createDashboardRoutes(facade) {
  const router = Router();

  router.post('/executive', async (req, res) => {
    try {
      const result = await facade.getExecutive(req.body || {});
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/kpi', async (req, res) => {
    try {
      const result = await facade.getKpi(req.body || {});
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.get('/status', async (req, res) => {
    try {
      const product = req.query.product || 'banknote';
      const freshness = await facade.getSummaryFreshness({ product });
      res.json({
        ...freshness,
        useSummaryTables: (() => {
          const id = String(product);
          const cfg = facade.registry.configs[id];
          return cfg ? cfg.useSummary : facade.registry.configs[facade.registry.primaryId]?.useSummary;
        })(),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/query/:name', async (req, res) => {
    try {
      const result = await facade.runDashboardQuery(req.params.name, req.body || {});
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

export function mountDashboardRoutes(app, facade) {
  app.use('/api/dashboard', createDashboardRoutes(facade));

  app.post('/api/kpi', async (req, res) => {
    try {
      res.json(await facade.getKpi(req.body || {}));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/query/dashboard/:name', async (req, res) => {
    try {
      res.json(await facade.runDashboardQuery(req.params.name, req.body || {}));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/dashboard/status', async (req, res) => {
    try {
      const product = req.query.product || 'banknote';
      const freshness = await facade.getSummaryFreshness({ product });
      res.json(freshness);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/dashboard/executive', async (req, res) => {
    try {
      res.json(await facade.getExecutive(req.body || {}));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}
