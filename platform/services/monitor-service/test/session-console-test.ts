import assert from 'node:assert/strict';

import { buildSessionConsole } from '../src/query/session-console';
import type { MonitorEvent } from '../src/store/event-types';

const baseEvent = {
  sessionId: 'ses_console',
  resource: {
    app: { appKey: 'console_app', appName: 'Console App', appVersion: '1.0.0', environment: 'dev' },
    device: { platform: 'android', model: 'Pixel', deviceTier: 'high' },
  },
  context: {
    route: { name: '/performance_gallery' },
    lifecycle: { state: 'resumed', isForeground: true },
  },
  payload: {},
} satisfies Partial<MonitorEvent>;

const events: MonitorEvent[] = [
  event('evt_page_start', '2026-06-15T08:27:27.181Z', 'trace', 'page.visit', {
    traceId: 'trace_page',
    attributes: { 'event.phase': 'start', 'page.instance_id': 'page_gallery_1' },
  }),
  event('evt_route_push', '2026-06-15T08:27:27.181Z', 'breadcrumb', 'route.push', {
    attributes: { 'event.phase': 'end', 'page.instance_id': 'page_gallery_1' },
  }),
  event('evt_page_load', '2026-06-15T08:27:27.232Z', 'span', 'page.load', {
    durationMs: 51,
    attributes: { 'event.phase': 'end', 'page.instance_id': 'page_gallery_1', 'page.first_frame_ms': 51 },
  }),
  event('evt_inactive', '2026-06-15T08:27:28.184Z', 'breadcrumb', 'app.lifecycle', {
    context: { ...baseEvent.context, lifecycle: { state: 'inactive', previousState: 'resumed', isForeground: false } },
  }),
  event('evt_health_background', '2026-06-15T08:27:29.145Z', 'sdk', 'sdk.health.report', {
    attributes: {
      'event.phase': 'instant',
      'sdk.output.mode': 'production',
      'sdk.health.enqueued_count': 4,
      'sdk.health.sent_count': 6,
      'sdk.health.dropped_count': 0,
      'sdk.health.retry_count': 0,
      'sdk.health.flush_failure_count': 0,
    },
  }),
  event('evt_paused', '2026-06-15T08:27:29.145Z', 'breadcrumb', 'app.lifecycle', {
    context: { ...baseEvent.context, lifecycle: { state: 'paused', previousState: 'hidden', isForeground: false } },
  }),
  event('evt_flush_ok', '2026-06-15T08:27:29.163Z', 'sdk', 'sdk.lifecycle.flush', {
    status: 'ok',
    attributes: { 'event.phase': 'instant', 'sdk.output.mode': 'production', 'app.exit_flush.success': true },
  }),
  event('evt_resumed', '2026-06-15T08:28:03.633Z', 'breadcrumb', 'app.lifecycle', {
    context: { ...baseEvent.context, lifecycle: { state: 'resumed', previousState: 'paused', isForeground: true } },
  }),
  event('evt_background_duration', '2026-06-15T08:28:03.633Z', 'metric', 'app.background_duration', {
    durationMs: 34489,
    context: { ...baseEvent.context, lifecycle: { state: 'resumed', previousState: 'paused', isForeground: true } },
  }),
  event('evt_hot_start', '2026-06-15T08:28:03.640Z', 'trace', 'app.hot_start', {
    durationMs: 7,
    attributes: {
      'event.phase': 'end',
      'app.start.type': 'hot',
      'app.start.end_reason': 'first_frame',
      'app.first_frame_ms': 7,
    },
  }),
  event('evt_page_resume', '2026-06-15T08:28:03.633Z', 'breadcrumb', 'page.view', {
    attributes: {
      'event.phase': 'instant',
      'page.active_phase': 'page.resume',
      'page.active_trigger': 'lifecycle_resumed',
    },
  }),
  event('evt_health_interval', '2026-06-15T08:28:37.748Z', 'sdk', 'sdk.health.report', {
    attributes: {
      'event.phase': 'instant',
      'sdk.output.mode': 'production',
      'sdk.health.enqueued_count': 2,
      'sdk.health.sent_count': 4,
      'sdk.health.dropped_count': 0,
      'sdk.health.retry_count': 0,
      'sdk.health.flush_failure_count': 0,
    },
  }),
];

const consoleData = buildSessionConsole('ses_console', events);
assert.equal(consoleData.segments.length, 1);
assert.equal(consoleData.segments[0]?.title, '页面 /performance_gallery');
assert.equal(consoleData.segments[0]?.eventCount, events.length);
assert.equal(consoleData.segments[0]?.groupCounts.sdk, 3);
assert.equal(consoleData.segments[0]?.summaryItems.some((item) => item.label === 'SDK' && item.value === '3'), true);
assert.equal(consoleData.segments[0]?.summaryItems.some((item) => item.label === '问题'), false);

const hotStart = consoleData.rows.find((row) => row.eventId === 'evt_hot_start');
assert.ok(hotStart);
assert.equal(hotStart.metrics.some((metric) => metric.label === '后台'), false);
assert.equal(hotStart.metrics.some((metric) => metric.label === '热重启' && metric.value === '7ms'), true);
assert.equal(hotStart.metrics.some((metric) => metric.label === '首帧' && metric.value === '7ms'), true);

const sdkHealthConsole = buildSessionConsole('ses_console_sdk', [
  event('evt_health_drop_1', '2026-06-15T08:29:00.000Z', 'sdk', 'sdk.health.report', {
    attributes: {
      'event.phase': 'instant',
      'sdk.health.dropped_count': 1,
      'sdk.health.retry_count': 0,
      'sdk.health.flush_failure_count': 0,
    },
  }),
  event('evt_health_drop_2', '2026-06-15T08:30:00.000Z', 'sdk', 'sdk.health.report', {
    attributes: {
      'event.phase': 'instant',
      'sdk.health.dropped_count': 2,
      'sdk.health.retry_count': 0,
      'sdk.health.flush_failure_count': 1,
    },
  }),
]);
assert.equal(sdkHealthConsole.summary?.sdkDroppedCount, 3);
assert.equal(sdkHealthConsole.summary?.sdkFlushFailureCount, 1);

function event(
  eventId: string,
  timestamp: string,
  signalType: string,
  name: string,
  overrides: Partial<MonitorEvent> = {},
): MonitorEvent {
  return {
    ...baseEvent,
    ...overrides,
    eventId,
    timestamp,
    signalType,
    name,
    status: 'ok',
    attributes: { 'event.phase': 'instant', ...overrides.attributes },
    context: { ...baseEvent.context, ...overrides.context },
    payload: { ...baseEvent.payload, ...overrides.payload },
  };
}
