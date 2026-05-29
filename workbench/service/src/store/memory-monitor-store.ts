import { ensureEventId } from '../ingest/normalize-events.js';
import {
  appVersionOf,
  environmentOf,
  eventTimeValue,
  isErrorEvent,
  isFailedHttpEvent,
  isJankEvent,
  nameOf,
  numericPayload,
  routeOf,
  signalTypeOf,
  statusOf,
  userIdOf,
} from './event-accessors.js';
import type {
  EventFilters,
  MonitorEvent,
  PerformanceMetricSummary,
  PerformanceOverview,
  SessionSummary,
} from './event-types.js';
import type { MonitorStore, MonitorStoreHealth } from './monitor-store.js';

export class MemoryMonitorStore implements MonitorStore {
  private readonly maxEvents: number;
  private readonly events: MonitorEvent[] = [];
  private readonly eventsById = new Map<string, MonitorEvent>();
  private readonly eventsBySession = new Map<string, MonitorEvent[]>();
  private readonly eventsByTrace = new Map<string, MonitorEvent[]>();
  private lastIngestAt: string | undefined;

  constructor(options: { maxEvents?: number } = {}) {
    this.maxEvents = options.maxEvents ?? 5000;
  }

  addEvents(incoming: MonitorEvent[]): MonitorEvent[] {
    const accepted: MonitorEvent[] = [];
    for (const event of incoming) {
      ensureEventId(event, this.events.length + accepted.length);
      const eventId = event.eventId;
      if (!eventId) continue;
      const existing = this.eventsById.get(eventId);
      if (existing) {
        replaceEvent(existing, event);
        accepted.push(existing);
        continue;
      }

      this.events.push(event);
      this.eventsById.set(eventId, event);
      addToIndex(this.eventsBySession, event.sessionId, event);
      addToIndex(this.eventsByTrace, event.traceId, event);
      accepted.push(event);
      this.enforceLimit();
    }
    if (accepted.length > 0) this.lastIngestAt = new Date().toISOString();
    return accepted;
  }

  getEvent(eventId: string): MonitorEvent | undefined {
    return this.eventsById.get(eventId);
  }

  getSessionEvents(sessionId: string): MonitorEvent[] {
    return sortByTime(this.eventsBySession.get(sessionId) ?? []);
  }

  getTraceEvents(traceId: string): MonitorEvent[] {
    return sortByTime(this.eventsByTrace.get(traceId) ?? []);
  }

  getRecentEvents(limit: number): MonitorEvent[] {
    return this.events.slice(-limit).reverse();
  }

  groupEvents(by: string): Array<Record<string, unknown>> {
    if (by === 'trace') return mapToGroups(this.eventsByTrace, 'traceId');
    if (by === 'route') return this.groupByEventValue(routeOf, 'route', '(unknown)');
    if (by === 'name') return this.groupByEventValue(nameOf, 'name', '(unknown)');
    return mapToGroups(this.eventsBySession, 'sessionId');
  }

  listSessions(filters: EventFilters): {
    sessions: SessionSummary[];
    userIdAvailable: boolean;
  } {
    const allEvents = this.events;
    const userIdAvailable = allEvents.some((event) => Boolean(userIdOf(event)));
    const filtered = allEvents.filter((event) => matchesFilters(event, filters));
    const sessions = new Map<string, MonitorEvent[]>();

    for (const event of filtered) {
      if (!event.sessionId) continue;
      addToIndex(sessions, event.sessionId, event);
    }

    const summaries = Array.from(sessions.entries())
      .map(([sessionId, events]) => buildSessionSummary(sessionId, sortByTime(events)))
      .sort((a, b) => timestampValue(b.lastTimestamp) - timestampValue(a.lastTimestamp))
      .slice(0, clampLimit(filters.limit, 50));

    return { sessions: summaries, userIdAvailable };
  }

  searchEvents(query: string, filters: EventFilters): MonitorEvent[] {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];
    const limit = clampLimit(filters.limit, 50);
    return this.events
      .filter((event) => matchesFilters(event, filters))
      .filter((event) => JSON.stringify(event).toLowerCase().includes(normalizedQuery))
      .slice(-limit)
      .reverse();
  }

  performanceOverview(filters: EventFilters): PerformanceOverview {
    const filtered = this.events.filter((event) => matchesFilters(event, filters));
    return {
      startup: summarizeMetric(filtered.filter(isStartupEvent), 1000),
      pages: summarizeMetric(filtered.filter(isPageEvent), 1000),
      http: summarizeMetric(filtered.filter(isHttpEvent), 800),
      jank: summarizeMetric(filtered.filter(isJankEvent), 0),
      errors: summarizeMetric(filtered.filter(isErrorEvent), 0),
    };
  }

  health(): MonitorStoreHealth {
    return {
      storageMode: 'memory',
      eventCount: this.events.length,
      sessionCount: this.eventsBySession.size,
      traceCount: this.eventsByTrace.size,
      lastIngestAt: this.lastIngestAt,
    };
  }

  private enforceLimit(): void {
    while (this.events.length > this.maxEvents) {
      const removed = this.events.shift();
      if (!removed) return;
      if (removed.eventId) this.eventsById.delete(removed.eventId);
      removeFromIndex(this.eventsBySession, removed.sessionId, removed);
      removeFromIndex(this.eventsByTrace, removed.traceId, removed);
    }
  }

  private groupByEventValue(
    valueOf: (event: MonitorEvent) => string | undefined,
    keyName: string,
    fallback: string,
  ): Array<Record<string, unknown>> {
    const index = new Map<string, MonitorEvent[]>();
    for (const event of this.events) addToIndex(index, valueOf(event) ?? fallback, event);
    return mapToGroups(index, keyName);
  }
}

