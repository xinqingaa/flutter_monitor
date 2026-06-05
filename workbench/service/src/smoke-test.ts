import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = Number.parseInt(process.env.FM_WORKBENCH_SMOKE_PORT || '3199', 10);
const baseUrl = `http://127.0.0.1:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), 'fm-workbench-'));
const sqlitePath = join(dataDir, 'events.sqlite');

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
  await assertMissingEventId();
  await assertJson('/api/monitor/v1/recent?limit=10', (data) => {
    assert.equal(data.count, 4);
    assert.equal(data.events.some((event: any) => String(event.eventId).startsWith('evt_server_')), false);
  });
  await assertJson('/api/monitor/v1/recent?limit=10&appKey=smoke_app&problemType=failed_http', (data) => {
    assert.equal(data.count, 1);
    assert.equal(data.events[0].eventId, 'evt_smoke_http');
  });
  await assertJson('/api/monitor/v1/recent?limit=10&appKey=missing_app&appKey=smoke_app', (data) => {
    assert.equal(data.count, 4);
  });
  await assertJson('/api/monitor/v1/dimensions', (data) => {
    assert.equal(data.apps[0].appKey, 'smoke_app');
    assert.equal(data.environments.some((item: any) => item.value === 'dev'), true);
    assert.equal(data.devicePlatforms.some((item: any) => item.value === 'android'), true);
  });
  await assertJson('/api/monitor/v1/sessions?userId=user_smoke&environment=dev', (data) => {
    assert.equal(data.count, 1);
    assert.equal(data.userIdAvailable, true);
    assert.equal(data.sessions[0].sessionId, 'ses_smoke');
    assert.equal(data.sessions[0].failedHttpCount, 1);
  });
  await assertJson('/api/monitor/v1/sessions?environment=missing,dev&devicePlatform=ios,android', (data) => {
    assert.equal(data.count, 1);
    assert.equal(data.sessions[0].sessionId, 'ses_smoke');
  });
  await assertJson('/api/monitor/v1/sessions?sessionId=ses_smo', (data) => {
    assert.equal(data.count, 1);
    assert.equal(data.sessions[0].sessionId, 'ses_smoke');
  });
  await assertJson('/api/monitor/v1/sessions/ses_smoke', (data) => {
    assert.equal(data.count, 4);
  });
  await assertJson('/api/monitor/v1/traces/trace_smoke', (data) => {
    assert.equal(data.count, 2);
  });
  await assertJson('/api/monitor/v1/search?query=http.client', (data) => {
    assert.equal(data.count, 1);
  });
  await assertJson('/api/monitor/v1/performance/overview', (data) => {
    assert.equal(data.startup.count, 2);
    assert.equal(data.http.count, 1);
    assert.equal(data.http.errorCount, 1);
    assert.equal(data.pages.count, 1);
    assert.equal(data.startup.events.some((event: any) => event.eventId === 'evt_smoke_start' && event.attributes['frame.fps'] === 58), true);
    assert.equal(data.startup.events.some((event: any) => event.eventId === 'evt_smoke_hot' && event.attributes['memory.delta_rss_mb'] === 4.5), true);
    assert.equal(data.pages.events.some((event: any) => event.eventId === 'evt_smoke_page_visit' && event.name === 'page.visit'), true);
    const serialized = JSON.stringify(data);
    assert.equal(serialized.includes('ui.frame.window'), false);
    assert.equal(serialized.includes('page.active_window_id'), false);
    assert.equal(serialized.includes('memory.sample_delay_ms'), false);
  });

  await restartService();
  await assertJson('/api/monitor/v1/sessions/ses_smoke', (data) => {
    assert.equal(data.count, 4);
  });
  await postRetentionEvents();
  await assertJson('/api/monitor/v1/health', (data) => {
    assert.equal(data.eventCount, 4);
  });
  await assertJson('/api/monitor/v1/recent?limit=10', (data) => {
    assert.equal(data.count, 4);
  });
  await assertStatus('/api/monitor/v1/events/evt_smoke_start', 404);
} finally {
  child.kill('SIGTERM');
}

function spawnService() {
  return spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      PORT: String(port),
      FM_WORKBENCH_SQLITE_PATH: sqlitePath,
      FM_WORKBENCH_MAX_EVENTS: '4',
    },
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
          startTime: '2026-05-29T09:59:59.000Z',
          endTime: '2026-05-29T10:00:00.000Z',
          durationMs: 1000,
          resource: {
            app: { appKey: 'smoke_app', appName: 'Smoke App', appVersion: '1.0.0', environment: 'dev' },
            device: { platform: 'android', model: 'Pixel', deviceTier: 'high' },
          },
          context: { user: { userId: 'user_smoke' }, route: { name: '/' }, native: { available: false, platform: 'android' } },
          attributes: {
            'event.phase': 'end',
            'app.start.type': 'cold',
            'app.start.end_reason': 'first_frame',
            'app.first_frame_ms': 1000,
            'frame.sample_count': 60,
            'frame.slow_count': 2,
            'frame.dropped_count': 1,
            'frame.fps': 58,
            'frame.stability': 0.96,
            'frame.max_ms': 24,
            'memory.start_rss_mb': 101,
            'memory.end_rss_mb': 112.5,
            'memory.delta_rss_mb': 11.5,
          },
          payload: {},
        },
        {
          eventId: 'evt_smoke_hot',
          timestamp: '2026-05-29T10:00:00.500Z',
          signalType: 'trace',
          name: 'app.hot_start',
          startTime: '2026-05-29T10:00:00.300Z',
          endTime: '2026-05-29T10:00:00.500Z',
          durationMs: 200,
          status: 'ok',
          sessionId: 'ses_smoke',
          traceId: 'trace_smoke_hot',
          resource: {
            app: { appKey: 'smoke_app', appName: 'Smoke App', appVersion: '1.0.0', environment: 'dev' },
            device: { platform: 'android', model: 'Pixel', deviceTier: 'high' },
          },
          context: { user: { userId: 'user_smoke' }, route: { name: '/' }, native: { available: false, platform: 'android' } },
          attributes: {
            'event.phase': 'end',
            'app.start.type': 'hot',
            'app.start.end_reason': 'first_frame',
            'frame.sample_count': 18,
            'frame.slow_count': 0,
            'frame.dropped_count': 0,
            'frame.fps': 60,
            'frame.stability': 1,
            'frame.max_ms': 17,
            'memory.start_rss_mb': 112.5,
            'memory.end_rss_mb': 117,
            'memory.delta_rss_mb': 4.5,
          },
          payload: {},
        },
        {
          eventId: 'evt_smoke_page_visit',
          timestamp: '2026-05-29T10:00:00.800Z',
          signalType: 'trace',
          name: 'page.visit',
          startTime: '2026-05-29T10:00:00.100Z',
          endTime: '2026-05-29T10:00:00.800Z',
          durationMs: 700,
          status: 'ok',
          sessionId: 'ses_smoke',
          traceId: 'trace_smoke_page_home_1',
          resource: {
            app: { appKey: 'smoke_app', appName: 'Smoke App', appVersion: '1.0.0', environment: 'dev' },
            device: { platform: 'android', model: 'Pixel', deviceTier: 'high' },
          },
          context: { user: { userId: 'user_smoke' }, route: { name: '/detail' }, native: { available: false, platform: 'android' } },
          attributes: {
            'event.phase': 'end',
            'page.instance_id': 'page_home_1',
            'page.from': '/',
            'page.to': '/detail',
            'frame.sample_count': 42,
            'frame.slow_count': 3,
            'frame.dropped_count': 1,
            'frame.fps': 54,
            'frame.stability': 0.91,
            'frame.max_ms': 33,
            'memory.enter_rss_mb': 117,
            'memory.exit_rss_mb': 124.25,
            'memory.delta_rss_mb': 7.25,
          },
          payload: { page: { end_reason: 'route_push' } },
        },
        {
          eventId: 'evt_smoke_http',
          timestamp: '2026-05-29T10:00:01.000Z',
          signalType: 'span',
          name: 'http.client',
          startTime: '2026-05-29T10:00:00.850Z',
          endTime: '2026-05-29T10:00:01.000Z',
          durationMs: 150,
          status: 'error',
          sessionId: 'ses_smoke',
          traceId: 'trace_smoke',
          spanId: 'span_smoke_http',
          resource: {
            app: { appKey: 'smoke_app', appName: 'Smoke App', appVersion: '1.0.0', environment: 'dev' },
            device: { platform: 'android', model: 'Pixel', deviceTier: 'high' },
          },
          context: { user: { userId: 'user_smoke' }, route: { name: '/detail' }, native: { available: false, platform: 'android' } },
          attributes: { 'event.phase': 'instant', 'http.success': false },
          payload: {},
        },
      ],
    }),
  });
  assert.equal(response.status, 202);
}

async function assertMissingEventId(): Promise<void> {
  const response = await fetch(`${baseUrl}/api/monitor/v1/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      events: [
        {
          timestamp: '2026-05-29T10:00:02.000Z',
          signalType: 'breadcrumb',
          name: 'missing.event_id',
          status: 'ok',
          sessionId: 'ses_smoke',
          traceId: 'trace_smoke',
          attributes: {},
          payload: {},
        },
      ],
    }),
  });
  assert.equal(response.status, 400);
  const data = await response.json();
  assert.equal(data.error, 'missing_event_id');
}

async function postRetentionEvents(): Promise<void> {
  const response = await fetch(`${baseUrl}/api/monitor/v1/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      events: Array.from({ length: 5 }, (_, index) => ({
        eventId: `evt_retention_${index}`,
        timestamp: `2026-05-29T10:01:0${index}.000Z`,
        signalType: 'breadcrumb',
        name: 'retention.test',
        status: 'ok',
        sessionId: 'ses_retention',
        traceId: 'trace_retention',
        resource: { app: { appVersion: '1.0.0', environment: 'dev' } },
        context: { user: { userId: 'user_smoke' }, route: { name: '/retention' } },
        attributes: {},
        payload: {},
      })),
    }),
  });
  assert.equal(response.status, 202);
}

async function assertJson(path: string, assertion: (data: any) => void): Promise<void> {
  const response = await fetch(`${baseUrl}${path}`);
  assert.equal(response.status, 200);
  assertion(await response.json());
}

async function assertStatus(path: string, status: number): Promise<void> {
  const response = await fetch(`${baseUrl}${path}`);
  assert.equal(response.status, status);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
