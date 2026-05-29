import type { JsonObject, MonitorEvent } from './types';

export function routeOf(event: MonitorEvent): string {
  return stringPath(event, ['context', 'route', 'name']) ?? '-';
}

export function userIdOf(event: MonitorEvent): string {
  return stringPath(event, ['context', 'user', 'userId']) ?? '-';
}

export function appVersionOf(event: MonitorEvent): string {
  return stringPath(event, ['resource', 'app', 'appVersion']) ?? '-';
}

export function environmentOf(event: MonitorEvent): string {
  return stringPath(event, ['resource', 'app', 'environment']) ?? '-';
}

export function breadcrumbsOf(event: MonitorEvent): JsonObject[] {
  const payload = event.payload;
  const candidates = [
    payload?.breadcrumbs,
    payload?.['payload.breadcrumbs'],
    payload?.['breadcrumbs'],
  ];
  for (const value of candidates) {
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [];
}

export function eventKind(event: MonitorEvent): string {
  const name = event.name ?? '';
  if (event.signalType === 'error' || event.status === 'error') return 'error';
  if (name === 'http.client') return 'http';
  if (name.includes('jank')) return 'jank';
  if (name.startsWith('page.') || name === 'route.push') return 'page';
  if (name.includes('start')) return 'startup';
  if (name.includes('memory')) return 'memory';
  if (name.includes('lifecycle')) return 'lifecycle';
  if (name.startsWith('business.')) return 'business';
  return event.signalType ?? 'event';
}

export function formatTime(timestamp?: string): string {
  if (!timestamp) return '--:--:--';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  }).format(date);
}

export function formatDuration(value?: number): string {
  if (typeof value !== 'number') return '-';
  if (value >= 1000) return `${(value / 1000).toFixed(2)}s`;
  return `${Math.round(value)}ms`;
}

function stringPath(event: MonitorEvent, path: string[]): string | undefined {
  let current: unknown = event;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return typeof current === 'string' && current.length > 0 ? current : undefined;
}

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
