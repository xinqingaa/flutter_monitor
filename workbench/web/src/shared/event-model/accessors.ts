import type { JsonObject, MonitorEvent } from '../datasource/types';

export function routeOf(event?: MonitorEvent): string {
  return stringPath(event, ['context', 'route', 'name']) ?? '-';
}

export function userIdOf(event?: MonitorEvent): string {
  return stringPath(event, ['context', 'user', 'userId']) ?? '-';
}

export function appVersionOf(event?: MonitorEvent): string {
  return stringPath(event, ['resource', 'app', 'appVersion']) ?? '-';
}

export function environmentOf(event?: MonitorEvent): string {
  return stringPath(event, ['resource', 'app', 'environment']) ?? '-';
}

export function deviceOf(event?: MonitorEvent): string {
  const model = stringPath(event, ['resource', 'device', 'model']);
  const platform = stringPath(event, ['resource', 'device', 'platform']);
  return [platform, model].filter(Boolean).join(' · ') || '-';
}

export function networkOf(event?: MonitorEvent): string {
  return stringPath(event, ['context', 'network', 'type']) ?? '-';
}

export function releaseOf(event?: MonitorEvent): string {
  return stringPath(event, ['context', 'release', 'releaseId']) ?? '-';
}

export function moduleOf(event?: MonitorEvent): string {
  return stringPath(event, ['context', 'module', 'name']) ?? '-';
}

export function sceneOf(event?: MonitorEvent): string {
  return stringPath(event, ['context', 'scene', 'name']) ?? '-';
}

export function httpStatusOf(event?: MonitorEvent): string {
  const value = readPath(event, ['attributes', 'http.statusCode'])
    ?? readPath(event, ['payload', 'statusCode']);
  return value === undefined ? '-' : String(value);
}

export function breadcrumbsOf(event?: MonitorEvent): JsonObject[] {
  const payload = event?.payload;
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

export function eventKind(event?: MonitorEvent): string {
  if (!event) return 'event';
  const name = event.name ?? '';
  if (event.signalType === 'error' || event.status === 'error') return 'error';
  if (name === 'http.client') return 'http';
  if (name.includes('jank')) return 'jank';
  if (name.startsWith('page.') || name === 'route.push') return 'page';
  if (name === 'app.cold_start' || name === 'app.hot_start' || name.includes('startup') || name.includes('start')) {
    return 'startup';
  }
  if (name.includes('memory')) return 'memory';
  if (name.includes('lifecycle')) return 'lifecycle';
  if (name.startsWith('business.')) return 'business';
  return event.signalType ?? 'event';
}

export function issueLabels(event: MonitorEvent): string[] {
  const labels: string[] = [];
  const kind = eventKind(event);
  if (event.status === 'error' || event.signalType === 'error') labels.push('error');
  if (kind === 'http' && (event.status === 'error' || readPath(event, ['attributes', 'http.success']) === false)) {
    labels.push('failed HTTP');
  }
  if (kind === 'jank') labels.push('jank');
  if (kind === 'startup' && (event.durationMs ?? 0) >= 1000) labels.push('slow startup');
  if (kind === 'page' && (event.durationMs ?? 0) >= 1000) labels.push('slow page');
  if (kind === 'memory' && String(event.level ?? event.status ?? '').includes('warn')) labels.push('memory pressure');
  return labels;
}

export function sortEvents(events: MonitorEvent[]): MonitorEvent[] {
  return [...events].sort((a, b) => timeValue(a.timestamp ?? a.startTime) - timeValue(b.timestamp ?? b.startTime));
}

export function readPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

export function stringPath(value: unknown, path: string[]): string | undefined {
  const result = readPath(value, path);
  return typeof result === 'string' && result.length > 0 ? result : undefined;
}

function timeValue(timestamp?: string): number {
  const value = Date.parse(timestamp ?? '');
  return Number.isNaN(value) ? 0 : value;
}

function isRecord(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
