import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { httpCatalogFieldsOf } from '../src/store/event-accessors';

const port = Number.parseInt(process.env.FM_WORKBENCH_SMOKE_PORT || '3199', 10);
const baseUrl = `http://127.0.0.1:${port}`;
const dataDir = mkdtempSync(join(tmpdir(), 'fm-workbench-'));
const sqlitePath = join(dataDir, 'events.sqlite');
const serviceRoot = fileURLToPath(new URL('..', import.meta.url));

let child: ReturnType<typeof spawnService>;
let output = '';

async function runSmokeTests(): Promise<void> {
  child = spawnService();
  output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    output += chunk.toString();
  });

  try {
  await waitForHealth();
  await postEvents();
  assertHttpBusinessCodeStates();
  await assertMissingEventId();
  await assertJson('/api/monitor/v1/recent?limit=10', (data) => {
    assert.equal(data.count, 5);
    assert.equal(data.events.some((event: any) => String(event.eventId).startsWith('evt_server_')), false);
  });
  await assertJson('/api/monitor/v1/recent?limit=10&appKey=smoke_app&problemType=failed_http', (data) => {
    assert.equal(data.count, 1);
    assert.equal(data.events[0].eventId, 'evt_smoke_http');
  });
  await assertJson('/api/monitor/v1/catalog/http?method=POST&host=api.example.com&statusCode=422&businessCode=COUPON_01&result=failed&slowOnly=true&slowThresholdMs=100', (data) => {
    assert.equal(data.total, 1);
    assert.equal(data.limit, 50);
    assert.equal(data.offset, 0);
    assert.equal(data.slowThresholdMs, 100);
    assert.equal(data.items[0].eventId, 'evt_smoke_http');
    assert.equal(data.items[0].host, 'api.example.com');
    assert.equal(data.items[0].businessCode, 'COUPON_01');
    assert.equal(data.items[0].businessCodeState, 'value');
  });
  await assertJson('/api/monitor/v1/catalog/http?url=coupon&requestId=req-smoke&route=/detail&limit=1&offset=0', (data) => {
    assert.equal(data.total, 1);
    assert.equal(data.items.length, 1);
    assert.equal(data.items[0].requestId, 'req-smoke');
  });
  await assertJson('/api/monitor/v1/events/evt_smoke_http', (data) => {
    assert.equal(data.event.eventId, 'evt_smoke_http');
    assert.equal(data.event.businessCode, undefined);
  });
  await assertJson('/api/monitor/v1/recent?limit=10&appKey=smoke_app&problemType=business_failure', (data) => {
    assert.equal(data.count, 1);
    assert.equal(data.events[0].eventId, 'evt_smoke_business_failed');
  });
  await assertJson('/api/monitor/v1/recent?limit=10&appKey=missing_app&appKey=smoke_app', (data) => {
    assert.equal(data.count, 5);
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
    assert.equal(data.sessions[0].errorCount, 0);
    assert.equal(data.sessions[0].businessFailureCount, 1);
    assert.equal(data.sessions[0].status, 'warning');
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
    assert.equal(data.count, 5);
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
    assert.equal(data.errors.count, 0);
    assert.equal(data.pages.count, 1);
    assert.equal(data.startup.events.some((event: any) => event.eventId === 'evt_smoke_start' && event.attributes['frame.fps'] === undefined), true);
    assert.equal(data.startup.events.some((event: any) => event.eventId === 'evt_smoke_hot' && event.attributes['memory.delta_rss_mb'] === 4.5), true);
    assert.equal(data.pages.events.some((event: any) => event.eventId === 'evt_smoke_page_visit' && event.name === 'page.visit' && event.attributes['frame.fps'] === 54), true);
    const serialized = JSON.stringify(data);
    assert.equal(serialized.includes('ui.frame.window'), false);
    assert.equal(serialized.includes('page.active_window_id'), false);
    assert.equal(serialized.includes('memory.sample_delay_ms'), false);
  });

  await restartService();
  await assertJson('/api/monitor/v1/sessions/ses_smoke', (data) => {
    assert.equal(data.count, 5);
  });
  await postSdkReliabilityEvents();
  await assertJson('/api/monitor/v1/performance/overview', (data) => {
    assert.equal(data.sdk.count, 5);
    assert.equal(data.sdk.flushCount, 1);
    assert.equal(data.sdk.flushFailureCount, 1);
    assert.equal(data.sdk.retryCount, 1);
    assert.equal(data.sdk.dropCount, 1);
    assert.equal(data.sdk.droppedEventCount, 3);
    assert.equal(data.sdk.queueStateCount, 1);
    assert.equal(data.sdk.configAppliedCount, 1);
    assert.equal(data.sdk.latestQueueLength, 12);
    assert.equal(data.sdk.latestQueueBytes, 4096);
    assert.equal(data.sdk.dropReasonSummaries[0].key, 'rate_limited');
    assert.equal(data.sdk.retryReasonSummaries[0].key, 'server_error');
    assert.equal(data.sdk.flushReasonSummaries[0].key, 'interval');
    assert.equal(data.sdk.outputModeSummaries[0].key, 'production');
    assert.equal(data.sdk.events.some((event: any) => event.eventId === 'evt_sdk_drop'), true);
  });
  await postRetentionEvents();
  await assertJson('/api/monitor/v1/health', (data) => {
    assert.equal(data.eventCount, 5);
  });
  await assertJson('/api/monitor/v1/recent?limit=10', (data) => {
    assert.equal(data.count, 5);
  });
  await assertStatus('/api/monitor/v1/events/evt_smoke_start', 404);
  } finally {
    child.kill('SIGTERM');
  }
}

