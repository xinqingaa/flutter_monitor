import type { Request } from 'express';
import type { EventFilters } from '../store/event-types.js';

export function filtersFromRequest(req: Request): EventFilters {
  return {
    userId: readQueryString(req, 'userId'),
    from: readQueryString(req, 'from'),
    to: readQueryString(req, 'to'),
    appVersion: readQueryString(req, 'appVersion'),
    environment: readQueryString(req, 'environment'),
    route: readQueryString(req, 'route'),
    status: readQueryString(req, 'status'),
    name: readQueryString(req, 'name'),
    signalType: readQueryString(req, 'signalType'),
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

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
