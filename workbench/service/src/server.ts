import bodyParser from 'body-parser';
import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerRoutes } from './api/routes.js';
import { SqliteMonitorStore } from './store/sqlite-monitor-store.js';
import { SseHub } from './stream/sse-hub.js';

const app = express();
const port = Number.parseInt(process.env.PORT || '3700', 10);
const maxEvents = Number.parseInt(process.env.FM_WORKBENCH_MAX_EVENTS || '5000', 10);
const sseHub = new SseHub();
const currentDir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(currentDir, '..', 'public');
const webDistDir = resolve(currentDir, '..', '..', 'web', 'dist');
const defaultSqlitePath = resolve(currentDir, '..', '..', '.data', 'events.sqlite');
const sqlitePath = process.env.FM_WORKBENCH_SQLITE_PATH || defaultSqlitePath;
const store = await SqliteMonitorStore.open(sqlitePath, { maxEvents });

app.use(cors());
app.use(bodyParser.json({ limit: process.env.FM_WORKBENCH_BODY_LIMIT || '10mb' }));
app.use(((error, _req, res, next) => {
  if (error instanceof SyntaxError) {
    res.status(400).send({ error: 'invalid_json' });
    return;
  }
  next(error);
}) satisfies ErrorRequestHandler);
app.use(express.static(existsSync(webDistDir) ? webDistDir : publicDir));

registerRoutes(app, store, sseHub);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (existsSync(webDistDir)) return res.sendFile(join(webDistDir, 'index.html'));
  return next();
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Flutter Monitor workbench service listening at http://localhost:${port}`);
  console.log(`SQLite store: ${sqlitePath}`);
  console.log('POST /api/monitor/v1/events');
  console.log('GET  /api/monitor/v1/health');
  console.log('GET  /api/monitor/v1/stream');
  console.log('GET  /api/monitor/v1/sessions?userId=&from=&to=');
  console.log('GET  /api/monitor/v1/performance/overview');
  console.log('GET  /api/monitor/v1/events/:eventId');
  console.log('GET  /api/monitor/v1/sessions/:sessionId');
  console.log('GET  /api/monitor/v1/traces/:traceId');
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `Flutter Monitor workbench service could not start because port ${port} is already in use.`,
    );
    console.error(`Run "bash scripts/workbench.sh stop" or set FM_SERVER_PORT to another port.`);
    process.exit(1);
  }
  throw error;
});

function shutdown(): void {
  sseHub.close();
  server.close(() => {
    store.close?.();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
