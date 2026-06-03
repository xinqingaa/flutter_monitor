import type { Request } from 'express';
import type { EventFilters } from '../store/event-types.js';

export function filtersFromRequest(req: Request): EventFilters {
  return {
    appKey: readQueryString(req, 'appKey'),
    appName: readQueryString(req, 'appName'),
    packageName: readQueryString(req, 'packageName'),
    channel: readQueryString(req, 'channel'),
    flavor: readQueryString(req, 'flavor'),
    buildNumber: readQueryString(req, 'buildNumber'),
    userId: readQueryString(req, 'userId'),
    from: readQueryString(req, 'from'),
    to: readQueryString(req, 'to'),
    appVersion: readQueryString(req, 'appVersion'),
    environment: readQueryString(req, 'environment'),
    devicePlatform: readQueryString(req, 'devicePlatform'),
    deviceModel: readQueryString(req, 'deviceModel'),
    deviceTier: readQueryString(req, 'deviceTier'),
    osVersion: readQueryString(req, 'osVersion'),
    nativeAvailable: readQueryBoolean(req, 'nativeAvailable'),
    nativePlatform: readQueryString(req, 'nativePlatform'),
    route: readQueryString(req, 'route'),
    status: readQueryString(req, 'status'),
    name: readQueryString(req, 'name'),
    signalType: readQueryString(req, 'signalType'),
    problemType: readQueryString(req, 'problemType'),
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
