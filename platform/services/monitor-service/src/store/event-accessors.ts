import type { MonitorEvent } from './event-types';

export function eventTimeValue(event: MonitorEvent): number {
  const timestamp = readString(event, 'timestamp') ?? readString(event, 'startTime');
  const value = Date.parse(timestamp ?? '');
  return Number.isNaN(value) ? 0 : value;
}

export function userIdOf(event: MonitorEvent): string | undefined {
  return stringValue(readPath(event, ['context', 'user', 'userId']));
}

export function appKeyOf(event: MonitorEvent): string | undefined {
  return stringValue(readPath(event, ['resource', 'app', 'appKey']));
}

export function appNameOf(event: MonitorEvent): string | undefined {
  return stringValue(readPath(event, ['resource', 'app', 'appName']));
}

export function packageNameOf(event: MonitorEvent): string | undefined {
  return stringValue(readPath(event, ['resource', 'app', 'packageName']));
}

export function buildNumberOf(event: MonitorEvent): string | undefined {
  return stringValue(readPath(event, ['resource', 'app', 'buildNumber']));
}

export function channelOf(event: MonitorEvent): string | undefined {
  return stringValue(readPath(event, ['resource', 'app', 'channel']));
}

export function flavorOf(event: MonitorEvent): string | undefined {
  return stringValue(readPath(event, ['resource', 'app', 'flavor']));
}

export function routeOf(event: MonitorEvent): string | undefined {
  return stringValue(readPath(event, ['context', 'route', 'name']));
}

export function appVersionOf(event: MonitorEvent): string | undefined {
  return stringValue(readPath(event, ['resource', 'app', 'appVersion']));
}

export function environmentOf(event: MonitorEvent): string | undefined {
  return stringValue(readPath(event, ['resource', 'app', 'environment']));
}

export function devicePlatformOf(event: MonitorEvent): string | undefined {
  return stringValue(readPath(event, ['resource', 'device', 'platform']));
}

export function deviceModelOf(event: MonitorEvent): string | undefined {
  return stringValue(readPath(event, ['resource', 'device', 'model']));
}

export function deviceManufacturerOf(event: MonitorEvent): string | undefined {
  return stringValue(readPath(event, ['resource', 'device', 'manufacturer']));
}

export function deviceTierOf(event: MonitorEvent): string | undefined {
  return stringValue(readPath(event, ['resource', 'device', 'deviceTier']));
}

export function osVersionOf(event: MonitorEvent): string | undefined {
  return stringValue(readPath(event, ['resource', 'device', 'osVersion']));
}

export function nativeAvailableOf(event: MonitorEvent): boolean | undefined {
  const value = readPath(event, ['context', 'native', 'available']);
  return typeof value === 'boolean' ? value : undefined;
}

export function nativePlatformOf(event: MonitorEvent): string | undefined {
  return stringValue(readPath(event, ['context', 'native', 'platform']));
}

export function nativeVersionOf(event: MonitorEvent): string | undefined {
  return stringValue(readPath(event, ['resource', 'sdk', 'nativeVersion']));
}

export function statusOf(event: MonitorEvent): string | undefined {
  return readString(event, 'status');
}

export function signalTypeOf(event: MonitorEvent): string | undefined {
  return readString(event, 'signalType');
}

export function nameOf(event: MonitorEvent): string | undefined {
  return readString(event, 'name');
}

export function isErrorEvent(event: MonitorEvent): boolean {
  if (isCompletedHttpEvent(event)) return isFailedHttpEvent(event);
  if (isBusinessFailureEvent(event)) return false;
  return isStabilityErrorEvent(event);
}

export function isStabilityErrorEvent(event: MonitorEvent): boolean {
  if (isCompletedHttpEvent(event)) return false;
  if (isBusinessFailureEvent(event)) return false;
  return statusOf(event) === 'error' ||
    signalTypeOf(event) === 'error' ||
    stringAttribute(event, 'error.type') !== undefined ||
    stringAttribute(event, 'error.mechanism') !== undefined ||
    readPath(event, ['payload', 'error']) !== undefined;
}

export function isBusinessFailureEvent(event: MonitorEvent): boolean {
  return stringAttribute(event, 'business.action') !== undefined &&
    stringAttribute(event, 'business.result') === 'failed';
}

export function isJankEvent(event: MonitorEvent): boolean {
  const name = nameOf(event);
  return name === 'ui.jank.sequence';
}

export function isCompletedHttpEvent(event: MonitorEvent): boolean {
  return nameOf(event) === 'http.client' &&
    readPath(event, ['attributes', 'event.phase']) === 'instant';
}

export function isFailedHttpEvent(event: MonitorEvent): boolean {
  if (!isCompletedHttpEvent(event)) return false;
  return statusOf(event) === 'error' || readPath(event, ['attributes', 'http.success']) === false;
}

export function problemTypeOf(event: MonitorEvent): string | undefined {
  if (isFailedHttpEvent(event)) return 'failed_http';
  if (isBusinessFailureEvent(event)) return 'business_failure';
  if (isStabilityErrorEvent(event)) return 'error';
  if (isJankEvent(event)) return 'jank';
  if (isMemoryLeakSuspectEvent(event)) return 'memory_leak_suspect';
  if (isMemoryGrowthIssue(event)) return 'memory_growth';
  if (isMemoryPressureEvent(event)) return 'memory_pressure';
  if (isSlowStartupEvent(event)) return 'slow_startup';
  if (isSlowPageEvent(event)) return 'slow_page';
  return undefined;
}

