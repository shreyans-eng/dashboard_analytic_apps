import { Router } from 'express';
import { cacheStats, cacheClear, cacheBackend } from '../cache/index.js';
import { getMetrics } from '../services/analytics/metrics-tracker.js';
import { getIntradayStatus } from '../services/analytics/intraday.js';
import { TTL } from '../cache/ttl.js';

export function createHealthRoutes({ facade, registry, credentialsPath, project, dataset, summaryDataset }) {
  const router = Router();

  router.get('/live', (_req, res) => {
    res.json({ ok: true });
  });

  router.get('/health', async (_req, res) => {
    const products = {};
    for (const p of registry.list()) {
      try {
        await facade.ping(p.id);
        products[p.id] = { status: 'connected', project: p.project, dataset: p.dataset };
      } catch (e) {
        products[p.id] = { status: 'error', error: e.message, project: p.project, dataset: p.dataset };
      }
    }

    const anyError = Object.values(products).some((p) => p.status === 'error');
    res.json({
      status: anyError ? 'degraded' : 'ok',
      project,
      dataset,
      summaryDataset,
      credentials: credentialsPath ? credentialsPath.split('/').pop() : null,
      products,
      cache: cacheStats(),
      intraday: getIntradayStatus(),
      metrics: getMetrics(),
    });
  });

  router.get('/config', (_req, res) => {
    const primary = registry.configs[registry.primaryId] || {};
    res.json({
      project: primary.project || project,
      dataset: primary.dataset || dataset,
      summaryDataset: primary.summaryDataset || summaryDataset,
      credentialsConfigured: Boolean(primary.credentialsPath || credentialsPath),
      useSummaryTables: primary.useSummary,
      cacheBackend: cacheBackend(),
      cacheTtl: {
        daily: TTL.DAILY,
        topEvents: TTL.TOP_EVENTS,
      },
      intraday: getIntradayStatus(),
      products: registry.list(),
      primaryProduct: registry.primaryId,
    });
  });

  router.get('/cache/stats', (_req, res) => {
    res.json({ ...cacheStats(), metrics: getMetrics() });
  });

  router.post('/cache/clear', async (_req, res) => {
    await cacheClear();
    res.json({ cleared: true });
  });

  return router;
}

export function mountHealthRoutes(app, deps) {
  const router = createHealthRoutes(deps);
  app.use('/api', router);
}
