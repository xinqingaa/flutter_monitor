import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import initSqlJs, { type Database } from 'sql.js';
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

type SqlParam = string | number | null;

type EventRow = {
  envelope_json: string;
};

type SessionRow = {
  session_id: string;
};

type CountRow = {
  count: number;
};

type GroupRow = {
  key: string;
  count: number;
  first_event_id?: string;
  last_event_id?: string;
};

export class SqliteMonitorStore implements MonitorStore {
  private lastIngestAt: string | undefined;

  private constructor(
    private readonly db: Database,
    private readonly filePath: string,
    private readonly maxEvents: number,
  ) {
    this.initializeSchema();
    this.lastIngestAt = this.readLastIngestAt();
  }

  static async open(filePath: string, options: { maxEvents?: number } = {}): Promise<SqliteMonitorStore> {
    const sqlite = await initSqlJs();
    const db = existsSync(filePath)
      ? new sqlite.Database(readFileSync(filePath))
      : new sqlite.Database();
    return new SqliteMonitorStore(db, filePath, options.maxEvents ?? 5000);
  }

  addEvents(incoming: MonitorEvent[]): MonitorEvent[] {
    const accepted: MonitorEvent[] = [];
    for (const event of incoming) {
      ensureEventId(event, accepted.length);
      if (event.eventId) accepted.push(event);
    }
    if (accepted.length === 0) return accepted;

    this.persistEvents(accepted);
    this.enforceLimit();
    this.lastIngestAt = new Date().toISOString();
    this.flushToDisk();
    return accepted;
  }

  getEvent(eventId: string): MonitorEvent | undefined {
    return this.selectEvents('where event_id = ?', [eventId], 'limit 1')[0];
  }

  getSessionEvents(sessionId: string): MonitorEvent[] {
    return this.selectEvents(
      'where session_id = ?',
      [sessionId],
      'order by timestamp_ms asc, sequence asc',
    );
  }

  getTraceEvents(traceId: string): MonitorEvent[] {
    return this.selectEvents(
      'where trace_id = ?',
      [traceId],
      'order by timestamp_ms asc, sequence asc',
    );
  }

  getRecentEvents(limit: number): MonitorEvent[] {
    return this.selectEvents('', [], 'order by timestamp_ms desc, sequence desc limit ?', [
      clampLimit(limit, 50),
    ]);
  }

  groupEvents(by: string): Array<Record<string, unknown>> {
    const column = groupColumn(by);
    const keyName = groupKeyName(by);
    const rows = this.selectRows<GroupRow>(
      `
        select
          coalesce(${column}, '(unknown)') as key,
          count(*) as count,
          (
            select first.event_id
            from events first
            where coalesce(first.${column}, '(unknown)') = coalesce(events.${column}, '(unknown)')
            order by first.timestamp_ms asc, first.sequence asc
            limit 1
          ) as first_event_id,
          (
            select last.event_id
            from events last
            where coalesce(last.${column}, '(unknown)') = coalesce(events.${column}, '(unknown)')
            order by last.timestamp_ms desc, last.sequence desc
            limit 1
          ) as last_event_id
        from events
        group by coalesce(${column}, '(unknown)')
        order by count desc
        limit 500
      `,
    );
    return rows.map((row) => ({
      [keyName]: row.key,
      count: row.count,
      firstEventId: row.first_event_id,
      lastEventId: row.last_event_id,
    }));
  }

  listSessions(filters: EventFilters): {
    sessions: SessionSummary[];
    userIdAvailable: boolean;
  } {
    const userIdAvailable = this.hasAnyUserId();
    const { whereSql, params } = whereFromFilters(filters);
    const limit = clampLimit(filters.limit, 50);
    const rows = this.selectRows<SessionRow>(
      `
        select session_id
        from events
        ${whereSql}
          ${whereSql ? 'and' : 'where'} session_id is not null
        group by session_id
        order by max(timestamp_ms) desc
        limit ?
      `,
      [...params, limit],
    );

    const sessions = rows
      .map((row) => buildSessionSummary(row.session_id, this.getSessionEvents(row.session_id)))
      .filter((summary): summary is SessionSummary => Boolean(summary));

    return { sessions, userIdAvailable };
  }