export function numericAttribute(event: MonitorEvent, key: string): number | undefined {
  const value = readPath(event, ['attributes', key]);
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function booleanAttribute(event: MonitorEvent, key: string): boolean | undefined {
  const value = readPath(event, ['attributes', key]);
  return typeof value === 'boolean' ? value : undefined;
}

export function httpCatalogFieldsOf(event: MonitorEvent): {
  method?: string;
  url?: string;
  host?: string;
  statusCode?: number;
  requestId?: string;
  success?: boolean;
  businessCode?: string;
  businessCodeState: 'value' | 'absent' | 'detail_unavailable' | 'parse_failed';
} {
  const normalizedUrl = stringAttribute(event, 'http.url.normalized');
  const rawUrl = stringValue(readPath(event, ['payload', 'url']));
  const url = rawUrl ?? normalizedUrl;
  let host: string | undefined;
  if (url) {
    try {
      host = new URL(url).host || undefined;
    } catch {
      host = undefined;
    }
  }

  const detailDropped = readPath(event, ['payload', 'http.detail_dropped']) === true;
  const flatDetail = readPath(event, ['payload', 'http.detail']);
  const nestedDetail = readPath(event, ['payload', 'http', 'detail']);
  const detail = isRecord(flatDetail) ? flatDetail : nestedDetail;
  const response = isRecord(detail) ? detail.response : undefined;
  const body = isRecord(response) ? response.body : undefined;
  const bodyTruncated = isRecord(response) && response.body_truncated === true;
  const business = businessCodeFromBody(body);
  const businessCodeState = detailDropped || bodyTruncated
    ? 'detail_unavailable'
    : business.state;

  return {
    method: stringAttribute(event, 'http.method'),
    url,
    host,
    statusCode: numericAttribute(event, 'http.status_code'),
    requestId: stringAttribute(event, 'http.request_id') ?? stringValue(readPath(event, ['payload', 'request_id'])),
    success: booleanAttribute(event, 'http.success'),
    businessCode: businessCodeState === 'value' ? business.value : undefined,
    businessCodeState,
  };
}

export function domainCatalogFieldsOf(event: MonitorEvent): {
  businessAction?: string;
  businessResult?: string;
  errorType?: string;
  errorMechanism?: string;
  errorFatal?: boolean;
  errorHandled?: boolean;
  errorMessage?: string;
} {
  const payloadError = readPath(event, ['payload', 'error']);
  return {
    businessAction: stringAttribute(event, 'business.action'),
    businessResult: stringAttribute(event, 'business.result'),
    errorType: stringAttribute(event, 'error.type') ?? (isRecord(payloadError) ? stringValue(payloadError.type) : undefined),
    errorMechanism: stringAttribute(event, 'error.mechanism'),
    errorFatal: booleanAttribute(event, 'error.fatal'),
    errorHandled: booleanAttribute(event, 'error.handled'),
    errorMessage: stringAttribute(event, 'error.message') ?? stringValue(readPath(event, ['payload', 'payload.error.message'])) ?? (isRecord(payloadError) ? stringValue(payloadError.message) : undefined) ?? stringValue(readPath(event, ['payload', 'message'])),
  };
}

export function numericPayload(event: MonitorEvent, key: string): number | undefined {
  const value = readPath(event, ['payload', key]);
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stringAttribute(event: MonitorEvent, key: string): string | undefined {
  return stringValue(readPath(event, ['attributes', key]));
}

function readString(event: MonitorEvent, key: string): string | undefined {
  const value = event[key];
  return stringValue(value);
}

function readPath(event: MonitorEvent, path: string[]): unknown {
  let current: unknown = event;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function businessCodeFromBody(body: unknown): { state: 'value' | 'absent' | 'parse_failed'; value?: string } {
  if (body === undefined || body === null || body === '') return { state: 'absent' };
  let parsed = body;
  if (typeof body === 'string') {
    try {
      parsed = JSON.parse(body);
    } catch {
      return { state: 'parse_failed' };
    }
  }
  if (!isRecord(parsed)) return { state: 'parse_failed' };
  if (!Object.prototype.hasOwnProperty.call(parsed, 'code')) return { state: 'absent' };
  const code = parsed.code;
  if (typeof code === 'string' || typeof code === 'number') return { state: 'value', value: String(code) };
  return { state: 'parse_failed' };
}

function isMemoryPressureEvent(event: MonitorEvent): boolean {
  const name = nameOf(event);
  if (name !== 'memory.pressure' && name !== 'native.memory.pressure') return false;
  const level = readPath(event, ['attributes', 'memory.pressure_level']);
  return level === undefined || (typeof level === 'string' && level !== '' && level !== 'none');
}

function isMemoryGrowthIssue(event: MonitorEvent): boolean {
  if (nameOf(event) !== 'memory.growth') return false;
  const level = String(event.level ?? event.status ?? '');
  const growth = readPath(event, ['attributes', 'memory.growth_mb']);
  return level.includes('warn') || (typeof growth === 'number' && growth > 0);
}

function isMemoryLeakSuspectEvent(event: MonitorEvent): boolean {
  return nameOf(event) === 'memory.leak.suspect';
}

function isSlowStartupEvent(event: MonitorEvent): boolean {
  const name = nameOf(event);
  return (name === 'app.cold_start' || name === 'app.hot_start') &&
    typeof event.durationMs === 'number' &&
    event.durationMs >= 1000;
}

function isSlowPageEvent(event: MonitorEvent): boolean {
  const name = nameOf(event);
  if (name !== 'page.load') return false;
  const loadMs = readPath(event, ['attributes', 'page.load_ms']);
  const firstFrameMs = readPath(event, ['attributes', 'page.first_frame_ms']);
  const duration = typeof loadMs === 'number'
    ? loadMs
    : typeof firstFrameMs === 'number'
      ? firstFrameMs
      : event.durationMs;
  return (duration ?? 0) >= 1000;
}
