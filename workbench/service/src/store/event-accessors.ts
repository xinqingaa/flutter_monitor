import type { MonitorEvent } from './event-types.js';

export function eventTimeValue(event: MonitorEvent): number {
  const timestamp = readString(event, 'timestamp') ?? readString(event, 'startTime');
  const value = Date.parse(timestamp ?? '');
  return Number.isNaN(value) ? 0 : value;
}

export function userIdOf(event: MonitorEvent): string | undefined {
  return stringValue(readPath(event, ['context', 'user', 'userId']));
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
  return statusOf(event) === 'error' || signalTypeOf(event) === 'error';
}

export function isJankEvent(event: MonitorEvent): boolean {
  const name = nameOf(event);
  return name === 'ui.jank.sequence';
}

export function isFailedHttpEvent(event: MonitorEvent): boolean {
  const name = nameOf(event);
  if (name !== 'http.client') return false;
  return statusOf(event) === 'error' || readPath(event, ['attributes', 'http.success']) === false;
}

export function numericAttribute(event: MonitorEvent, key: string): number | undefined {
  const value = readPath(event, ['attributes', key]);
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function numericPayload(event: MonitorEvent, key: string): number | undefined {
  const value = readPath(event, ['payload', key]);
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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