function isStartupEvent(event: MonitorEvent): boolean {
  const name = nameOf(event) ?? '';
  return name === 'app.cold_start' || name === 'app.hot_start' || name.includes('startup');
}

function isPageEvent(event: MonitorEvent): boolean {
  const name = nameOf(event) ?? '';
  return name.startsWith('page.') || name === 'route.push';
}

function isHttpEvent(event: MonitorEvent): boolean {
  return nameOf(event) === 'http.client';
}

function summarizeMetric(events: MonitorEvent[], slowThresholdMs: number): PerformanceMetricSummary {
  const durations = events
    .map((event) => durationOf(event))
    .filter((value): value is number => typeof value === 'number')
    .sort((a, b) => a - b);
  const recent = [...events]
    .sort((a, b) => eventTimeValue(b) - eventTimeValue(a))
    .slice(0, 20)
    .map((event) => ({
      eventId: event.eventId,
      sessionId: event.sessionId,
      traceId: event.traceId,
      name: nameOf(event),
      route: routeOf(event),
      durationMs: durationOf(event),
      status: statusOf(event),
      timestamp: event.timestamp,
    }));

  return {
    count: events.length,
    errorCount: events.filter(isErrorEvent).length,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    maxMs: durations.length > 0 ? durations[durations.length - 1] : undefined,
    slowCount: slowThresholdMs > 0
      ? durations.filter((duration) => duration >= slowThresholdMs).length
      : 0,
    events: recent,
  };
}

function durationOf(event: MonitorEvent): number | undefined {
  if (typeof event.durationMs === 'number') return event.durationMs;
  return numericPayload(event, 'durationMs');
}

function percentile(values: number[], ratio: number): number | undefined {
  if (values.length === 0) return undefined;
  const index = Math.ceil(values.length * ratio) - 1;
  return values[Math.min(Math.max(index, 0), values.length - 1)];
}

function buildSessionSummary(sessionId: string, events: MonitorEvent[]): SessionSummary {
  const first = events[0];
  const last = events[events.length - 1];
  const firstWithUser = events.find((event) => Boolean(userIdOf(event)));
  const firstWithApp = events.find((event) => Boolean(appVersionOf(event) || environmentOf(event)));
  const lastWithRoute = [...events].reverse().find((event) => Boolean(routeOf(event)));
  const status = events.some(isErrorEvent)
    ? 'error'
    : [...events].reverse().map(statusOf).find(Boolean);

  return {
    sessionId,
    count: events.length,
    firstTimestamp: first?.timestamp,
    lastTimestamp: last?.timestamp,
    firstEventId: first?.eventId,
    lastEventId: last?.eventId,
    userId: firstWithUser ? userIdOf(firstWithUser) : undefined,
    appVersion: firstWithApp ? appVersionOf(firstWithApp) : undefined,
    environment: firstWithApp ? environmentOf(firstWithApp) : undefined,
    route: lastWithRoute ? routeOf(lastWithRoute) : undefined,
    status,
    errorCount: events.filter(isErrorEvent).length,
    jankCount: events.filter(isJankEvent).length,
    failedHttpCount: events.filter(isFailedHttpEvent).length,
  };
}

function matchesFilters(event: MonitorEvent, filters: EventFilters): boolean {
  if (filters.userId && userIdOf(event) !== filters.userId) return false;
  if (filters.appVersion && appVersionOf(event) !== filters.appVersion) return false;
  if (filters.environment && environmentOf(event) !== filters.environment) return false;
  if (filters.route && routeOf(event) !== filters.route) return false;
  if (filters.status && statusOf(event) !== filters.status) return false;
  if (filters.name && nameOf(event) !== filters.name) return false;
  if (filters.signalType && signalTypeOf(event) !== filters.signalType) return false;

  const eventTime = eventTimeValue(event);
  if (filters.from && eventTime < timestampValue(filters.from)) return false;
  if (filters.to && eventTime > timestampValue(filters.to)) return false;
  return true;
}

function sortByTime(events: MonitorEvent[]): MonitorEvent[] {
  return [...events].sort((a, b) => eventTimeValue(a) - eventTimeValue(b));
}

function mapToGroups(index: Map<string, MonitorEvent[]>, keyName: string): Array<Record<string, unknown>> {
  return Array.from(index.entries()).map(([key, list]) => ({
    [keyName]: key,
    count: list.length,
    firstEventId: list[0]?.eventId,
    lastEventId: list[list.length - 1]?.eventId,
  }));
}

function addToIndex(index: Map<string, MonitorEvent[]>, key: string | undefined, event: MonitorEvent): void {
  if (!key) return;
  if (!index.has(key)) index.set(key, []);
  index.get(key)?.push(event);
}

function removeFromIndex(
  index: Map<string, MonitorEvent[]>,
  key: string | undefined,
  event: MonitorEvent,
): void {
  if (!key || !index.has(key)) return;
  const list = (index.get(key) ?? []).filter((item) => item !== event);
  if (list.length === 0) {
    index.delete(key);
  } else {
    index.set(key, list);
  }
}

function replaceEvent(target: MonitorEvent, source: MonitorEvent): void {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, source);
}

function timestampValue(timestamp: string | undefined): number {
  const value = Date.parse(timestamp ?? '');
  return Number.isNaN(value) ? 0 : value;
}

function clampLimit(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 500);
}