  searchEvents(query: string, filters: EventFilters): MonitorEvent[] {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];
    const { whereSql, params } = whereFromFilters(filters);
    const jsonPredicate = `${whereSql ? 'and' : 'where'} lower(envelope_json) like ? escape '\\'`;
    return this.selectEvents(
      `${whereSql} ${jsonPredicate}`,
      [...params, `%${escapeLike(normalizedQuery.toLowerCase())}%`],
      'order by timestamp_ms desc, sequence desc limit ?',
      [clampLimit(filters.limit, 50)],
    );
  }

  performanceOverview(filters: EventFilters): PerformanceOverview {
    const events = this.selectFilteredEvents(filters);
    return {
      startup: summarizeMetric(events.filter(isStartupEvent), 1000),
      pages: summarizeMetric(events.filter(isPageEvent), 1000),
      http: summarizeMetric(events.filter(isHttpEvent), 800),
      jank: summarizeMetric(events.filter(isJankEvent), 0),
      errors: summarizeMetric(events.filter(isErrorEvent), 0),
    };
  }

  health(): MonitorStoreHealth {
    return {
      storageMode: 'sqlite',
      eventCount: this.countRows('events'),
      sessionCount: this.countDistinctRows('session_id'),
      traceCount: this.countDistinctRows('trace_id'),
      lastIngestAt: this.lastIngestAt,
    };
  }

  close(): void {
    this.flushToDisk();
    this.db.close();
  }

  private initializeSchema(): void {
    if (this.hasLegacyEventsTable()) this.migrateLegacyEventsTable();
    this.db.run(`
      create table if not exists events (
        sequence integer primary key autoincrement,
        event_id text not null unique,
        session_id text,
        trace_id text,
        span_id text,
        timestamp_ms integer,
        user_id text,
        route text,
        app_version text,
        environment text,
        signal_type text,
        name text,
        status text,
        envelope_json text not null
      );
      create index if not exists idx_events_time on events(timestamp_ms, sequence);
      create index if not exists idx_events_session on events(session_id, timestamp_ms, sequence);
      create index if not exists idx_events_trace on events(trace_id, timestamp_ms, sequence);
      create index if not exists idx_events_user_time on events(user_id, timestamp_ms, sequence);
      create index if not exists idx_events_route_time on events(route, timestamp_ms, sequence);
      create index if not exists idx_events_app_time on events(app_version, environment, timestamp_ms, sequence);
      create index if not exists idx_events_name_time on events(name, signal_type, status, timestamp_ms, sequence);
    `);
    this.flushToDisk();
  }

  private hasLegacyEventsTable(): boolean {
    const columns = this.selectRows<{ name: string }>('pragma table_info(events)');
    return columns.length > 0 && !columns.some((column) => column.name === 'sequence');
  }

  private migrateLegacyEventsTable(): void {
    this.db.run(`
      alter table events rename to events_legacy;
      create table events (
        sequence integer primary key autoincrement,
        event_id text not null unique,
        session_id text,
        trace_id text,
        span_id text,
        timestamp_ms integer,
        user_id text,
        route text,
        app_version text,
        environment text,
        signal_type text,
        name text,
        status text,
        envelope_json text not null
      );
      insert into events (
        event_id,
        session_id,
        trace_id,
        span_id,
        timestamp_ms,
        user_id,
        route,
        app_version,
        environment,
        signal_type,
        name,
        status,
        envelope_json
      )
      select
        event_id,
        session_id,
        trace_id,
        span_id,
        timestamp_ms,
        user_id,
        route,
        app_version,
        environment,
        signal_type,
        name,
        status,
        envelope_json
      from events_legacy
      order by timestamp_ms asc;
      drop table events_legacy;
    `);
  }

  private persistEvents(events: MonitorEvent[]): void {
    const statement = this.db.prepare(`
      insert into events (
        event_id,
        session_id,
        trace_id,
        span_id,
        timestamp_ms,
        user_id,
        route,
        app_version,
        environment,
        signal_type,
        name,
        status,
        envelope_json
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(event_id) do update set
        session_id = excluded.session_id,
        trace_id = excluded.trace_id,
        span_id = excluded.span_id,
        timestamp_ms = excluded.timestamp_ms,
        user_id = excluded.user_id,
        route = excluded.route,
        app_version = excluded.app_version,
        environment = excluded.environment,
        signal_type = excluded.signal_type,
        name = excluded.name,
        status = excluded.status,
        envelope_json = excluded.envelope_json
    `);
    try {
      this.db.run('begin');
      for (const event of events) {
        statement.run([
          event.eventId ?? null,
          event.sessionId ?? null,
          event.traceId ?? null,
          event.spanId ?? null,
          eventTimeValue(event),
          userIdOf(event) ?? null,
          routeOf(event) ?? null,
          appVersionOf(event) ?? null,
          environmentOf(event) ?? null,
          signalTypeOf(event) ?? null,
          nameOf(event) ?? null,
          statusOf(event) ?? null,
          JSON.stringify(event),
        ]);
      }
      this.db.run('commit');
    } catch (error) {
      this.db.run('rollback');
      throw error;
    } finally {
      statement.free();
    }
  }

  private enforceLimit(): void {
    this.db.run(
      `
        delete from events
        where sequence not in (
          select sequence
          from events
          order by timestamp_ms desc, sequence desc
          limit ?
        )
      `,
      [this.maxEvents],
    );
  }

  private selectFilteredEvents(filters: EventFilters): MonitorEvent[] {
    const { whereSql, params } = whereFromFilters(filters);
    return this.selectEvents(whereSql, params, 'order by timestamp_ms asc, sequence asc');
  }

  private selectEvents(
    whereSql: string,
    params: SqlParam[],
    suffixSql: string,
    suffixParams: SqlParam[] = [],
  ): MonitorEvent[] {
    const rows = this.selectRows<EventRow>(
      `select envelope_json from events ${whereSql} ${suffixSql}`,
      [...params, ...suffixParams],
    );
    return rows.map((row) => JSON.parse(row.envelope_json) as MonitorEvent);
  }

  private selectRows<T extends Record<string, unknown>>(sql: string, params: SqlParam[] = []): T[] {
    const statement = this.db.prepare(sql);
    try {
      statement.bind(params);
      const rows: T[] = [];
      while (statement.step()) {
        rows.push(statement.getAsObject() as T);
      }
      return rows;
    } finally {
      statement.free();
    }
  }

  private countRows(tableName: 'events'): number {
    return this.selectRows<CountRow>(`select count(*) as count from ${tableName}`)[0]?.count ?? 0;
  }

  private countDistinctRows(columnName: 'session_id' | 'trace_id'): number {
    return this.selectRows<CountRow>(
      `select count(distinct ${columnName}) as count from events where ${columnName} is not null`,
    )[0]?.count ?? 0;
  }

  private hasAnyUserId(): boolean {
    const row = this.selectRows<CountRow>(
      'select count(*) as count from events where user_id is not null limit 1',
    )[0];
    return (row?.count ?? 0) > 0;
  }

  private readLastIngestAt(): string | undefined {
    const row = this.selectRows<{ timestamp_ms: number }>(
      'select timestamp_ms from events order by timestamp_ms desc, sequence desc limit 1',
    )[0];
    return row ? new Date(row.timestamp_ms).toISOString() : undefined;
  }

  private flushToDisk(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, Buffer.from(this.db.export()));
  }
}

