import type { Request } from 'express';
import type { EventFilters } from '../store/event-types.js';

export function filtersFromRequest(req: Request): EventFilters {
  return {
    appKey: readQueryStringList(req, 'appKey'),
    appName: readQueryStringList(req, 'appName'),
    packageName: readQueryStringList(req, 'packageName'),
    channel: readQueryStringList(req, 'channel'),
    flavor: readQueryStringList(req, 'flavor'),
    buildNumber: readQueryStringList(req, 'buildNumber'),
    userId: readQueryString(req, 'userId'),
    from: readQueryString(req, 'from'),
    to: readQueryString(req, 'to'),
    appVersion: readQueryStringList(req, 'appVersion'),
    environment: readQueryStringList(req, 'environment'),
    devicePlatform: readQueryStringList(req, 'devicePlatform'),
    deviceModel: readQueryStringList(req, 'deviceModel'),
    deviceTier: readQueryStringList(req, 'deviceTier'),
    osVersion: readQueryStringList(req, 'osVersion'),
    nativeAvailable: readQueryBoolean(req, 'nativeAvailable'),
    nativePlatform: readQueryStringList(req, 'nativePlatform'),
    route: readQueryStringList(req, 'route'),
    status: readQueryStringList(req, 'status'),
    name: readQueryStringList(req, 'name'),
    signalType: readQueryStringList(req, 'signalType'),
    problemType: readQueryStringList(req, 'problemType'),
    limit: readQueryNumber(req, 'limit'),
    offset: readQueryNumber(req, 'offset'),
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

function readQueryString(req: Request, key: string): string | undefined {
  const value = req.query[key];
  if (Array.isArray(value)) return stringOrUndefined(value[0]);
  return stringOrUndefined(value);
}

function readQueryStringList(req: Request, key: string): string[] | undefined {
  const value = req.query[key];
  const rawValues = Array.isArray(value) ? value : [value];
  const values = rawValues
    .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return values.length > 0 ? [...new Set(values)] : undefined;
}

function readQueryNumber(req: Request, key: string): number | undefined {
  const value = readQueryString(req, key);
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readQueryBoolean(req: Request, key: string): boolean | undefined {
  const value = readQueryString(req, key);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