runSmokeTests().catch((error) => {
  console.error(error);
  process.exit(1);
});

function spawnService() {
  return spawn(process.execPath, [join(serviceRoot, 'dist/main.js')], {
    cwd: serviceRoot,
    env: {
      ...process.env,
      PORT: String(port),
      FM_WORKBENCH_SQLITE_PATH: sqlitePath,
      FM_WORKBENCH_MAX_EVENTS: '5',
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
          eventId: 'evt_smoke_business_failed',
          timestamp: '2026-05-29T10:00:00.900Z',
          signalType: 'breadcrumb',
          name: 'detail.coupon.apply',
          status: 'error',
          level: 'warning',
          sessionId: 'ses_smoke',
          traceId: 'trace_smoke_page_home_1',
          resource: {
            app: { appKey: 'smoke_app', appName: 'Smoke App', appVersion: '1.0.0', environment: 'dev' },
            device: { platform: 'android', model: 'Pixel', deviceTier: 'high' },
          },
          context: { user: { userId: 'user_smoke' }, route: { name: '/detail' }, native: { available: false, platform: 'android' } },
          attributes: { 'business.action': 'detail.coupon.apply', 'business.result': 'failed' },
          payload: { properties: { error: 'invalid_coupon' } },
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
          attributes: {
            'event.phase': 'instant',
            'http.method': 'POST',
            'http.url.normalized': '/v1/coupon/apply',
            'http.status_code': 422,
            'http.success': false,
            'http.request_id': 'req-smoke',
            'http.request.size_bytes': 24,
            'http.response.size_bytes': 48,
          },
          payload: {
            url: 'https://api.example.com/v1/coupon/apply?source=smoke',
            http: { detail: { response: { body: '{"code":"COUPON_01","data":null}' } } },
          },
        },
      ],
    }),
  });
  assert.equal(response.status, 202);
}

function assertHttpBusinessCodeStates(): void {
  const base = { name: 'http.client', attributes: { 'event.phase': 'instant' } };
  assert.deepEqual(httpCatalogFieldsOf({ ...base, payload: {} }).businessCodeState, 'absent');
  assert.deepEqual(httpCatalogFieldsOf({ ...base, payload: { 'http.detail_dropped': true } }).businessCodeState, 'detail_unavailable');
  assert.deepEqual(
    httpCatalogFieldsOf({ ...base, payload: { http: { detail: { response: { body: 'not-json' } } } } }).businessCodeState,
    'parse_failed',
  );
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

async function postSdkReliabilityEvents(): Promise<void> {
  const baseEvent = {
    signalType: 'sdk',
    sessionId: 'ses_sdk',
    resource: {
      app: { appKey: 'smoke_app', appName: 'Smoke App', appVersion: '1.0.0', environment: 'dev' },
      device: { platform: 'android', model: 'Pixel', deviceTier: 'high' },
    },
    context: { user: { userId: 'user_smoke' }, route: { name: '/detail' }, native: { available: false, platform: 'android' } },
    payload: {},
  };
  const response = await fetch(`${baseUrl}/api/monitor/v1/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      events: [
        {
          ...baseEvent,
          eventId: 'evt_sdk_config',
          timestamp: '2026-05-29T10:00:02.000Z',
          name: 'sdk.config.applied',
          status: 'ok',
          attributes: {
            'sdk.output.mode': 'production',
            'sdk.config.version': 'local-1',
            'sdk.config.source': 'local',
          },
        },
        {
          ...baseEvent,
          eventId: 'evt_sdk_state',
          timestamp: '2026-05-29T10:00:02.100Z',
          name: 'sdk.queue.state',
          status: 'ok',
          attributes: {
            'sdk.output.mode': 'production',
            'sdk.queue.length': 12,
            'sdk.queue.bytes': 4096,
          },
        },
        {
          ...baseEvent,
          eventId: 'evt_sdk_retry',
          timestamp: '2026-05-29T10:00:02.200Z',
          name: 'sdk.retry.schedule',
          status: 'ok',
          attributes: {
            'sdk.output.mode': 'production',
            'sdk.retry.count': 2,
            'sdk.retry.delay_ms': 800,
            'sdk.retry.reason': 'server_error',
            'sdk.batch.size': 4,
          },
        },
        {
          ...baseEvent,
          eventId: 'evt_sdk_drop',
          timestamp: '2026-05-29T10:00:02.300Z',
          name: 'sdk.queue.drop',
          status: 'error',
          attributes: {
            'sdk.output.mode': 'production',
            'sdk.drop.count': 3,
            'sdk.drop.reason': 'rate_limited',
            'sdk.queue.length': 12,
            'sdk.queue.bytes': 4096,
          },
        },
        {
          ...baseEvent,
          eventId: 'evt_sdk_flush',
          timestamp: '2026-05-29T10:00:02.400Z',
          name: 'sdk.output.flush',
          status: 'timeout',
          attributes: {
            'sdk.output.mode': 'production',
            'sdk.flush.reason': 'interval',
            'sdk.flush.duration_ms': 1200,
            'sdk.batch.size': 4,
            'sdk.batch.bytes': 2048,
          },
        },
      ],
    }),
  });
  assert.equal(response.status, 202);
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
