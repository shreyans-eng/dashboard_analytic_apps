import { Router } from 'express';

export function mountFunnelRoutes(app, facade) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ funnels: facade.listFunnels() });
  });

  router.post('/:funnelId', async (req, res) => {
    try {
      const result = await facade.getFunnel(req.params.funnelId, req.body || {});
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.use('/api/analytics/funnels', router);

  const events = Router();

  events.post('/inventory', async (req, res) => {
    try {
      res.json(await facade.listEvents(req.body || {}));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  events.post('/detail', async (req, res) => {
    try {
      const { event_name, ...rest } = req.body || {};
      res.json(await facade.getEventDetail(event_name, rest));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.use('/api/analytics/events', events);
}
