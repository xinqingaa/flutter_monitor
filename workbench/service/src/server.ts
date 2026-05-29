import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { registerRoutes } from './api/routes.js';
import { MemoryMonitorStore } from './store/memory-monitor-store.js';
import { NdjsonMonitorStore } from './store/ndjson-monitor-store.js';
import { SseHub } from './stream/sse-hub.js';

const app = express();
const port = Number.parseInt(process.env.PORT || '3000', 10);
const maxEvents = Number.parseInt(process.env.FM_WORKBENCH_MAX_EVENTS || '5000', 10);
const sseHub = new SseHub();
const currentDir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(currentDir, '..', 'public');
const webDistDir = resolve(currentDir, '..', '..', 'web', 'dist');
const dataFile = process.env.FM_WORKBENCH_NDJSON_PATH;
const store = dataFile
  ? new NdjsonMonitorStore(dataFile, { maxEvents })
  : new MemoryMonitorStore({ maxEvents });

app.use(cors());
app.use(bodyParser.json({ limit: process.env.FM_WORKBENCH_BODY_LIMIT || '10mb' }));
app.use(express.static(existsSync(webDistDir) ? webDistDir : publicDir));

registerRoutes(app, store, sseHub);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (existsSync(webDistDir)) return res.sendFile(join(webDistDir, 'index.html'));
  return next();
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Flutter Monitor workbench service listening at http://localhost:${port}`);
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
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
