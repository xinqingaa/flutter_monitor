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
  return stringPath(event, ['context', 'module', 'scene']) ?? '-';
}

export function httpStatusOf(event?: MonitorEvent): string {
  const value = readPath(event, ['attributes', 'http.status_code']);
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
  if (name === 'http.client') return 'http';
  if (isSdkMemoryEventName(name)) return 'memory';
  if (name === 'interaction.measure' || readPath(event, ['attributes', 'interaction.mode']) !== undefined) return 'interaction';
  if (readPath(event, ['attributes', 'business.action']) !== undefined) return 'business';
  if (event.signalType === 'error' || event.status === 'error') return 'error';
  if (name.includes('jank')) return 'jank';
  if (name.startsWith('page.') || name === 'route.push' || name === 'route.pop') return 'page';
  if (name === 'app.cold_start' || name === 'app.hot_start' || name.includes('startup') || name.includes('start')) {
    return 'startup';
  }
  if (name.includes('lifecycle')) return 'lifecycle';
  if (name.startsWith('business.')) return 'business';
  return event.signalType ?? 'event';
}

function isSdkMemoryEventName(name: string): boolean {
  return name.startsWith('memory.') || name.startsWith('native.memory.');
}

export function issueLabels(event: MonitorEvent): string[] {
  const labels: string[] = [];
  const kind = eventKind(event);
  if (kind === 'http' && (event.status === 'error' || readPath(event, ['attributes', 'http.success']) === false)) {
    labels.push('请求失败');
  } else if (kind === 'business' && isFailedBusinessEvent(event)) {
    labels.push('业务失败');
  } else if (event.status === 'error' || event.signalType === 'error') {
    labels.push('错误');
  }
  if (kind === 'jank') labels.push('卡顿');
  if (kind === 'interaction' && isSlowInteractionEvent(event)) labels.push('交互慢');
  if (kind === 'startup' && (event.durationMs ?? 0) >= 1000) labels.push('启动慢');
  if (kind === 'page' && isSlowPagePerformanceEvent(event)) labels.push('页面慢');
  if (kind === 'memory') {
    if (isMemoryPressureEvent(event)) labels.push('内存压力');
    else if (event.name === 'memory.leak.suspect') labels.push('疑似泄漏');
    else if (event.name === 'memory.growth' && isMemoryGrowthIssue(event)) labels.push('内存增长');
  }
  return labels;
}

function isMemoryPressureEvent(event: MonitorEvent): boolean {
  if (event.name !== 'memory.pressure' && event.name !== 'native.memory.pressure') return false;
  const level = readPath(event, ['attributes', 'memory.pressure_level']);
  return level === undefined || (typeof level === 'string' && level !== '' && level !== 'none');
}

function isMemoryGrowthIssue(event: MonitorEvent): boolean {
  const level = String(event.level ?? event.status ?? '');
  const growth = readPath(event, ['attributes', 'memory.growth_mb']);
  return level.includes('warn') || (typeof growth === 'number' && growth > 0);
}

function isSlowPagePerformanceEvent(event: MonitorEvent): boolean {
  if (event.name !== 'page.load') return false;
  const loadMs = readPath(event, ['attributes', 'page.load_ms']);
  const firstFrameMs = readPath(event, ['attributes', 'page.first_frame_ms']);
  const duration = typeof loadMs === 'number'
    ? loadMs
    : typeof firstFrameMs === 'number'
      ? firstFrameMs
      : event.durationMs;
  return (duration ?? 0) >= 1000;
}

export function eventKindLabel(event?: MonitorEvent): string {
  const kind = eventKind(event);
  const labels: Record<string, string> = {
    error: '错误',
    http: '网络请求',
    jank: '卡顿',
    page: '页面',
    startup: '启动',
    memory: '内存',
    lifecycle: '生命周期',
    interaction: '交互性能',
    business: '业务',
    event: '事件',
    trace: '链路',
    span: '阶段',
    metric: '指标',
    breadcrumb: '足迹',
  };
  return labels[kind] ?? kind;
}

function isSlowInteractionEvent(event: MonitorEvent): boolean {
  const maxMs = readPath(event, ['attributes', 'frame.max_ms']);
  const budgetMs = readPath(event, ['attributes', 'frame.budget_ms']);
  const slowCount = readPath(event, ['attributes', 'frame.slow_count']);
  return (typeof slowCount === 'number' && slowCount > 0) ||
    (
      typeof maxMs === 'number' &&
      typeof budgetMs === 'number' &&
      maxMs > budgetMs * 2
    );
}

function isFailedBusinessEvent(event: MonitorEvent): boolean {
  return event.status === 'error' || readPath(event, ['attributes', 'business.result']) === 'failed';
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
