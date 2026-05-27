const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = Number.parseInt(process.env.PORT || '3000', 10);
const maxEvents = 5000;
const events = [];
const eventsById = new Map();
const eventsBySession = new Map();
const eventsByTrace = new Map();

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.static('public'));

app.post('/api/monitor/v1/events', (req, res) => {
  const incoming = normalizeEvents(req.body);
  if (incoming.length === 0) {
    return res.status(400).send({ error: 'no_events' });
  }

  for (const event of incoming) {
    storeEvent(event);
  }

  console.log(
    `[FM server] received=${incoming.length} total=${events.length} ` +
      `time=${new Date().toISOString()}`
  );

  res.status(202).send({
    accepted: incoming.length,
    total: events.length,
    eventIds: incoming.map((event) => event.eventId).filter(Boolean),
  });
});

app.post('/report', (req, res) => {
  const incoming = normalizeEvents(req.body);
  for (const event of incoming) {
    storeEvent(event);
  }
  console.log(
    `[FM server] legacy /report received=${incoming.length} total=${events.length}`
  );
  res.status(202).send({ accepted: incoming.length, total: events.length });
});

app.get('/api/monitor/v1/events/:eventId', (req, res) => {
  const event = eventsById.get(req.params.eventId);
  if (!event) return res.status(404).send({ error: 'event_not_found' });
  res.send({ event });
});

app.get('/api/monitor/v1/sessions/:sessionId', (req, res) => {
  const sessionEvents = eventsBySession.get(req.params.sessionId) || [];
  res.send({
    sessionId: req.params.sessionId,
    count: sessionEvents.length,
    events: sessionEvents,
  });
});

app.get('/api/monitor/v1/traces/:traceId', (req, res) => {
  const traceEvents = eventsByTrace.get(req.params.traceId) || [];
  res.send({
    traceId: req.params.traceId,
    count: traceEvents.length,
    events: traceEvents,
  });
});

app.get('/api/monitor/v1/recent', (req, res) => {
  const limit = clampLimit(req.query.limit, 50);
  res.send({
    count: Math.min(limit, events.length),
    events: events.slice(-limit).reverse(),
  });
});

app.get('/api/monitor/v1/groups', (req, res) => {
  const by = req.query.by || 'session';
  const groups = groupEvents(by);
  res.send({ by, count: groups.length, groups });
});

app.listen(port, '0.0.0.0', () => {
  console.log(
    `Flutter Monitor local server listening at http://localhost:${port}`
  );
  console.log('POST /api/monitor/v1/events');
  console.log('GET  /api/monitor/v1/events/:eventId');
  console.log('GET  /api/monitor/v1/sessions/:sessionId');
  console.log('GET  /api/monitor/v1/traces/:traceId');
});

function normalizeEvents(body) {
  if (!body) return [];
  if (Array.isArray(body)) return body.filter(isObject);
  if (Array.isArray(body.events)) return body.events.filter(isObject);
  if (isObject(body) && body.eventId) return [body];
  return [];
}

function storeEvent(event) {
  if (!event.eventId) {
    event.eventId = `evt_server_${Date.now()}_${events.length}`;
  }

  const existing = eventsById.get(event.eventId);
  if (existing) {
    replaceEvent(existing, event);
    return;
  }

  events.push(event);
  eventsById.set(event.eventId, event);
  addToIndex(eventsBySession, event.sessionId, event);
  addToIndex(eventsByTrace, event.traceId, event);
  enforceLimit();
}

function replaceEvent(target, source) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, source);
}

function addToIndex(index, key, event) {
  if (!key) return;
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(event);
}

function enforceLimit() {
  while (events.length > maxEvents) {
    const removed = events.shift();
    eventsById.delete(removed.eventId);
    removeFromIndex(eventsBySession, removed.sessionId, removed);
    removeFromIndex(eventsByTrace, removed.traceId, removed);
  }
}

function removeFromIndex(index, key, event) {
  if (!key || !index.has(key)) return;
  const list = index.get(key).filter((item) => item !== event);
  if (list.length === 0) {
    index.delete(key);
  } else {
    index.set(key, list);
  }
}

function groupEvents(by) {
  if (by === 'trace') return mapToGroups(eventsByTrace, 'traceId');
  if (by === 'route') {
    const routeMap = new Map();
    for (const event of events) {
      const route = event.context && event.context.route && event.context.route.name;
      addToIndex(routeMap, route || '(unknown)', event);
    }
    return mapToGroups(routeMap, 'route');
  }
  if (by === 'name') {
    const nameMap = new Map();
    for (const event of events) addToIndex(nameMap, event.name || '(unknown)', event);
    return mapToGroups(nameMap, 'name');
  }
  return mapToGroups(eventsBySession, 'sessionId');
}

function mapToGroups(index, keyName) {
  return Array.from(index.entries()).map(([key, list]) => ({
    [keyName]: key,
    count: list.length,
    firstEventId: list[0] && list[0].eventId,
    lastEventId: list[list.length - 1] && list[list.length - 1].eventId,
  }));
}

function clampLimit(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 500);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