function whereFromFilters(filters: EventFilters): { whereSql: string; params: SqlParam[] } {
  const clauses: string[] = [];
  const params: SqlParam[] = [];
  addEqualityFilter(clauses, params, 'user_id', filters.userId);
  addEqualityFilter(clauses, params, 'app_version', filters.appVersion);
  addEqualityFilter(clauses, params, 'environment', filters.environment);
  addEqualityFilter(clauses, params, 'route', filters.route);
  addEqualityFilter(clauses, params, 'status', filters.status);
  addEqualityFilter(clauses, params, 'name', filters.name);
  addEqualityFilter(clauses, params, 'signal_type', filters.signalType);

  if (filters.from) {
    clauses.push('timestamp_ms >= ?');
    params.push(timestampValue(filters.from));
  }
  if (filters.to) {
    clauses.push('timestamp_ms <= ?');
    params.push(timestampValue(filters.to));
  }

  return {
    whereSql: clauses.length > 0 ? `where ${clauses.join(' and ')}` : '',
    params,
  };
}

function addEqualityFilter(
  clauses: string[],
  params: SqlParam[],
  columnName: string,
  value: string | undefined,
): void {
  if (!value) return;
  clauses.push(`${columnName} = ?`);
  params.push(value);
}

function groupColumn(by: string): string {
  if (by === 'trace') return 'trace_id';
  if (by === 'route') return 'route';
  if (by === 'name') return 'name';
  return 'session_id';
}

function groupKeyName(by: string): string {
  if (by === 'trace') return 'traceId';
  if (by === 'route') return 'route';
  if (by === 'name') return 'name';
  return 'sessionId';
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
    avgMs: average(durations),
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

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildSessionSummary(sessionId: string, events: MonitorEvent[]): SessionSummary | undefined {
  if (events.length === 0) return undefined;
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

function timestampValue(timestamp: string | undefined): number {
  const value = Date.parse(timestamp ?? '');
  return Number.isNaN(value) ? 0 : value;
}

function clampLimit(value: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), 500);
}

function escapeLike(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}
