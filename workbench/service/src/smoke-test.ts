import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = Number.parseInt(process.env.FM_WORKBENCH_SMOKE_PORT || '3199', 10);
const baseUrl = `http://127.0.0.1:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), 'fm-workbench-'));
const ndjsonPath = join(dataDir, 'events.ndjson');

let child = spawnService();

let output = '';
child.stdout.on('data', (chunk) => {
  output += chunk.toString();
});
child.stderr.on('data', (chunk) => {
  output += chunk.toString();
});

try {
  await waitForHealth();
  await postEvents();
  await assertJson('/api/monitor/v1/recent?limit=10', (data) => {
    assert.equal(data.count, 2);
  });
  await assertJson('/api/monitor/v1/sessions?userId=user_smoke&environment=dev', (data) => {
    assert.equal(data.count, 1);
    assert.equal(data.userIdAvailable, true);
    assert.equal(data.sessions[0].sessionId, 'ses_smoke');
    assert.equal(data.sessions[0].failedHttpCount, 1);
  });
  await assertJson('/api/monitor/v1/sessions/ses_smoke', (data) => {
    assert.equal(data.count, 2);
  });
  await assertJson('/api/monitor/v1/traces/trace_smoke', (data) => {
    assert.equal(data.count, 2);
  });
  await assertJson('/api/monitor/v1/search?query=http.client', (data) => {
    assert.equal(data.count, 1);
  });
  await assertJson('/api/monitor/v1/performance/overview', (data) => {
    assert.equal(data.startup.count, 1);
    assert.equal(data.http.count, 1);
    assert.equal(data.http.errorCount, 1);
  });

  await restartService();
  await assertJson('/api/monitor/v1/sessions/ses_smoke', (data) => {
    assert.equal(data.count, 2);
  });
} finally {
  child.kill('SIGTERM');
}

function spawnService() {
  return spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, PORT: String(port), FM_WORKBENCH_NDJSON_PATH: ndjsonPath },
  stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function restartService(): Promise<void> {
  child.kill('SIGTERM');
  await delay(500);
  output = '';
  child = spawnService();
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });
  await waitForHealth();
}

async function waitForHealth(): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/api/monitor/v1/health`);
      if (response.ok) return;
    } catch {
      // Retry until the server binds the port.
    }
    await delay(100);
  }
  throw new Error(`Workbench service did not become healthy:\n${output}`);
}

async function postEvents(): Promise<void> {
  const response = await fetch(`${baseUrl}/api/monitor/v1/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      events: [
        {
          eventId: 'evt_smoke_start',
          timestamp: '2026-05-29T10:00:00.000Z',
          signalType: 'trace',
          name: 'app.cold_start',
          status: 'ok',
          sessionId: 'ses_smoke',
          traceId: 'trace_smoke',
          resource: { app: { appVersion: '1.0.0', environment: 'dev' } },
          context: { user: { userId: 'user_smoke' }, route: { name: '/' } },
          attributes: {},
          payload: {},
        },
        {
          eventId: 'evt_smoke_http',
          timestamp: '2026-05-29T10:00:01.000Z',
          signalType: 'span',
          name: 'http.client',
          status: 'error',
          sessionId: 'ses_smoke',
          traceId: 'trace_smoke',
          spanId: 'span_smoke_http',
          resource: { app: { appVersion: '1.0.0', environment: 'dev' } },
          context: { user: { userId: 'user_smoke' }, route: { name: '/detail' } },
          attributes: { 'http.success': false },
          payload: {},
        },
      ],
    }),
  });
  assert.equal(response.status, 202);
}

async function assertJson(path: string, assertion: (data: any) => void): Promise<void> {
  const response = await fetch(`${baseUrl}${path}`);
  assert.equal(response.status, 200);
  assertion(await response.json());
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
