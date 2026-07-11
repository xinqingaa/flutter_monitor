import type { EventFilters, HttpCatalogQuery } from '../store/event-types';

type QueryValue = string | string[] | undefined;

export function filtersFromQuery(query: Record<string, QueryValue>): EventFilters {
  return {
    sessionId: readQueryString(query, 'sessionId'),
    appKey: readQueryStringList(query, 'appKey'),
    appName: readQueryStringList(query, 'appName'),
    packageName: readQueryStringList(query, 'packageName'),
    channel: readQueryStringList(query, 'channel'),
    flavor: readQueryStringList(query, 'flavor'),
    buildNumber: readQueryStringList(query, 'buildNumber'),
    userId: readQueryString(query, 'userId'),
    from: readQueryString(query, 'from'),
    to: readQueryString(query, 'to'),
    appVersion: readQueryStringList(query, 'appVersion'),
    environment: readQueryStringList(query, 'environment'),
    devicePlatform: readQueryStringList(query, 'devicePlatform'),
    deviceModel: readQueryStringList(query, 'deviceModel'),
    deviceTier: readQueryStringList(query, 'deviceTier'),
    osVersion: readQueryStringList(query, 'osVersion'),
    nativeAvailable: readQueryBoolean(query, 'nativeAvailable'),
    nativePlatform: readQueryStringList(query, 'nativePlatform'),
    route: readQueryStringList(query, 'route'),
    status: readQueryStringList(query, 'status'),
    name: readQueryStringList(query, 'name'),
    signalType: readQueryStringList(query, 'signalType'),
    problemType: readQueryStringList(query, 'problemType'),
    limit: readQueryNumber(query, 'limit'),
    offset: readQueryNumber(query, 'offset'),
  };
}

export function httpCatalogQueryFromQuery(query: Record<string, QueryValue>): HttpCatalogQuery {
  return {
    ...filtersFromQuery(query),
    url: readQueryString(query, 'url'),
    method: readQueryStringList(query, 'method'),
    result: readHttpResult(query),
    requestId: readQueryString(query, 'requestId'),
    statusCode: readQueryNumberList(query, 'statusCode'),
    businessCode: readQueryStringList(query, 'businessCode'),
    host: readQueryString(query, 'host'),
    slowOnly: readQueryBoolean(query, 'slowOnly'),
    slowThresholdMs: readQueryNumber(query, 'slowThresholdMs'),
  };
}

export function clampLimit(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 500);
}

export function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function readQueryString(query: Record<string, QueryValue>, key: string): string | undefined {
  const value = query[key];
  if (Array.isArray(value)) return stringOrUndefined(value[0]);
  return stringOrUndefined(value);
}

function readQueryStringList(query: Record<string, QueryValue>, key: string): string[] | undefined {
  const value = query[key];
  const rawValues = Array.isArray(value) ? value : [value];
  const values = rawValues
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return values.length > 0 ? [...new Set(values)] : undefined;
}

function readQueryNumber(query: Record<string, QueryValue>, key: string): number | undefined {
  const value = readQueryString(query, key);
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readQueryNumberList(query: Record<string, QueryValue>, key: string): number[] | undefined {
  const values = readQueryStringList(query, key)
    ?.map((value) => Number.parseInt(value, 10))
    .filter(Number.isFinite);
  return values?.length ? [...new Set(values)] : undefined;
}

function readHttpResult(query: Record<string, QueryValue>): HttpCatalogQuery['result'] {
  const value = readQueryString(query, 'result');
  return value === 'success' || value === 'failed' || value === 'unknown' ? value : undefined;
}

function readQueryBoolean(query: Record<string, QueryValue>, key: string): boolean | undefined {
  const value = readQueryString(query, key);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
