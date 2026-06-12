import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import initSqlJs, { type Database } from 'sql.js';
import { hasEventId } from '../ingest/normalize-events';
import {
  appKeyOf,
  appNameOf,
  appVersionOf,
  buildNumberOf,
  channelOf,
  deviceManufacturerOf,
  deviceModelOf,
  devicePlatformOf,
  deviceTierOf,
  environmentOf,
  eventTimeValue,
  flavorOf,
  isCompletedHttpEvent,
  isErrorEvent,
  isBusinessFailureEvent,
  isFailedHttpEvent,
  isJankEvent,
  isStabilityErrorEvent,
  nameOf,
  nativeAvailableOf,
  nativePlatformOf,
  nativeVersionOf,
  numericAttribute,
  osVersionOf,
  packageNameOf,
  problemTypeOf,
  routeOf,
  signalTypeOf,
  statusOf,
  userIdOf,
} from './event-accessors';
import type {
  DimensionAppOption,
  DimensionOption,
  DimensionSummary,
  DurationSummary,
  ErrorPerformanceSummary,
  EventFilters,
  HttpPerformanceSummary,
  JankPerformanceSummary,
  MetricGroupSummary,
  MonitorEvent,
  PagePerformanceSummary,
  PerformanceMetricSummary,
  PerformanceOverview,
  SdkReliabilitySummary,
  SessionSummary,
  StartupPerformanceSummary,
} from './event-types';
import type { MonitorStore, MonitorStoreHealth } from './monitor-store';

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

type DimensionRow = {
  value: string;
  count: number;
};

type AppDimensionRow = {
  app_key: string;
  app_name?: string;
  package_name?: string;
  event_count: number;
  last_timestamp_ms?: number;
};

