import type { Express } from 'express';
import { normalizeEvents } from '../ingest/normalize-events.js';
import { clampLimit, clampNumber, filtersFromRequest } from '../query/request-filters.js';
import type { MonitorStore } from '../store/monitor-store.js';
import type { SseHub } from '../stream/sse-hub.js';

export function registerRoutes(app: Express, store: MonitorStore, sseHub: SseHub): void {
  app.post('/api/monitor/v1/events', (req, res) => {
    const incoming = normalizeEvents(req.body);
    if (incoming.length === 0) {
      return res.status(400).send({ error: 'no_events' });
    }

    const accepted = store.addEvents(incoming);
    sseHub.publishEvents(accepted);

    console.log(
      `[FM workbench] received=${accepted.length} total=${store.health().eventCount} ` +
        `time=${new Date().toISOString()}`,
    );

    return res.status(202).send({
      accepted: accepted.length,
      total: store.health().eventCount,
      eventIds: accepted.map((event) => event.eventId).filter(Boolean),
    });
  });

  app.post('/report', (req, res) => {
    const incoming = normalizeEvents(req.body);
    const accepted = store.addEvents(incoming);
    sseHub.publishEvents(accepted);
    console.log(
      `[FM workbench] legacy /report received=${accepted.length} total=${store.health().eventCount}`,
    );
    return res.status(202).send({ accepted: accepted.length, total: store.health().eventCount });
  });

  app.get('/api/monitor/v1/health', (_req, res) => {
    res.send({
      ok: true,
      service: 'flutter_monitor_workbench_service',
      sseClients: sseHub.clientCount(),
      ...store.health(),
    });
  });

  app.get('/api/monitor/v1/stream', (_req, res) => {
    sseHub.connect(res);
  });

  app.get('/api/monitor/v1/recent', (req, res) => {
    const limit = clampLimit(req.query.limit, 50);
    const events = store.getRecentEvents(limit);
    res.send({ count: events.length, events });
  });

  app.get('/api/monitor/v1/sessions', (req, res) => {
    const filters = filtersFromRequest(req);
    const result = store.listSessions(filters);
    res.send({
      count: result.sessions.length,
      userIdAvailable: result.userIdAvailable,
      userIdQueryAvailable: filters.userId ? result.userIdAvailable : undefined,
      sessions: result.sessions,
    });
  });

  app.get('/api/monitor/v1/search', (req, res) => {
    const filters = filtersFromRequest(req);
    const query = typeof req.query.query === 'string' ? req.query.query : '';
    const events = store.searchEvents(query, filters);
    res.send({ query, count: events.length, events });
  });

  app.get('/api/monitor/v1/performance/overview', (req, res) => {
    const filters = filtersFromRequest(req);
    res.send(store.performanceOverview(filters));
  });

  app.get('/api/monitor/v1/performance/pages', (req, res) => {
    const filters = filtersFromRequest(req);
    const overview = store.performanceOverview(filters);
    res.send(overview.pages);
  });

  app.get('/api/monitor/v1/performance/http', (req, res) => {
    const filters = filtersFromRequest(req);
    const overview = store.performanceOverview(filters);
    res.send(overview.http);
  });

  app.get('/api/monitor/v1/events/:eventId', (req, res) => {
    const event = store.getEvent(req.params.eventId);
    if (!event) return res.status(404).send({ error: 'event_not_found' });
    return res.send({ event });
  });

  app.get('/api/monitor/v1/sessions/:sessionId', (req, res) => {
    const events = store.getSessionEvents(req.params.sessionId);
    return res.send({
      sessionId: req.params.sessionId,
      count: events.length,
      events,
    });
  });

  app.get('/api/monitor/v1/traces/:traceId', (req, res) => {
    const events = store.getTraceEvents(req.params.traceId);
    return res.send({
      traceId: req.params.traceId,
      count: events.length,
      events,
    });
  });

  app.get('/api/monitor/v1/groups', (req, res) => {
    const by = typeof req.query.by === 'string' ? req.query.by : 'session';
    const groups = store.groupEvents(by);
    return res.send({ by, count: groups.length, groups });
  });

  app.get('/api/test/slow', (req, res) => {
    const delayMs = clampNumber(req.query.delayMs, 1000, 0, 10000);
    const bytes = clampNumber(req.query.bytes, 128, 0, 1024 * 1024);
    setTimeout(() => {
      res.set('Content-Type', 'application/json');
      res.send({
        ok: true,
        delayMs,
        bytes,
        data: 'x'.repeat(bytes),
        time: new Date().toISOString(),
      });
    }, delayMs);
  });

  app.get('/api/test/status/:statusCode', (req, res) => {
    const statusCode = clampNumber(req.params.statusCode, 500, 100, 599);
    res.status(statusCode).send({
      ok: statusCode >= 200 && statusCode < 400,
      statusCode,
      time: new Date().toISOString(),
    });
  });
}
