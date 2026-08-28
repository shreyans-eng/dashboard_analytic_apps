/**
 * Dashboard HTTP routes.
 * Canonical: POST /api/dashboard/kpi, GET /api/dashboard/status, POST /api/dashboard/query/:name
 * Aliases kept for the Vite client: POST /api/kpi, POST /api/query/dashboard/:name
 */
import { Router } from 'express';

function send(res, fn) {
  return fn()
    .then((result) => res.json(result))
    .catch((e) => res.status(500).json({ error: e.message }));
}

export function createDashboardRoutes(facade) {
  const router = Router();

  router.post('/kpi', (req, res) => send(res, () => facade.getKpi(req.body || {})));

  router.get('/status', (req, res) =>
    send(res, async () => {
      const product = req.query.product || 'banknote';
      const freshness = await facade.getSummaryFreshness({ product });
      const id = String(product);
      const cfg = facade.registry.configs[id];
      return {
        ...freshness,
        useSummaryTables: cfg
          ? cfg.useSummary
          : facade.registry.configs[facade.registry.primaryId]?.useSummary,
      };
    }),
  );

  router.post('/query/:name', (req, res) =>
    send(res, () => facade.runDashboardQuery(req.params.name, req.body || {})),
  );

  return router;
}

export function mountDashboardRoutes(app, facade) {
  app.use('/api/dashboard', createDashboardRoutes(facade));
  app.post('/api/kpi', (req, res) => send(res, () => facade.getKpi(req.body || {})));
  app.post('/api/query/dashboard/:name', (req, res) =>
    send(res, () => facade.runDashboardQuery(req.params.name, req.body || {})),
  );
}