const INDEX_COLUMNS = [
  'app_key',
  'app_name',
  'package_name',
  'build_number',
  'channel',
  'flavor',
  'device_platform',
  'device_model',
  'device_manufacturer',
  'device_tier',
  'os_version',
  'native_available',
  'native_platform',
  'native_version',
  'problem_type',
] as const;

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
      if (hasEventId(event)) accepted.push(event);
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

  getRecentEvents(limit: number, offset = 0, filters: EventFilters = {}): { events: MonitorEvent[]; hasMore: boolean } {
    const safeLimit = clampLimit(limit, 50);
    const safeOffset = clampOffset(offset);
    const { whereSql, params } = whereFromFilters(filters);
    const events = this.selectEvents(whereSql, params, 'order by timestamp_ms desc, sequence desc limit ? offset ?', [
      safeLimit + 1,
      safeOffset,
    ]);
    return {
      events: events.slice(0, safeLimit),
      hasMore: events.length > safeLimit,
    };
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
    limit: number;
    offset: number;
    hasMore: boolean;
  } {
    const userIdAvailable = this.hasAnyUserId();
    const { whereSql, params } = whereFromFilters(filters);
    const limit = clampLimit(filters.limit, 50);
    const offset = clampOffset(filters.offset);
    const rows = this.selectRows<SessionRow>(
      `
        select session_id
        from events
        ${whereSql}
          ${whereSql ? 'and' : 'where'} session_id is not null
        group by session_id
        order by max(timestamp_ms) desc
        limit ? offset ?
      `,
      [...params, limit + 1, offset],
    );

    const pageRows = rows.slice(0, limit);
    const sessions = pageRows
      .map((row) => buildSessionSummary(row.session_id, this.getSessionEvents(row.session_id)))
      .filter((summary): summary is SessionSummary => Boolean(summary));

    return { sessions, userIdAvailable, limit, offset, hasMore: rows.length > limit };
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
    const limit = clampLimit(filters.limit, 80);
    const startupEvents = events.filter(isStartupEvent);
    const pageEvents = events.filter(isPageEvent);
    const httpEvents = events.filter(isHttpEvent);
    const jankEvents = events.filter(isJankEvent);
    const errorEvents = events.filter(isStabilityErrorEvent);
    const sdkEvents = events.filter(isSdkReliabilityEvent);
    return {
      startup: summarizeStartup(startupEvents, events, limit),
      pages: summarizePages(pageEvents, limit),
      http: summarizeHttp(httpEvents, limit),
      jank: summarizeJank(jankEvents, limit),
      errors: summarizeErrors(errorEvents, limit),
      sdk: summarizeSdkReliability(sdkEvents, limit),
    };
  }

  dimensions(filters: EventFilters): DimensionSummary {
    const dimensionFilters = withoutPaging(filters);
    const appFilters = { ...dimensionFilters, appKey: undefined };
    const { whereSql: appWhereSql, params: appParams } = whereFromFilters(appFilters);
    const apps = this.selectRows<AppDimensionRow>(
      `
        select
          app_key,
          (
            select latest.app_name
            from events latest
            where latest.app_key = events.app_key and latest.app_name is not null
            order by latest.timestamp_ms desc, latest.sequence desc
            limit 1
          ) as app_name,
          (
            select latest.package_name
            from events latest
            where latest.app_key = events.app_key and latest.package_name is not null
            order by latest.timestamp_ms desc, latest.sequence desc
            limit 1
          ) as package_name,
          count(*) as event_count,
          max(timestamp_ms) as last_timestamp_ms
        from events
        ${appWhereSql}
          ${appWhereSql ? 'and' : 'where'} app_key is not null
        group by app_key
        order by last_timestamp_ms desc
        limit 200
      `,
      appParams,
    );

    return {
      apps: apps.map((row): DimensionAppOption => ({
        appKey: row.app_key,
        appName: row.app_name,
        packageName: row.package_name,
        eventCount: row.event_count,
        lastTimestamp: row.last_timestamp_ms ? new Date(row.last_timestamp_ms).toISOString() : undefined,
      })),
      appNames: this.dimensionOptions('app_name', dimensionFilters, 'appName'),
      packageNames: this.dimensionOptions('package_name', dimensionFilters, 'packageName'),
      environments: this.dimensionOptions('environment', dimensionFilters, 'environment'),
      appVersions: this.dimensionOptions('app_version', dimensionFilters, 'appVersion'),
      buildNumbers: this.dimensionOptions('build_number', dimensionFilters, 'buildNumber'),
      channels: this.dimensionOptions('channel', dimensionFilters, 'channel'),
      flavors: this.dimensionOptions('flavor', dimensionFilters, 'flavor'),
      devicePlatforms: this.dimensionOptions('device_platform', dimensionFilters, 'devicePlatform'),
      deviceModels: this.dimensionOptions('device_model', dimensionFilters, 'deviceModel'),
      deviceTiers: this.dimensionOptions('device_tier', dimensionFilters, 'deviceTier'),
      osVersions: this.dimensionOptions('os_version', dimensionFilters, 'osVersion'),
      nativePlatforms: this.dimensionOptions('native_platform', dimensionFilters, 'nativePlatform'),
      routes: this.dimensionOptions('route', dimensionFilters, 'route'),
      statuses: this.dimensionOptions('status', dimensionFilters, 'status'),
      names: this.dimensionOptions('name', dimensionFilters, 'name'),
      signalTypes: this.dimensionOptions('signal_type', dimensionFilters, 'signalType'),
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
    this.assertNoUnsupportedEventsTable();
    this.db.run(`
      create table if not exists events (
        sequence integer primary key autoincrement,
        event_id text not null unique,
        session_id text,
        trace_id text,
        span_id text,
        timestamp_ms integer,
        app_key text,
        app_name text,
        package_name text,
        build_number text,
        channel text,
        flavor text,
        user_id text,
        route text,
        app_version text,
        environment text,
        device_platform text,
        device_model text,
        device_manufacturer text,
        device_tier text,
        os_version text,
        native_available integer,
        native_platform text,
        native_version text,
        problem_type text,
        signal_type text,
        name text,
        status text,
        envelope_json text not null
      );
    `);
    this.ensureIndexColumns();
    this.db.run(`
      create index if not exists idx_events_time on events(timestamp_ms, sequence);
      create index if not exists idx_events_session on events(session_id, timestamp_ms, sequence);
      create index if not exists idx_events_trace on events(trace_id, timestamp_ms, sequence);
      create index if not exists idx_events_user_time on events(user_id, timestamp_ms, sequence);
      create index if not exists idx_events_route_time on events(route, timestamp_ms, sequence);
      create index if not exists idx_events_app_key_time on events(app_key, timestamp_ms, sequence);
      create index if not exists idx_events_app_scope_time on events(app_key, environment, app_version, timestamp_ms, sequence);
      create index if not exists idx_events_app_time on events(app_version, environment, timestamp_ms, sequence);
      create index if not exists idx_events_device_time on events(app_key, device_platform, device_tier, timestamp_ms, sequence);
      create index if not exists idx_events_native_time on events(app_key, native_available, native_platform, timestamp_ms, sequence);
      create index if not exists idx_events_problem_time on events(problem_type, timestamp_ms, sequence);
      create index if not exists idx_events_name_time on events(name, signal_type, status, timestamp_ms, sequence);
    `);
    this.backfillIndexColumns();
    this.flushToDisk();
  }

  private assertNoUnsupportedEventsTable(): void {
    const columns = this.selectRows<{ name: string }>('pragma table_info(events)');
    if (columns.length === 0) return;
    if (columns.some((column) => column.name === 'sequence')) return;
    throw new Error('Unsupported Workbench SQLite schema. Remove platform/.data/events.sqlite and collect fresh events.');
  }

  private persistEvents(events: MonitorEvent[]): void {
    const statement = this.db.prepare(`
      insert into events (
        event_id,
        session_id,
        trace_id,
        span_id,
        timestamp_ms,
        app_key,
        app_name,
        package_name,
        build_number,
        channel,
        flavor,
        user_id,
        route,
        app_version,
        environment,
        device_platform,
        device_model,
        device_manufacturer,
        device_tier,
        os_version,
        native_available,
        native_platform,
        native_version,
        problem_type,
        signal_type,
        name,
        status,
        envelope_json
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      on conflict(event_id) do update set
        session_id = excluded.session_id,
        trace_id = excluded.trace_id,
        span_id = excluded.span_id,
        timestamp_ms = excluded.timestamp_ms,
        app_key = excluded.app_key,
        app_name = excluded.app_name,
        package_name = excluded.package_name,
        build_number = excluded.build_number,
        channel = excluded.channel,
        flavor = excluded.flavor,
        user_id = excluded.user_id,
        route = excluded.route,
        app_version = excluded.app_version,
        environment = excluded.environment,
        device_platform = excluded.device_platform,
        device_model = excluded.device_model,
        device_manufacturer = excluded.device_manufacturer,
        device_tier = excluded.device_tier,
        os_version = excluded.os_version,
        native_available = excluded.native_available,
        native_platform = excluded.native_platform,
        native_version = excluded.native_version,
        problem_type = excluded.problem_type,
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
          appKeyOf(event) ?? null,
          appNameOf(event) ?? null,
          packageNameOf(event) ?? null,
          buildNumberOf(event) ?? null,
          channelOf(event) ?? null,
          flavorOf(event) ?? null,
          userIdOf(event) ?? null,
          routeOf(event) ?? null,
          appVersionOf(event) ?? null,
          environmentOf(event) ?? null,
          devicePlatformOf(event) ?? null,
          deviceModelOf(event) ?? null,
          deviceManufacturerOf(event) ?? null,
          deviceTierOf(event) ?? null,
          osVersionOf(event) ?? null,
          booleanSqlValue(nativeAvailableOf(event)),
          nativePlatformOf(event) ?? null,
          nativeVersionOf(event) ?? null,
          problemTypeOf(event) ?? null,
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

  private ensureIndexColumns(): void {
    const existing = new Set(this.selectRows<{ name: string }>('pragma table_info(events)').map((column) => column.name));
    const definitions: Record<(typeof INDEX_COLUMNS)[number], string> = {
      app_key: 'text',
      app_name: 'text',
      package_name: 'text',
      build_number: 'text',
      channel: 'text',
      flavor: 'text',
      device_platform: 'text',
      device_model: 'text',
      device_manufacturer: 'text',
      device_tier: 'text',
      os_version: 'text',
      native_available: 'integer',
      native_platform: 'text',
      native_version: 'text',
      problem_type: 'text',
    };
    for (const column of INDEX_COLUMNS) {
      if (existing.has(column)) continue;
      this.db.run(`alter table events add column ${column} ${definitions[column]}`);
    }
  }

  private backfillIndexColumns(): void {
    const rows = this.selectRows<(EventRow & { event_id: string })>(
      `
        select event_id, envelope_json
        from events
        where app_key is null
          or device_platform is null
          or native_available is null
          or problem_type is null
          or problem_type = 'error'
        limit 5000
      `,
    );
    if (rows.length === 0) return;
    const statement = this.db.prepare(`
      update events set
        app_key = ?,
        app_name = ?,
        package_name = ?,
        build_number = ?,
        channel = ?,
        flavor = ?,
        device_platform = ?,
        device_model = ?,
        device_manufacturer = ?,
        device_tier = ?,
        os_version = ?,
        native_available = ?,
        native_platform = ?,
        native_version = ?,
        problem_type = ?
      where event_id = ?
    `);
    try {
      this.db.run('begin');
      for (const row of rows) {
        const event = JSON.parse(row.envelope_json) as MonitorEvent;
        statement.run([
          appKeyOf(event) ?? null,
          appNameOf(event) ?? null,
          packageNameOf(event) ?? null,
          buildNumberOf(event) ?? null,
          channelOf(event) ?? null,
          flavorOf(event) ?? null,
          devicePlatformOf(event) ?? null,
          deviceModelOf(event) ?? null,
          deviceManufacturerOf(event) ?? null,
          deviceTierOf(event) ?? null,
          osVersionOf(event) ?? null,
          booleanSqlValue(nativeAvailableOf(event)),
          nativePlatformOf(event) ?? null,
          nativeVersionOf(event) ?? null,
          problemTypeOf(event) ?? null,
          row.event_id,
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

  private dimensionOptions(
    columnName: string,
    filters: EventFilters,
    ownFilterKey: keyof EventFilters,
  ): DimensionOption[] {
    const { whereSql, params } = whereFromFilters({ ...filters, [ownFilterKey]: undefined });
    return this.selectRows<DimensionRow>(
      `
        select ${columnName} as value, count(*) as count
        from events
        ${whereSql}
          ${whereSql ? 'and' : 'where'} ${columnName} is not null
        group by ${columnName}
        order by count desc, value asc
        limit 200
      `,
      params,
    ).map((row) => ({ value: row.value, count: row.count }));
  }
}

function whereFromFilters(filters: EventFilters): { whereSql: string; params: SqlParam[] } {
  const clauses: string[] = [];
  const params: SqlParam[] = [];
  addLikeFilter(clauses, params, 'session_id', filters.sessionId);
  addEqualityFilter(clauses, params, 'app_key', filters.appKey);
  addEqualityFilter(clauses, params, 'app_name', filters.appName);
  addEqualityFilter(clauses, params, 'package_name', filters.packageName);
  addEqualityFilter(clauses, params, 'build_number', filters.buildNumber);
  addEqualityFilter(clauses, params, 'channel', filters.channel);
  addEqualityFilter(clauses, params, 'flavor', filters.flavor);
  addEqualityFilter(clauses, params, 'user_id', filters.userId);
  addEqualityFilter(clauses, params, 'app_version', filters.appVersion);
  addEqualityFilter(clauses, params, 'environment', filters.environment);
  addEqualityFilter(clauses, params, 'device_platform', filters.devicePlatform);
  addEqualityFilter(clauses, params, 'device_model', filters.deviceModel);
  addEqualityFilter(clauses, params, 'device_tier', filters.deviceTier);
  addEqualityFilter(clauses, params, 'os_version', filters.osVersion);
  addBooleanFilter(clauses, params, 'native_available', filters.nativeAvailable);
  addEqualityFilter(clauses, params, 'native_platform', filters.nativePlatform);
  addEqualityFilter(clauses, params, 'route', filters.route);
  addEqualityFilter(clauses, params, 'status', filters.status);
  addEqualityFilter(clauses, params, 'name', filters.name);
  addEqualityFilter(clauses, params, 'signal_type', filters.signalType);
  addEqualityFilter(clauses, params, 'problem_type', filters.problemType);

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
  value: string | string[] | undefined,
): void {
  if (Array.isArray(value)) {
    const values = value.filter((item) => item.length > 0);
    if (values.length === 0) return;
    clauses.push(`${columnName} in (${values.map(() => '?').join(', ')})`);
    params.push(...values);
    return;
  }
  if (!value) return;
  clauses.push(`${columnName} = ?`);
  params.push(value);
}

function addLikeFilter(
  clauses: string[],
  params: SqlParam[],
  columnName: string,
  value: string | undefined,
): void {
  const normalized = value?.trim();
  if (!normalized) return;
  clauses.push(`${columnName} like ? escape '\\'`);
  params.push(`%${escapeLike(normalized)}%`);
}

function addBooleanFilter(
  clauses: string[],
  params: SqlParam[],
  columnName: string,
  value: boolean | undefined,
): void {
  if (value === undefined) return;
  clauses.push(`${columnName} = ?`);
  params.push(booleanSqlValue(value));
}

function booleanSqlValue(value: boolean | undefined): number | null {
  if (value === undefined) return null;
  return value ? 1 : 0;
}

function withoutPaging(filters: EventFilters): EventFilters {
  const { limit: _limit, offset: _offset, ...rest } = filters;
  return rest;
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
  return statusOf(event) !== 'unknown' && (
    name === 'app.cold_start' ||
    name === 'app.hot_start' ||
    name === 'app.background_duration' ||
    name === 'sdk.init' ||
    name.includes('startup')
  );
}

function isPageEvent(event: MonitorEvent): boolean {
  const name = nameOf(event) ?? '';
  const phase = stringAttribute(event, 'event.phase');
  return statusOf(event) !== 'unknown' && (
    name === 'page.load' ||
    name === 'page.stay' ||
    (name === 'page.visit' && phase === 'end')
  );
}

function isHttpEvent(event: MonitorEvent): boolean {
  return isCompletedHttpEvent(event);
}

function isSdkReliabilityEvent(event: MonitorEvent): boolean {
  if (signalTypeOf(event) !== 'sdk') return false;
  const name = nameOf(event);
  return name === 'sdk.health.report' ||
    name === 'sdk.lifecycle.flush' ||
    name === 'sdk.output.flush' ||
    name === 'sdk.output.dispatch_failed' ||
    name === 'sdk.output.flush_failed' ||
    name === 'sdk.output.dispose_failed' ||
    name === 'sdk.queue.drop' ||
    name === 'sdk.queue.state' ||
    name === 'sdk.retry.schedule' ||
    name === 'sdk.config.applied';
}

function summarizeStartup(
  startupEvents: MonitorEvent[],
  allEvents: MonitorEvent[],
  limit: number,
): StartupPerformanceSummary {
  const base = summarizeMetric(startupEvents, limit);
  const coldStarts = startupEvents.filter((event) => nameOf(event) === 'app.cold_start');
  const sdkInit = startupEvents.filter((event) => nameOf(event) === 'sdk.init');
  const backgroundDurationEvents = allEvents.filter((event) => nameOf(event) === 'app.background_duration');
  const hotResumeEvents = startupEvents.filter((event) => (
    nameOf(event) === 'app.hot_start' &&
    stringAttribute(event, 'app.start.type') === 'hot' &&
    (durationOf(event) ?? 0) > 0
  ));
  const hotResume = summarizeDuration(
    hotResumeEvents,
    'app.hot_start.durationMs',
    durationOf,
  );

  return {
    ...base,
    coldStart: summarizeDuration(coldStarts, 'durationMs', durationOf),
    sdkInit: summarizeDuration(
      sdkInit,
      'attributes["sdk.init.duration_ms"]',
      (event) => numericAttribute(event, 'sdk.init.duration_ms') ?? durationOf(event),
    ),
    backgroundInterval: summarizeDuration(
      backgroundDurationEvents,
      'app.background_duration.durationMs',
      durationOf,
    ),
    hotResume: {
      ...hotResume,
      available: hotResume.sampleCount > 0,
      missingReason: hotResume.sampleCount > 0
        ? undefined
        : 'hot_resume_duration_unavailable',
    },
  };
}

function summarizePages(events: MonitorEvent[], limit: number): PagePerformanceSummary {
  const base = summarizeMetric(events, limit);
  const pageLoads = events.filter((event) => nameOf(event) === 'page.load');
  const pageStay = events.filter((event) => nameOf(event) === 'page.stay');

  return {
    ...base,
    load: summarizeDuration(
      pageLoads,
      'attributes["page.load_ms"]',
      (event) => numericAttribute(event, 'page.load_ms') ?? durationOf(event),
    ),
    firstFrame: summarizeDuration(
      pageLoads,
      'attributes["page.first_frame_ms"]',
      (event) => numericAttribute(event, 'page.first_frame_ms') ?? durationOf(event),
    ),
    stay: summarizeDuration(pageStay, 'page.stay.durationMs', durationOf),
    routeSummaries: groupMetric(
      pageLoads,
      (event) => routeOf(event) ?? '未知页面',
      (event) => numericAttribute(event, 'page.load_ms') ?? durationOf(event),
      '未知页面',
    ),
  };
}

function summarizeHttp(events: MonitorEvent[], limit: number): HttpPerformanceSummary {
  const base = summarizeMetric(events, limit);
  const failed = events.filter(isFailedHttpEvent);

  return {
    ...base,
    failedCount: failed.length,
    slowCount: events.filter((event) => (durationOf(event) ?? 0) >= 1000).length,
    affectedSessionCount: distinctCount(events.map((event) => event.sessionId)),
    routeSummaries: groupMetric(
      events,
      (event) => routeOf(event) ?? '未知页面',
      durationOf,
      '未知页面',
    ),
    endpointSummaries: groupMetric(
      events,
      (event) => stringAttribute(event, 'http.url.normalized') ?? '未知接口',
      durationOf,
      '未知接口',
    ),
    statusSummaries: groupMetric(
      events,
      (event) => {
        const statusCode = numericAttribute(event, 'http.status_code');
        if (typeof statusCode === 'number') return String(statusCode);
        if (isFailedHttpEvent(event)) return stringAttribute(event, 'http.error_type') ?? '失败无状态码';
        return '无状态码';
      },
      durationOf,
      '无状态码',
    ),
  };
}

function summarizeJank(events: MonitorEvent[], limit: number): JankPerformanceSummary {
  const base = summarizeMetric(events, limit);

  return {
    ...base,
    affectedSessionCount: distinctCount(events.map((event) => event.sessionId)),
    totalJankFrames: sumValues(events.map((event) => numericAttribute(event, 'jank.count'))),
    maxFrame: summarizeDuration(
      events,
      'attributes["frame.max_ms"]',
      (event) => numericAttribute(event, 'frame.max_ms'),
    ),
    avgFrame: summarizeDuration(
      events,
      'attributes["frame.avg_ms"]',
      (event) => numericAttribute(event, 'frame.avg_ms'),
    ),
    jankFrames: summarizeDuration(
      events,
      'attributes["jank.count"]',
      (event) => numericAttribute(event, 'jank.count'),
    ),
    routeSummaries: groupMetric(
      events,
      (event) => routeOf(event) ?? '未知页面',
      (event) => numericAttribute(event, 'frame.max_ms'),
      '未知页面',
    ),
  };
}

function summarizeErrors(events: MonitorEvent[], limit: number): ErrorPerformanceSummary {
  const base = summarizeMetric(events, limit);

  return {
    ...base,
    affectedSessionCount: distinctCount(events.map((event) => event.sessionId)),
    typeSummaries: groupMetric(
      events,
      (event) => stringAttribute(event, 'error.type') ?? nameOf(event) ?? '未知类型',
      undefined,
      '未知类型',
    ),
    mechanismSummaries: groupMetric(
      events,
      (event) => stringAttribute(event, 'error.mechanism') ?? nameOf(event) ?? '未知机制',
      undefined,
      '未知机制',
    ),
    routeSummaries: groupMetric(
      events,
      (event) => routeOf(event) ?? '未知页面',
      undefined,
      '未知页面',
    ),
    recent: base.events,
  };
}

function summarizeSdkReliability(events: MonitorEvent[], limit: number): SdkReliabilitySummary {
  const base = summarizeMetric(events, limit);
  // sdk.health.report 是 SDK 可靠性的主要事实来源（窗口计数器 + drops.by_reason 聚合）。
  // 逐条 sdk.queue.drop / 成功 sdk.output.flush 是历史兼容事件，仍按旧口径合并。
  const healthReports = events.filter((event) => nameOf(event) === 'sdk.health.report');
  const flushEvents = events.filter((event) => (
    nameOf(event) === 'sdk.lifecycle.flush' ||
    nameOf(event) === 'sdk.output.flush' ||
    nameOf(event) === 'sdk.output.flush_failed'
  ));
  const retryEvents = events.filter((event) => nameOf(event) === 'sdk.retry.schedule');
  const dropEvents = events.filter((event) => nameOf(event) === 'sdk.queue.drop');
  const queueStateEvents = events.filter((event) => nameOf(event) === 'sdk.queue.state');
  const configAppliedEvents = events.filter((event) => nameOf(event) === 'sdk.config.applied');
  const latestQueueState = [...events]
    .sort((a, b) => eventTimeValue(b) - eventTimeValue(a))
    .find((event) => (
      numericAttribute(event, 'sdk.queue.length') !== undefined ||
      numericAttribute(event, 'sdk.queue.bytes') !== undefined
    ));

  const healthFlushSuccess = sumValues(healthReports.map((event) => numericAttribute(event, 'sdk.health.flush_success_count')));
  const healthFlushFailure = sumValues(healthReports.map((event) => numericAttribute(event, 'sdk.health.flush_failure_count')));
  const healthRetry = sumValues(healthReports.map((event) => numericAttribute(event, 'sdk.health.retry_count')));
  const healthDropped = sumValues(healthReports.map((event) => numericAttribute(event, 'sdk.health.dropped_count')));
  const healthReportsWithDrops = healthReports.filter((event) => (
    (numericAttribute(event, 'sdk.health.dropped_count') ?? 0) > 0
  ));

  return {
    ...base,
    flushCount: flushEvents.length + healthFlushSuccess + healthFlushFailure,
    flushFailureCount: flushEvents.filter((event) => statusOf(event) !== 'ok').length + healthFlushFailure,
    // sdk.retry.schedule 只是边沿事件且已计入 health retry_count，优先以摘要计数为准。
    retryCount: healthRetry > 0 ? healthRetry : retryEvents.length,
    dropCount: dropEvents.length + healthReportsWithDrops.length,
    droppedEventCount: sumValues(dropEvents.map((event) => numericAttribute(event, 'sdk.drop.count'))) + healthDropped,
    queueStateCount: queueStateEvents.length,
    configAppliedCount: configAppliedEvents.length,
    latestQueueLength: latestQueueState ? numericAttribute(latestQueueState, 'sdk.queue.length') : undefined,
    latestQueueBytes: latestQueueState ? numericAttribute(latestQueueState, 'sdk.queue.bytes') : undefined,
    dropReasonSummaries: mergeGroupSummaries(
      groupMetric(
        dropEvents,
        (event) => stringAttribute(event, 'sdk.drop.reason') ?? '未知原因',
        (event) => numericAttribute(event, 'sdk.drop.count'),
        '未知原因',
      ),
      healthReportDropReasonSummaries(healthReports),
    ),
    retryReasonSummaries: groupMetric(
      retryEvents,
      (event) => stringAttribute(event, 'sdk.retry.reason') ?? '未知原因',
      (event) => numericAttribute(event, 'sdk.retry.delay_ms'),
      '未知原因',
    ),
    flushReasonSummaries: groupMetric(
      flushEvents,
      (event) => stringAttribute(event, 'sdk.flush.reason') ?? '未知原因',
      (event) => numericAttribute(event, 'sdk.flush.duration_ms') ?? durationOf(event),
      '未知原因',
    ),
    outputModeSummaries: groupMetric(
      events,
      (event) => stringAttribute(event, 'sdk.output.mode') ?? '未知模式',
      undefined,
      '未知模式',
    ),
  };
}

/** 从 sdk.health.report 的 payload["drops.by_reason"] 还原各 drop reason 的丢弃事件数。 */
function healthReportDropReasonSummaries(reports: MonitorEvent[]): MetricGroupSummary[] {
  const groups = new Map<string, { count: number; latest?: MonitorEvent }>();
  for (const report of [...reports].sort((a, b) => eventTimeValue(a) - eventTimeValue(b))) {
    const drops = report.payload?.['drops.by_reason'];
    if (!drops || typeof drops !== 'object') continue;
    for (const [reason, bucket] of Object.entries(drops as Record<string, unknown>)) {
      const bucketCount = bucket && typeof bucket === 'object'
        ? (bucket as Record<string, unknown>).count
        : undefined;
      const count = typeof bucketCount === 'number' && Number.isFinite(bucketCount) ? bucketCount : 0;
      if (count <= 0) continue;
      const group = groups.get(reason) ?? { count: 0 };
      group.count += count;
      group.latest = report;
      groups.set(reason, group);
    }
  }
  return [...groups.entries()]
    .map(([key, group]) => ({
      key,
      count: group.count,
      eventId: group.latest?.eventId,
      sessionId: group.latest?.sessionId,
      traceId: group.latest?.traceId,
      route: group.latest ? routeOf(group.latest) : undefined,
    }))
    .sort((a, b) => b.count - a.count);
}

/** 按 key 合并两组 MetricGroupSummary，count 求和，其余字段保留先出现的一组。 */
function mergeGroupSummaries(
  primary: MetricGroupSummary[],
  secondary: MetricGroupSummary[],
): MetricGroupSummary[] {
  const merged = new Map<string, MetricGroupSummary>();
  for (const group of [...primary, ...secondary]) {
    const existing = merged.get(group.key);
    if (!existing) {
      merged.set(group.key, { ...group });
      continue;
    }
    existing.count += group.count;
  }
  return [...merged.values()].sort((a, b) => b.count - a.count);
}

function summarizeMetric(events: MonitorEvent[], limit: number): PerformanceMetricSummary {
  const sourceFields = durationSourceFields(events);
  const durationEvents = events
    .map((event) => ({ event, durationMs: durationOf(event) }))
    .filter((entry): entry is { event: MonitorEvent; durationMs: number } => (
      typeof entry.durationMs === 'number' && Number.isFinite(entry.durationMs)
    ));
  const latestDuration = [...durationEvents].sort((a, b) => eventTimeValue(b.event) - eventTimeValue(a.event))[0];
  const maxDuration = [...durationEvents].sort((a, b) => b.durationMs - a.durationMs)[0];
  const recent = [...events]
    .sort((a, b) => eventTimeValue(b) - eventTimeValue(a))
    .slice(0, limit)
    .map((event) => ({
      eventId: event.eventId,
      sessionId: event.sessionId,
      traceId: event.traceId,
      signalType: signalTypeOf(event),
      name: nameOf(event),
      route: routeOf(event),
      durationMs: durationOf(event),
      level: typeof event.level === 'string' ? event.level : undefined,
      status: statusOf(event),
      timestamp: event.timestamp,
      attributes: event.attributes,
      resource: event.resource,
      context: event.context,
    }));

  return {
    count: events.length,
    errorCount: events.filter(isErrorEvent).length,
    durationSummary: durationEvents.length > 0
      ? {
          sourceFields,
          sampleCount: durationEvents.length,
          averageMs: average(durationEvents.map((entry) => entry.durationMs)),
          maxMs: maxDuration?.durationMs,
          latestMs: latestDuration?.durationMs,
          maxEventId: maxDuration?.event.eventId,
          latestEventId: latestDuration?.event.eventId,
        }
      : undefined,
    events: recent,
  };
}

function summarizeDuration(
  events: MonitorEvent[],
  sourceField: string,
  readValue: (event: MonitorEvent) => number | undefined,
): DurationSummary {
  const durationEvents = events
    .map((event) => ({ event, value: readValue(event) }))
    .filter((entry): entry is { event: MonitorEvent; value: number } => (
      typeof entry.value === 'number' && Number.isFinite(entry.value)
    ));
  const latest = [...durationEvents].sort((a, b) => eventTimeValue(b.event) - eventTimeValue(a.event))[0];
  const max = [...durationEvents].sort((a, b) => b.value - a.value)[0];

  return {
    sourceFields: [sourceField],
    sampleCount: durationEvents.length,
    averageMs: average(durationEvents.map((entry) => entry.value)),
    maxMs: max?.value,
    latestMs: latest?.value,
    maxEventId: max?.event.eventId,
    latestEventId: latest?.event.eventId,
  };
}

function groupMetric(
  events: MonitorEvent[],
  keyOf: (event: MonitorEvent) => string | undefined,
  valueOf?: (event: MonitorEvent) => number | undefined,
  fallback = '未知',
): MetricGroupSummary[] {
  const groups = new Map<string, MonitorEvent[]>();
  for (const event of events) {
    const key = keyOf(event) ?? fallback;
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .map(([key, groupEvents]) => {
      const values = valueOf
        ? groupEvents.map(valueOf).filter((value): value is number => (
            typeof value === 'number' && Number.isFinite(value)
          ))
        : [];
      const latest = [...groupEvents].sort((a, b) => eventTimeValue(b) - eventTimeValue(a))[0];
      const maxEvent = valueOf
        ? [...groupEvents]
            .map((event) => ({ event, value: valueOf(event) }))
            .filter((entry): entry is { event: MonitorEvent; value: number } => (
              typeof entry.value === 'number' && Number.isFinite(entry.value)
            ))
            .sort((a, b) => b.value - a.value)[0]?.event
        : latest;

      return {
        key,
        count: groupEvents.length,
        sampleCount: values.length,
        averageMs: average(values),
        maxMs: values.length > 0 ? Math.max(...values) : undefined,
        latestMs: valueOf ? valueOf(latest) : undefined,
        eventId: maxEvent?.eventId ?? latest?.eventId,
        sessionId: maxEvent?.sessionId ?? latest?.sessionId,
        traceId: maxEvent?.traceId ?? latest?.traceId,
        route: routeOf(maxEvent ?? latest),
      };
    })
    .sort((a, b) => (
      (b.count - a.count) ||
      ((b.maxMs ?? 0) - (a.maxMs ?? 0)) ||
      a.key.localeCompare(b.key)
    ))
    .slice(0, 12);
}

function durationOf(event: MonitorEvent): number | undefined {
  if (typeof event.durationMs === 'number') return event.durationMs;
  return undefined;
}

function stringAttribute(event: MonitorEvent, key: string): string | undefined {
  const value = event.attributes?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function durationSourceFields(events: MonitorEvent[]): string[] {
  const fields = new Set<string>();
  if ([...events].some((event) => typeof event.durationMs === 'number')) {
    fields.add('durationMs');
  }
  return [...fields];
}

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sumValues(values: Array<number | undefined>): number {
  return values.reduce<number>((sum, value) => sum + (typeof value === 'number' ? value : 0), 0);
}

function distinctCount(values: Array<string | undefined>): number {
  return new Set(values.filter((value): value is string => Boolean(value))).size;
}

function buildSessionSummary(sessionId: string, events: MonitorEvent[]): SessionSummary | undefined {
  if (events.length === 0) return undefined;
  const first = events[0];
  const last = events[events.length - 1];
  const firstWithUser = events.find((event) => Boolean(userIdOf(event)));
  const firstWithApp = events.find((event) => Boolean(
    appKeyOf(event) ||
    appNameOf(event) ||
    appVersionOf(event) ||
    environmentOf(event),
  ));
  const firstWithDevice = events.find((event) => Boolean(
    devicePlatformOf(event) ||
    deviceModelOf(event) ||
    deviceTierOf(event) ||
    osVersionOf(event),
  ));
  const lastWithRoute = [...events].reverse().find((event) => Boolean(routeOf(event)));
  const firstNativeAvailable = events.find((event) => nativeAvailableOf(event) === true);
  const firstNativeVersion = events.find((event) => Boolean(nativeVersionOf(event)));
  const firstNativePlatform = events.find((event) => Boolean(nativePlatformOf(event)));
  const status = events.some(isStabilityErrorEvent)
    ? 'error'
    : events.some(isBusinessFailureEvent)
      ? 'warning'
    : [...events].reverse().map(statusOf).find(Boolean);

  return {
    sessionId,
    count: events.length,
    firstTimestamp: first?.timestamp,
    lastTimestamp: last?.timestamp,
    firstEventId: first?.eventId,
    lastEventId: last?.eventId,
    appKey: firstWithApp ? appKeyOf(firstWithApp) : undefined,
    appName: firstWithApp ? appNameOf(firstWithApp) : undefined,
    packageName: firstWithApp ? packageNameOf(firstWithApp) : undefined,
    buildNumber: firstWithApp ? buildNumberOf(firstWithApp) : undefined,
    channel: firstWithApp ? channelOf(firstWithApp) : undefined,
    flavor: firstWithApp ? flavorOf(firstWithApp) : undefined,
    userId: firstWithUser ? userIdOf(firstWithUser) : undefined,
    appVersion: firstWithApp ? appVersionOf(firstWithApp) : undefined,
    environment: firstWithApp ? environmentOf(firstWithApp) : undefined,
    devicePlatform: firstWithDevice ? devicePlatformOf(firstWithDevice) : undefined,
    deviceModel: firstWithDevice ? deviceModelOf(firstWithDevice) : undefined,
    deviceManufacturer: firstWithDevice ? deviceManufacturerOf(firstWithDevice) : undefined,
    deviceTier: firstWithDevice ? deviceTierOf(firstWithDevice) : undefined,
    osVersion: firstWithDevice ? osVersionOf(firstWithDevice) : undefined,
    route: lastWithRoute ? routeOf(lastWithRoute) : undefined,
    status,
    nativeAvailable: firstNativeAvailable ? true : undefined,
    nativeVersion: firstNativeVersion ? nativeVersionOf(firstNativeVersion) : undefined,
    nativePlatform: firstNativePlatform ? nativePlatformOf(firstNativePlatform) : undefined,
    errorCount: events.filter(isStabilityErrorEvent).length,
    jankCount: events.filter(isJankEvent).length,
    failedHttpCount: events.filter(isFailedHttpEvent).length,
    businessFailureCount: events.filter(isBusinessFailureEvent).length,
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

function clampOffset(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(parsed, 0);
}

function escapeLike(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_');
}
