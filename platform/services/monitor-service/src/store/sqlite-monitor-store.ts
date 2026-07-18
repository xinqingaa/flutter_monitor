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
  domainCatalogFieldsOf,
  environmentOf,
  eventTimeValue,
  flavorOf,
  isCompletedHttpEvent,
  isErrorEvent,
  isBusinessFailureEvent,
  isFailedHttpEvent,
  isJankEvent,
  httpCatalogFieldsOf,
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
  AnalyticsAttentionItem,
  AnalyticsGroupItem,
  AnalyticsMatrixCell,
  AnalyticsPoint,
  AnalyticsRange,
  BusinessAnalytics,
  DimensionAppOption,
  DimensionOption,
  DimensionSummary,
  BusinessCatalogItem,
  BusinessCatalogQuery,
  BusinessCatalogResult,
  BusinessActionSummary,
  DurationSummary,
  ErrorPerformanceSummary,
  FailureTimeseries,
  EventFilters,
  ErrorCatalogItem,
  ErrorCatalogQuery,
  ErrorCatalogResult,
  ErrorAnalytics,
  HttpPerformanceSummary,
  HttpCatalogItem,
  HttpCatalogQuery,
  HttpCatalogResult,
  HttpAnalytics,
  JankPerformanceSummary,
  MetricGroupSummary,
  MonitorEvent,
  PagePerformanceSummary,
  PerformanceMetricSummary,
  PerformanceOverview,
  OverviewAnalytics,
  SdkReliabilitySummary,
  SessionSummary,
  SessionAnalytics,
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

type AnalyticsRangeRow = { min_ms?: number; max_ms?: number };
type AnalyticsPointRow = {
  bucket_start: number;
  active_sessions: number;
  http_total: number;
  http_failed: number;
  business_total: number;
  business_failed: number;
  business_cancelled: number;
  errors: number;
};
type AnalyticsGroupRow = {
  key: string;
  count: number;
  failed?: number;
  average_ms?: number;
  max_ms?: number;
  event_id?: string;
  session_id?: string;
  trace_id?: string;
  route?: string;
};
type AnalyticsMatrixRow = {
  row_key: string;
  column_key: string;
  count: number;
  failed?: number;
  event_id?: string;
  session_id?: string;
  trace_id?: string;
};
type AnalyticsAttentionRow = {
  event_id: string;
  session_id?: string;
  trace_id?: string;
  timestamp_ms?: number;
  route?: string;
  http_method?: string;
  http_url?: string;
  http_status_code?: number;
  business_action?: string;
  business_result?: string;
  error_type?: string;
  error_message?: string;
  catalog_problem_kind?: string;
  count?: number;
  affected_sessions?: number;
};
type ResolvedAnalyticsRange = AnalyticsRange & { fromMs?: number; toMs?: number; bucketMs: number };

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
  'http_method',
  'http_url',
  'http_host',
  'http_status_code',
  'http_request_id',
  'http_success',
  'http_duration_ms',
  'http_business_code',
  'http_business_code_state',
  'http_completed',
  'business_action',
  'business_result',
  'error_type',
  'error_mechanism',
  'error_fatal',
  'error_handled',
  'error_message',
  'catalog_problem_kind',
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

  listHttpCatalog(query: HttpCatalogQuery): HttpCatalogResult {
    const limit = clampLimit(query.limit, 50);
    const offset = clampOffset(query.offset);
    const slowThresholdMs = query.slowThresholdMs ?? 1000;
    const { whereSql, params } = whereFromHttpCatalogQuery(query, slowThresholdMs);
    const total = this.selectRows<CountRow>(`select count(*) as count from events ${whereSql}`, params)[0]?.count ?? 0;
    const orderSql = catalogOrderSql(query.sortBy, query.sortDir, {
      timestamp: 'timestamp_ms',
      durationMs: 'http_duration_ms',
    }, 'timestamp_ms');
    const rows = this.selectRows<EventRow>(
      `select envelope_json from events ${whereSql} ${orderSql} limit ? offset ?`,
      [...params, limit, offset],
    );
    return {
      items: rows.map((row) => httpCatalogItemFromEvent(JSON.parse(row.envelope_json) as MonitorEvent)),
      total,
      limit,
      offset,
      slowThresholdMs,
    };
  }

  listBusinessCatalog(query: BusinessCatalogQuery): BusinessCatalogResult {
    const limit = clampLimit(query.limit, 50);
    const offset = clampOffset(query.offset);
    const { whereSql, params } = whereFromBusinessCatalogQuery(query);
    const total = this.selectRows<CountRow>(`select count(*) as count from events ${whereSql}`, params)[0]?.count ?? 0;
    const orderSql = catalogOrderSql(query.sortBy, query.sortDir, { timestamp: 'timestamp_ms' }, 'timestamp_ms');
    const rows = this.selectRows<EventRow>(`select envelope_json from events ${whereSql} ${orderSql} limit ? offset ?`, [...params, limit, offset]);
    return { items: rows.map((row) => businessCatalogItemFromEvent(JSON.parse(row.envelope_json) as MonitorEvent)), total, limit, offset };
  }

  listErrorCatalog(query: ErrorCatalogQuery): ErrorCatalogResult {
    const limit = clampLimit(query.limit, 50);
    const offset = clampOffset(query.offset);
    const { whereSql, params } = whereFromErrorCatalogQuery(query);
    const total = this.selectRows<CountRow>(`select count(*) as count from events ${whereSql}`, params)[0]?.count ?? 0;
    const orderSql = catalogOrderSql(query.sortBy, query.sortDir, { timestamp: 'timestamp_ms' }, 'timestamp_ms');
    const rows = this.selectRows<EventRow>(`select envelope_json from events ${whereSql} ${orderSql} limit ? offset ?`, [...params, limit, offset]);
    return { items: rows.map((row) => errorCatalogItemFromEvent(JSON.parse(row.envelope_json) as MonitorEvent)), total, limit, offset };
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

  failureTimeseries(filters: EventFilters, bucket: 'hour' | 'day'): FailureTimeseries {
    const fromMs = Date.parse(filters.from ?? '') || Date.now() - 24 * 60 * 60 * 1000;
    const toMs = Date.parse(filters.to ?? '') || Date.now();
    const bucketMs = bucket === 'day' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    const firstBucket = Math.floor(fromMs / bucketMs) * bucketMs;
    const emptyPoint = () => ({ httpTotal: 0, failedHttp: 0, errors: 0, businessFailures: 0, businessSuccess: 0, businessCancelled: 0, coldStartCount: 0, coldStartTotalMs: 0, coldStartSlowCount: 0, startupEventId: undefined as string | undefined, startupSessionId: undefined as string | undefined, startupMaxMs: -1 });
    const points = new Map<number, ReturnType<typeof emptyPoint>>();
    for (let cursor = firstBucket; cursor < toMs; cursor += bucketMs) {
      points.set(cursor, emptyPoint());
    }
    for (const event of this.selectFilteredEvents(filters)) {
      const time = eventTimeValue(event);
      if (!Number.isFinite(time) || time < fromMs || time > toMs) continue;
      const start = Math.floor(time / bucketMs) * bucketMs;
      const point = points.get(start);
      if (!point) continue;
      if (isHttpEvent(event)) point.httpTotal += 1;
      if (isFailedHttpEvent(event)) point.failedHttp += 1;
      if (isStabilityErrorEvent(event)) point.errors += 1;
      const domain = domainCatalogFieldsOf(event);
      if (domain.businessResult === 'failed') point.businessFailures += 1;
      if (domain.businessResult === 'success') point.businessSuccess += 1;
      if (domain.businessResult === 'cancelled') point.businessCancelled += 1;
      if (nameOf(event) === 'app.cold_start' && typeof event.durationMs === 'number') {
        point.coldStartCount += 1;
        point.coldStartTotalMs += event.durationMs;
        if (event.durationMs >= 1000) point.coldStartSlowCount += 1;
        if (event.durationMs > point.startupMaxMs) {
          point.startupMaxMs = event.durationMs;
          point.startupEventId = event.eventId;
          point.startupSessionId = event.sessionId;
        }
      }
    }
    return {
      from: new Date(fromMs).toISOString(),
      to: new Date(toMs).toISOString(),
      bucket,
      points: [...points.entries()].map(([start, { startupMaxMs: _startupMaxMs, ...value }]) => ({
        from: new Date(Math.max(start, fromMs)).toISOString(),
        to: new Date(Math.min(start + bucketMs, toMs)).toISOString(),
        ...value,
      })),
    };
  }

  businessActionSummary(filters: EventFilters, limit: number): BusinessActionSummary {
    const summaries = new Map<string, { total: number; failed: number; eventId?: string; sessionId?: string; time: number }>();
    for (const event of this.selectFilteredEvents({ ...filters, limit: undefined, offset: undefined })) {
      const domain = domainCatalogFieldsOf(event);
      if (!domain.businessAction) continue;
      const current = summaries.get(domain.businessAction) ?? { total: 0, failed: 0, time: -1 };
      current.total += 1;
      if (domain.businessResult === 'failed') current.failed += 1;
      const time = eventTimeValue(event);
      if (time > current.time) {
        current.time = time;
        current.eventId = event.eventId;
        current.sessionId = event.sessionId;
      }
      summaries.set(domain.businessAction, current);
    }
    return {
      items: [...summaries.entries()]
        .map(([action, value]) => ({ action, total: value.total, failed: value.failed, eventId: value.eventId, sessionId: value.sessionId }))
        .sort((a, b) => b.total - a.total || b.failed - a.failed || a.action.localeCompare(b.action))
        .slice(0, Math.min(Math.max(limit, 1), 50)),
    };
  }

  analyticsOverview(filters: EventFilters): OverviewAnalytics {
    const scoped = withoutPaging(filters);
    const { whereSql, params } = whereFromFilters(scoped);
    const range = this.resolveAnalyticsRange(scoped, whereSql, params);
    const performance = this.performanceOverview({ ...scoped, limit: 80 });
    const sessions = this.analyticsSessions(scoped);
    const http = this.analyticsHttp(scoped);
    const business = this.analyticsBusiness(scoped);
    const errorsSummary = this.analyticsErrors(scoped);
    const kpi = this.selectRows<{
      active_sessions: number;
      problem_sessions: number;
      http_total: number;
      http_failed: number;
      http_slow: number;
      business_total: number;
      business_failed: number;
      business_cancelled: number;
      errors: number;
      affected_sessions: number;
    }>(`
      select
        count(distinct session_id) as active_sessions,
        count(distinct case when ((http_completed = 1 and (http_success = 0 or status = 'error')) or catalog_problem_kind in ('error', 'business_failure')) then session_id end) as problem_sessions,
        sum(case when http_completed = 1 then 1 else 0 end) as http_total,
        sum(case when http_completed = 1 and (http_success = 0 or status = 'error') then 1 else 0 end) as http_failed,
        sum(case when http_completed = 1 and http_duration_ms >= 1000 then 1 else 0 end) as http_slow,
        sum(case when business_action is not null then 1 else 0 end) as business_total,
        sum(case when business_action is not null and business_result = 'failed' then 1 else 0 end) as business_failed,
        sum(case when business_action is not null and business_result = 'cancelled' then 1 else 0 end) as business_cancelled,
        sum(case when catalog_problem_kind in ('error', 'business_failure') then 1 else 0 end) as errors,
        count(distinct case when catalog_problem_kind in ('error', 'business_failure') then session_id end) as affected_sessions
      from events ${whereSql}
    `, params)[0];
    return {
      resolvedRange: publicAnalyticsRange(range),
      kpis: {
        activeSessions: numeric(kpi?.active_sessions),
        problemSessions: numeric(kpi?.problem_sessions),
        httpTotal: numeric(kpi?.http_total),
        httpFailed: numeric(kpi?.http_failed),
        httpSlow: numeric(kpi?.http_slow),
        businessTotal: numeric(kpi?.business_total),
        businessFailed: numeric(kpi?.business_failed),
        businessCancelled: numeric(kpi?.business_cancelled),
        errors: numeric(kpi?.errors),
        affectedSessions: numeric(kpi?.affected_sessions),
      },
      points: this.analyticsPoints(whereSql, params, range),
      sessionHealth: this.sessionHealthGroups(whereSql, params),
      httpStatuses: this.analyticsGroups(whereSql, params, "case when http_status_code is null then '无状态码' else cast(http_status_code as text) end", 'http_completed = 1', 8),
      businessActions: this.analyticsGroups(whereSql, params, 'business_action', 'business_action is not null', 8, "business_result = 'failed'"),
      errorTypes: this.analyticsGroups(whereSql, params, "coalesce(error_type, business_action, '未知异常')", "catalog_problem_kind in ('error', 'business_failure')", 8),
      attention: this.analyticsAttention(whereSql, params, 12),
      startup: performance.startup,
      pages: performance.pages,
      sessions: {
        activeSessions: sessions.activeSessions,
        problemSessions: sessions.problemSessions,
        averageDurationMs: sessions.averageDurationMs,
        averageEventCount: sessions.averageEventCount,
        health: sessions.health,
        durationDistribution: sessions.durationDistribution,
        eventCountDistribution: sessions.eventCountDistribution,
        routes: sessions.routes,
      },
      http: {
        total: http.total,
        failed: http.failed,
        slow: http.slow,
        affectedSessions: http.affectedSessions,
        averageMs: http.averageMs,
        p50Ms: http.p50Ms,
        p95Ms: http.p95Ms,
        maxMs: http.maxMs,
        statuses: http.statuses,
        endpoints: http.endpoints,
        routes: http.routes,
        durationDistribution: http.durationDistribution,
      },
      business: {
        total: business.total,
        failed: business.failed,
        cancelled: business.cancelled,
        affectedSessions: business.affectedSessions,
        actions: business.actions,
        routes: business.routes,
      },
      errorsSummary: {
        total: errorsSummary.total,
        affectedSessions: errorsSummary.affectedSessions,
        fatal: errorsSummary.fatal,
        handled: errorsSummary.handled,
        types: errorsSummary.types,
        mechanisms: errorsSummary.mechanisms,
        routes: errorsSummary.routes,
        groups: errorsSummary.groups,
      },
    };
  }

  analyticsSessions(filters: EventFilters): SessionAnalytics {
    const scoped = withoutPaging(filters);
    const { whereSql, params } = whereFromFilters(scoped);
    const range = this.resolveAnalyticsRange(scoped, whereSql, params);
    const sessionWhere = appendWhere(whereSql, 'session_id is not null');
    const issueExpression = "sum(case when ((http_completed = 1 and (http_success = 0 or status = 'error')) or catalog_problem_kind in ('error', 'business_failure')) then 1 else 0 end)";
    const baseCte = `with session_rows as (
      select session_id, min(timestamp_ms) as first_ms, max(timestamp_ms) as last_ms, count(*) as event_count,
        ${issueExpression} as issue_count
      from events ${sessionWhere} group by session_id
    )`;
    const summary = this.selectRows<{ active_sessions: number; problem_sessions: number; average_duration_ms?: number; average_event_count?: number }>(`
      ${baseCte}
      select count(*) as active_sessions,
        sum(case when issue_count > 0 then 1 else 0 end) as problem_sessions,
        avg(last_ms - first_ms) as average_duration_ms,
        avg(event_count) as average_event_count
      from session_rows
    `, params)[0];
    const health = this.selectRows<AnalyticsGroupRow>(`
      ${baseCte}
      select case when issue_count > 0 then '有问题' else '正常' end as key, count(*) as count
      from session_rows group by key order by count desc
    `, params).map(analyticsGroupFromRow);
    const durationDistribution = this.selectRows<AnalyticsGroupRow>(`
      ${baseCte}
      select case
        when last_ms - first_ms < 60000 then '< 1 分钟'
        when last_ms - first_ms < 300000 then '1-5 分钟'
        when last_ms - first_ms < 900000 then '5-15 分钟'
        when last_ms - first_ms < 1800000 then '15-30 分钟'
        else '>= 30 分钟' end as key, count(*) as count
      from session_rows group by key order by min(last_ms - first_ms)
    `, params).map(analyticsGroupFromRow);
    const eventCountDistribution = this.selectRows<AnalyticsGroupRow>(`
      ${baseCte}
      select case
        when event_count < 10 then '< 10'
        when event_count < 50 then '10-49'
        when event_count < 100 then '50-99'
        when event_count < 250 then '100-249'
        else '>= 250' end as key, count(*) as count
      from session_rows group by key order by min(event_count)
    `, params).map(analyticsGroupFromRow);
    return {
      resolvedRange: publicAnalyticsRange(range),
      activeSessions: numeric(summary?.active_sessions),
      problemSessions: numeric(summary?.problem_sessions),
      averageDurationMs: optionalNumeric(summary?.average_duration_ms),
      averageEventCount: optionalNumeric(summary?.average_event_count),
      points: this.analyticsPoints(whereSql, params, range),
      health,
      durationDistribution,
      eventCountDistribution,
      routes: this.analyticsGroups(whereSql, params, "coalesce(route, '未知路由')", 'session_id is not null', 10),
      problems: this.analyticsAttention(whereSql, params, 12),
    };
  }

  analyticsHttp(query: HttpCatalogQuery): HttpAnalytics {
    const scoped = { ...query, limit: undefined, offset: undefined };
    const { whereSql, params } = whereFromHttpCatalogQuery(scoped, query.slowThresholdMs ?? 1000);
    const range = this.resolveAnalyticsRange(scoped, whereSql, params);
    const summary = this.selectRows<{ total: number; failed: number; slow: number; affected_sessions: number; average_ms?: number; max_ms?: number }>(`
      select count(*) as total,
        sum(case when http_success = 0 or status = 'error' then 1 else 0 end) as failed,
        sum(case when http_duration_ms >= 1000 then 1 else 0 end) as slow,
        count(distinct session_id) as affected_sessions,
        avg(http_duration_ms) as average_ms,
        max(http_duration_ms) as max_ms
      from events ${whereSql}
    `, params)[0];
    const percentiles = this.httpDurationPercentiles(whereSql, params);
    const durationDistribution = this.selectRows<AnalyticsGroupRow>(`
      select case
        when http_duration_ms is null then '未知'
        when http_duration_ms < 200 then '< 200ms'
        when http_duration_ms < 500 then '200-499ms'
        when http_duration_ms < 1000 then '500-999ms'
        when http_duration_ms < 3000 then '1-3s'
        else '>= 3s' end as key, count(*) as count
      from events ${whereSql}
      group by key order by min(coalesce(http_duration_ms, -1))
    `, params).map(analyticsGroupFromRow);
    return {
      resolvedRange: publicAnalyticsRange(range),
      total: numeric(summary?.total),
      failed: numeric(summary?.failed),
      slow: numeric(summary?.slow),
      affectedSessions: numeric(summary?.affected_sessions),
      averageMs: optionalNumeric(summary?.average_ms),
      p50Ms: percentiles.p50Ms,
      p95Ms: percentiles.p95Ms,
      maxMs: optionalNumeric(summary?.max_ms),
      points: this.analyticsPoints(whereSql, params, range),
      statuses: this.analyticsGroups(whereSql, params, "case when http_status_code is null then '无状态码' else cast(http_status_code as text) end", undefined, 12),
      endpoints: this.analyticsGroups(whereSql, params, "coalesce(http_url, '未知端点')", undefined, 12, "http_success = 0 or status = 'error'", 'http_duration_ms'),
      routes: this.analyticsGroups(whereSql, params, "coalesce(route, '未知路由')", undefined, 10, "http_success = 0 or status = 'error'", 'http_duration_ms'),
      durationDistribution,
      routeEndpointMatrix: this.analyticsMatrix(
        whereSql,
        params,
        "coalesce(route, '未知路由')",
        "coalesce(http_url, '未知端点')",
        8,
        8,
        "http_success = 0 or status = 'error'",
      ),
    };
  }

  analyticsBusiness(query: BusinessCatalogQuery): BusinessAnalytics {
    const scoped = { ...query, limit: undefined, offset: undefined };
    const { whereSql, params } = whereFromBusinessCatalogQuery(scoped);
    const range = this.resolveAnalyticsRange(scoped, whereSql, params);
    const summary = this.selectRows<{ total: number; failed: number; cancelled: number; affected_sessions: number }>(`
      select count(*) as total,
        sum(case when business_result = 'failed' then 1 else 0 end) as failed,
        sum(case when business_result = 'cancelled' then 1 else 0 end) as cancelled,
        count(distinct session_id) as affected_sessions
      from events ${whereSql}
    `, params)[0];
    return {
      resolvedRange: publicAnalyticsRange(range),
      total: numeric(summary?.total),
      failed: numeric(summary?.failed),
      cancelled: numeric(summary?.cancelled),
      affectedSessions: numeric(summary?.affected_sessions),
      points: this.analyticsPoints(whereSql, params, range),
      actions: this.analyticsGroups(whereSql, params, 'business_action', undefined, 12, "business_result = 'failed'"),
      routes: this.analyticsGroups(whereSql, params, "coalesce(route, '未知路由')", undefined, 10, "business_result = 'failed'"),
      actionRouteMatrix: this.analyticsMatrix(
        whereSql,
        params,
        'business_action',
        "coalesce(route, '未知路由')",
        8,
        8,
        "business_result = 'failed'",
      ),
      failures: this.analyticsAttention(whereSql, params, 12, "business_result = 'failed'"),
    };
  }

  analyticsErrors(query: ErrorCatalogQuery): ErrorAnalytics {
    const scoped = { ...query, limit: undefined, offset: undefined };
    const { whereSql, params } = whereFromErrorCatalogQuery(scoped);
    const range = this.resolveAnalyticsRange(scoped, whereSql, params);
    const summary = this.selectRows<{ total: number; affected_sessions: number; fatal: number; handled: number }>(`
      select count(*) as total,
        count(distinct session_id) as affected_sessions,
        sum(case when error_fatal = 1 then 1 else 0 end) as fatal,
        sum(case when error_handled = 1 then 1 else 0 end) as handled
      from events ${whereSql}
    `, params)[0];
    return {
      resolvedRange: publicAnalyticsRange(range),
      total: numeric(summary?.total),
      affectedSessions: numeric(summary?.affected_sessions),
      fatal: numeric(summary?.fatal),
      handled: numeric(summary?.handled),
      points: this.analyticsPoints(whereSql, params, range),
      types: this.analyticsGroups(whereSql, params, "coalesce(error_type, business_action, '未知异常')", undefined, 12),
      mechanisms: this.analyticsGroups(whereSql, params, "coalesce(error_mechanism, case when catalog_problem_kind = 'business_failure' then 'business' end, '未知机制')", undefined, 10),
      routes: this.analyticsGroups(whereSql, params, "coalesce(route, '未知路由')", undefined, 10),
      groups: this.analyticsGroups(
        whereSql,
        params,
        "coalesce(error_type, business_action, '未知异常') || ' · ' || coalesce(route, '未知路由')",
        undefined,
        12,
      ),
      recent: this.analyticsAttention(whereSql, params, 12),
    };
  }

  private resolveAnalyticsRange(filters: EventFilters, whereSql: string, params: SqlParam[]): ResolvedAnalyticsRange {
    const row = this.selectRows<AnalyticsRangeRow>(`select min(timestamp_ms) as min_ms, max(timestamp_ms) as max_ms from events ${whereSql}`, params)[0];
    const requestedFrom = parsedTimestamp(filters.from);
    const requestedTo = parsedTimestamp(filters.to);
    const fromMs = requestedFrom ?? optionalNumeric(row?.min_ms);
    const toMs = requestedTo ?? optionalNumeric(row?.max_ms);
    const bucket = analyticsBucketFor(fromMs, toMs);
    return {
      from: fromMs === undefined ? undefined : new Date(fromMs).toISOString(),
      to: toMs === undefined ? undefined : new Date(toMs).toISOString(),
      bucket,
      bucketMs: analyticsBucketMs(bucket),
      generatedAt: new Date().toISOString(),
      fromMs,
      toMs,
    };
  }

  private analyticsPoints(whereSql: string, params: SqlParam[], range: ResolvedAnalyticsRange): AnalyticsPoint[] {
    if (range.fromMs === undefined || range.toMs === undefined) return [];
    const bucketExpression = `cast(timestamp_ms / ${range.bucketMs} as integer) * ${range.bucketMs}`;
    const rows = this.selectRows<AnalyticsPointRow>(`
      select ${bucketExpression} as bucket_start,
        count(distinct session_id) as active_sessions,
        sum(case when http_completed = 1 then 1 else 0 end) as http_total,
        sum(case when http_completed = 1 and (http_success = 0 or status = 'error') then 1 else 0 end) as http_failed,
        sum(case when business_action is not null then 1 else 0 end) as business_total,
        sum(case when business_action is not null and business_result = 'failed' then 1 else 0 end) as business_failed,
        sum(case when business_action is not null and business_result = 'cancelled' then 1 else 0 end) as business_cancelled,
        sum(case when catalog_problem_kind in ('error', 'business_failure') then 1 else 0 end) as errors
      from events ${whereSql}
      group by bucket_start order by bucket_start asc
    `, params);
    return rows.slice(-120).map((row) => ({
      from: new Date(row.bucket_start).toISOString(),
      to: new Date(Math.min(row.bucket_start + range.bucketMs, range.toMs!)).toISOString(),
      activeSessions: numeric(row.active_sessions),
      httpTotal: numeric(row.http_total),
      httpFailed: numeric(row.http_failed),
      businessTotal: numeric(row.business_total),
      businessFailed: numeric(row.business_failed),
      businessCancelled: numeric(row.business_cancelled),
      errors: numeric(row.errors),
    }));
  }

  private analyticsGroups(
    whereSql: string,
    params: SqlParam[],
    keyExpression: string,
    predicate: string | undefined,
    limit: number,
    failedPredicate?: string,
    durationColumn?: string,
  ): AnalyticsGroupItem[] {
    const scopedWhere = predicate ? appendWhere(whereSql, predicate) : whereSql;
    return this.selectRows<AnalyticsGroupRow>(`
      with ranked as (
        select ${keyExpression} as key,
          event_id, session_id, trace_id, route,
          ${failedPredicate ? `case when ${failedPredicate} then 1 else 0 end` : '0'} as is_failed,
          ${durationColumn ? durationColumn : 'null'} as duration_ms,
          row_number() over (partition by ${keyExpression} order by timestamp_ms desc, sequence desc) as rn
        from events ${scopedWhere}
      )
      select key,
        count(*) as count,
        sum(is_failed) as failed,
        avg(duration_ms) as average_ms,
        max(duration_ms) as max_ms,
        max(case when rn = 1 then event_id end) as event_id,
        max(case when rn = 1 then session_id end) as session_id,
        max(case when rn = 1 then trace_id end) as trace_id,
        max(case when rn = 1 then route end) as route
      from ranked
      group by key
      order by count desc, key asc
      limit ${Math.min(Math.max(limit, 1), 50)}
    `, params).map(analyticsGroupFromRow);
  }

  private sessionHealthGroups(whereSql: string, params: SqlParam[]): AnalyticsGroupItem[] {
    const scopedWhere = appendWhere(whereSql, 'session_id is not null');
    return this.selectRows<AnalyticsGroupRow>(`
      with session_health as (
        select session_id,
          sum(case when ((http_completed = 1 and (http_success = 0 or status = 'error')) or catalog_problem_kind in ('error', 'business_failure')) then 1 else 0 end) as issues
        from events ${scopedWhere} group by session_id
      )
      select case when issues > 0 then '有问题' else '正常' end as key, count(*) as count
      from session_health group by key order by count desc
    `, params).map(analyticsGroupFromRow);
  }

  private analyticsMatrix(
    whereSql: string,
    params: SqlParam[],
    rowExpression: string,
    columnExpression: string,
    rowLimit: number,
    columnLimit: number,
    failedPredicate?: string,
  ): AnalyticsMatrixCell[] {
    const topRows = this.selectRows<{ key: string }>(`
      select ${rowExpression} as key, count(*) as count
      from events ${whereSql}
      group by key order by count desc, key asc limit ${Math.min(Math.max(rowLimit, 1), 20)}
    `, params).map((row) => String(row.key));
    const topColumns = this.selectRows<{ key: string }>(`
      select ${columnExpression} as key, count(*) as count
      from events ${whereSql}
      group by key order by count desc, key asc limit ${Math.min(Math.max(columnLimit, 1), 20)}
    `, params).map((row) => String(row.key));
    if (topRows.length === 0 || topColumns.length === 0) return [];

    const rowCase = caseBucketExpression(rowExpression, topRows, '其他行');
    const columnCase = caseBucketExpression(columnExpression, topColumns, '其他列');
    return this.selectRows<AnalyticsMatrixRow>(`
      with ranked as (
        select ${rowCase} as row_key, ${columnCase} as column_key,
          event_id, session_id, trace_id,
          ${failedPredicate ? `case when ${failedPredicate} then 1 else 0 end` : '0'} as is_failed,
          row_number() over (partition by ${rowCase}, ${columnCase} order by timestamp_ms desc, sequence desc) as rn
        from events ${whereSql}
      )
      select row_key, column_key,
        count(*) as count,
        sum(is_failed) as failed,
        max(case when rn = 1 then event_id end) as event_id,
        max(case when rn = 1 then session_id end) as session_id,
        max(case when rn = 1 then trace_id end) as trace_id
      from ranked
      group by row_key, column_key
      order by count desc, row_key asc, column_key asc
      limit 120
    `, params).map(analyticsMatrixFromRow);
  }

  private httpDurationPercentiles(whereSql: string, params: SqlParam[]): { p50Ms?: number; p95Ms?: number } {
    const durations = this.selectRows<{ http_duration_ms?: number }>(`
      select http_duration_ms from events ${appendWhere(whereSql, 'http_duration_ms is not null')}
      order by http_duration_ms asc
      limit 5000
    `, params)
      .map((row) => optionalNumeric(row.http_duration_ms))
      .filter((value): value is number => value !== undefined);
    if (durations.length === 0) return {};
    return {
      p50Ms: percentile(durations, 0.5),
      p95Ms: percentile(durations, 0.95),
    };
  }

  private analyticsAttention(whereSql: string, params: SqlParam[], limit: number, predicate?: string): AnalyticsAttentionItem[] {
    const issuePredicate = predicate ?? "((http_completed = 1 and (http_success = 0 or status = 'error')) or catalog_problem_kind in ('error', 'business_failure'))";
    const scopedWhere = appendWhere(whereSql, issuePredicate);
    const groupKey = `
      case
        when http_completed = 1 then 'http:' || coalesce(http_method, '') || ' ' || coalesce(http_url, '未知端点')
        when catalog_problem_kind = 'business_failure' or business_result = 'failed' then 'business:' || coalesce(business_action, '业务失败')
        else 'error:' || coalesce(error_type, business_action, error_message, '未知异常')
      end
    `;
    return this.selectRows<AnalyticsAttentionRow>(`
      with ranked as (
        select ${groupKey} as group_key,
          event_id, session_id, trace_id, timestamp_ms, route, http_method, http_url, http_status_code,
          business_action, business_result, error_type, error_message, catalog_problem_kind,
          row_number() over (partition by ${groupKey} order by timestamp_ms desc, sequence desc) as rn
        from events ${scopedWhere}
      ),
      aggregated as (
        select group_key,
          count(*) as count,
          count(distinct session_id) as affected_sessions,
          max(timestamp_ms) as timestamp_ms,
          max(case when rn = 1 then event_id end) as event_id,
          max(case when rn = 1 then session_id end) as session_id,
          max(case when rn = 1 then trace_id end) as trace_id,
          max(case when rn = 1 then route end) as route,
          max(case when rn = 1 then http_method end) as http_method,
          max(case when rn = 1 then http_url end) as http_url,
          max(case when rn = 1 then http_status_code end) as http_status_code,
          max(case when rn = 1 then business_action end) as business_action,
          max(case when rn = 1 then business_result end) as business_result,
          max(case when rn = 1 then error_type end) as error_type,
          max(case when rn = 1 then error_message end) as error_message,
          max(case when rn = 1 then catalog_problem_kind end) as catalog_problem_kind
        from ranked
        group by group_key
      )
      select event_id, session_id, trace_id, timestamp_ms, route, http_method, http_url, http_status_code,
        business_action, business_result, error_type, error_message, catalog_problem_kind, count, affected_sessions
      from aggregated
      order by count desc, affected_sessions desc, timestamp_ms desc
      limit ${Math.min(Math.max(limit, 1), 50)}
    `, params).map(analyticsAttentionFromRow);
  }

  dimensions(filters: EventFilters, options: { q?: string; limit?: number } = {}): DimensionSummary {
    const dimensionFilters = withoutPaging(filters);
    const httpDimensionFilters: EventFilters = { ...dimensionFilters, name: 'http.client' };
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
      userIds: this.suggestOptions('user_id', { ...dimensionFilters, userId: undefined }, options),
      sessionIds: this.suggestOptions('session_id', { ...dimensionFilters, sessionId: undefined }, options),
      requestIds: this.suggestOptions('http_request_id', httpDimensionFilters, options),
      httpMethods: this.dimensionOptions('http_method', httpDimensionFilters),
      httpStatusCodes: this.dimensionOptions('http_status_code', httpDimensionFilters),
      httpBusinessCodes: this.dimensionOptions('http_business_code', httpDimensionFilters),
      httpHosts: this.dimensionOptions('http_host', httpDimensionFilters),
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
        http_method text,
        http_url text,
        http_host text,
        http_status_code integer,
        http_request_id text,
        http_success integer,
        http_duration_ms real,
        http_business_code text,
        http_business_code_state text,
        http_completed integer,
        business_action text,
        business_result text,
        error_type text,
        error_mechanism text,
        error_fatal integer,
        error_handled integer,
        error_message text,
        catalog_problem_kind text,
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
      create index if not exists idx_events_http_catalog on events(name, http_method, http_status_code, timestamp_ms, sequence);
      create index if not exists idx_events_http_host on events(http_host, timestamp_ms, sequence);
      create index if not exists idx_events_http_business_code on events(http_business_code, timestamp_ms, sequence);
      create index if not exists idx_events_business_catalog on events(business_action, business_result, timestamp_ms, sequence);
      create index if not exists idx_events_error_catalog on events(catalog_problem_kind, error_type, error_mechanism, timestamp_ms, sequence);
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
        http_method,
        http_url,
        http_host,
        http_status_code,
        http_request_id,
        http_success,
        http_duration_ms,
        http_business_code,
        http_business_code_state,
        http_completed,
        business_action,
        business_result,
        error_type,
        error_mechanism,
        error_fatal,
        error_handled,
        error_message,
        catalog_problem_kind,
        envelope_json
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        http_method = excluded.http_method,
        http_url = excluded.http_url,
        http_host = excluded.http_host,
        http_status_code = excluded.http_status_code,
        http_request_id = excluded.http_request_id,
        http_success = excluded.http_success,
        http_duration_ms = excluded.http_duration_ms,
        http_business_code = excluded.http_business_code,
        http_business_code_state = excluded.http_business_code_state,
        http_completed = excluded.http_completed,
        business_action = excluded.business_action,
        business_result = excluded.business_result,
        error_type = excluded.error_type,
        error_mechanism = excluded.error_mechanism,
        error_fatal = excluded.error_fatal,
        error_handled = excluded.error_handled,
        error_message = excluded.error_message,
        catalog_problem_kind = excluded.catalog_problem_kind,
        envelope_json = excluded.envelope_json
    `);
    try {
      this.db.run('begin');
      for (const event of events) {
        const http = httpCatalogFieldsOf(event);
        const domain = domainCatalogFieldsOf(event);
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
          http.method ?? null,
          http.url ?? null,
          http.host ?? null,
          http.statusCode ?? null,
          http.requestId ?? null,
          booleanSqlValue(http.success),
          event.durationMs ?? null,
          http.businessCode ?? null,
          http.businessCodeState,
          isCompletedHttpEvent(event) ? 1 : 0,
          domain.businessAction ?? null,
          domain.businessResult ?? null,
          domain.errorType ?? null,
          domain.errorMechanism ?? null,
          booleanSqlValue(domain.errorFatal),
          booleanSqlValue(domain.errorHandled),
          domain.errorMessage ?? null,
          catalogProblemKind(event),
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
      http_method: 'text',
      http_url: 'text',
      http_host: 'text',
      http_status_code: 'integer',
      http_request_id: 'text',
      http_success: 'integer',
      http_duration_ms: 'real',
      http_business_code: 'text',
      http_business_code_state: 'text',
      http_completed: 'integer',
      business_action: 'text',
      business_result: 'text',
      error_type: 'text',
      error_mechanism: 'text',
      error_fatal: 'integer',
      error_handled: 'integer',
      error_message: 'text',
      catalog_problem_kind: 'text',
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
          or (name = 'http.client' and (http_business_code_state is null or http_completed is null))
          or catalog_problem_kind is null
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
        ,http_method = ?
        ,http_url = ?
        ,http_host = ?
        ,http_status_code = ?
        ,http_request_id = ?
        ,http_success = ?
        ,http_duration_ms = ?
        ,http_business_code = ?
        ,http_business_code_state = ?
        ,http_completed = ?
        ,business_action = ?
        ,business_result = ?
        ,error_type = ?
        ,error_mechanism = ?
        ,error_fatal = ?
        ,error_handled = ?
        ,error_message = ?
        ,catalog_problem_kind = ?
      where event_id = ?
    `);
    try {
      this.db.run('begin');
      for (const row of rows) {
        const event = JSON.parse(row.envelope_json) as MonitorEvent;
        const http = httpCatalogFieldsOf(event);
        const domain = domainCatalogFieldsOf(event);
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
          http.method ?? null,
          http.url ?? null,
          http.host ?? null,
          http.statusCode ?? null,
          http.requestId ?? null,
          booleanSqlValue(http.success),
          event.durationMs ?? null,
          http.businessCode ?? null,
          http.businessCodeState,
          isCompletedHttpEvent(event) ? 1 : 0,
          domain.businessAction ?? null,
          domain.businessResult ?? null,
          domain.errorType ?? null,
          domain.errorMechanism ?? null,
          booleanSqlValue(domain.errorFatal),
          booleanSqlValue(domain.errorHandled),
          domain.errorMessage ?? null,
          catalogProblemKind(event),
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
    ownFilterKey?: keyof EventFilters,
  ): DimensionOption[] {
    const scoped = ownFilterKey ? { ...filters, [ownFilterKey]: undefined } : filters;
    const { whereSql, params } = whereFromFilters(scoped);
    return this.selectRows<DimensionRow>(
      `
        select cast(${columnName} as text) as value, count(*) as count
        from events
        ${whereSql}
          ${whereSql ? 'and' : 'where'} ${columnName} is not null
          and cast(${columnName} as text) <> ''
        group by ${columnName}
        order by count desc, value asc
        limit 200
      `,
      params,
    ).map((row) => ({ value: String(row.value), count: row.count }));
  }

  private suggestOptions(
    columnName: 'user_id' | 'session_id' | 'http_request_id',
    filters: EventFilters,
    options: { q?: string; limit?: number },
  ): DimensionOption[] {
    const { whereSql, params } = whereFromFilters(withoutPaging(filters));
    const q = options.q?.trim().toLowerCase();
    const clauses = [`${columnName} is not null`, `${columnName} <> ''`];
    if (q) {
      clauses.push(`lower(${columnName}) like ? escape '\\'`);
      params.push(`%${escapeLike(q)}%`);
    }
    const connector = whereSql ? 'and' : 'where';
    const rankSql = q
      ? `case when lower(${columnName}) = ? then 0 when lower(${columnName}) like ? escape '\\' then 1 else 2 end,`
      : '';
    const rankParams: SqlParam[] = q ? [q, `${escapeLike(q)}%`] : [];
    return this.selectRows<DimensionRow & { last_timestamp_ms: number }>(
      `select ${columnName} as value, count(*) as count, max(timestamp_ms) as last_timestamp_ms
       from events ${whereSql} ${connector} ${clauses.join(' and ')}
       group by ${columnName}
       order by ${rankSql} last_timestamp_ms desc, value asc
       limit ?`,
      [...params, ...rankParams, Math.min(Math.max(options.limit ?? 20, 1), 100)],
    ).map((row) => ({ value: row.value, count: row.count, lastTimestamp: new Date(row.last_timestamp_ms).toISOString() }));
  }
}

function whereFromFilters(filters: EventFilters): { whereSql: string; params: SqlParam[] } {
  const clauses: string[] = [];
  const params: SqlParam[] = [];
  addEqualityFilter(clauses, params, 'session_id', filters.sessionId);
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

function whereFromHttpCatalogQuery(query: HttpCatalogQuery, slowThresholdMs: number): { whereSql: string; params: SqlParam[] } {
  const { whereSql, params } = whereFromFilters(query);
  const clauses = whereSql ? [whereSql.slice('where '.length)] : [];
  clauses.push("name = 'http.client'");
  clauses.push('http_completed = 1');
  addLikeFilter(clauses, params, 'http_url', query.url);
  addEqualityFilter(clauses, params, 'http_method', query.method);
  addEqualityFilter(clauses, params, 'http_request_id', query.requestId);
  addNumericListFilter(clauses, params, 'http_status_code', query.statusCode);
  addEqualityFilter(clauses, params, 'http_business_code', query.businessCode);
  addEqualityFilter(clauses, params, 'http_host', query.host);
  addHttpResultFilter(clauses, query.result);
  if (query.slowOnly) {
    clauses.push('http_duration_ms >= ?');
    params.push(slowThresholdMs);
  }
  return { whereSql: `where ${clauses.join(' and ')}`, params };
}

function addHttpResultFilter(
  clauses: string[],
  result: HttpCatalogQuery['result'],
): void {
  const values = (Array.isArray(result) ? result : result ? [result] : [])
    .filter((value): value is 'success' | 'failed' | 'unknown' => (
      value === 'success' || value === 'failed' || value === 'unknown'
    ));
  if (values.length === 0) return;
  const parts = values.map((value) => {
    if (value === 'success') return 'http_success = 1';
    if (value === 'failed') return "(http_success = 0 or status = 'error')";
    return "http_success is null and status != 'error'";
  });
  clauses.push(`(${parts.join(' or ')})`);
}

function whereFromBusinessCatalogQuery(query: BusinessCatalogQuery): { whereSql: string; params: SqlParam[] } {
  const { whereSql, params } = whereFromFilters(query);
  const clauses = whereSql ? [whereSql.slice('where '.length)] : [];
  clauses.push('business_action is not null');
  addLikeFilter(clauses, params, 'business_action', query.action);
  addEqualityFilter(clauses, params, 'business_result', query.result);
  return { whereSql: `where ${clauses.join(' and ')}`, params };
}

function whereFromErrorCatalogQuery(query: ErrorCatalogQuery): { whereSql: string; params: SqlParam[] } {
  const { whereSql, params } = whereFromFilters(query);
  const clauses = whereSql ? [whereSql.slice('where '.length)] : [];
  clauses.push(query.businessOnly ? "catalog_problem_kind = 'business_failure'" : "catalog_problem_kind in ('error', 'business_failure')");
  addLikeFilter(clauses, params, 'error_type', query.errorType);
  addEqualityFilter(clauses, params, 'error_mechanism', query.mechanism);
  if (query.fatal !== undefined) { clauses.push('error_fatal = ?'); params.push(booleanSqlValue(query.fatal)); }
  if (query.handled !== undefined) { clauses.push('error_handled = ?'); params.push(booleanSqlValue(query.handled)); }
  return { whereSql: `where ${clauses.join(' and ')}`, params };
}

function businessCatalogItemFromEvent(event: MonitorEvent): BusinessCatalogItem {
  const domain = domainCatalogFieldsOf(event);
  return { eventId: event.eventId ?? '', timestamp: event.timestamp ?? event.startTime, action: domain.businessAction ?? event.name ?? '未知动作', result: domain.businessResult, route: routeOf(event), userId: userIdOf(event), sessionId: event.sessionId, traceId: event.traceId, appVersion: appVersionOf(event), environment: environmentOf(event), summary: event.name === 'business.action.summary' };
}

function catalogProblemKind(event: MonitorEvent): string {
  if (isBusinessFailureEvent(event)) return 'business_failure';
  if (isStabilityErrorEvent(event)) return 'error';
  if (nameOf(event) === 'error.group.summary') return 'error';
  return 'none';
}

function errorCatalogItemFromEvent(event: MonitorEvent): ErrorCatalogItem {
  const domain = domainCatalogFieldsOf(event);
  const businessFailure = isBusinessFailureEvent(event);
  const summary = event.name === 'error.group.summary';
  const title = stringAttribute(event, 'error.title');
  const fingerprint = stringAttribute(event, 'error.fingerprint');
  const occurrenceCount = summary
    ? numericAttribute(event, 'summary.count')
    : undefined;
  return {
    eventId: event.eventId ?? '',
    timestamp: event.timestamp ?? event.startTime,
    kind: businessFailure ? 'business_failure' : 'error',
    type: businessFailure
      ? (domain.businessAction ?? '业务失败')
      : (title ?? domain.errorType ?? event.name ?? '未知错误'),
    message: businessFailure
      ? domain.businessResult
      : (domain.errorMessage ?? title),
    mechanism: domain.errorMechanism,
    fatal: domain.errorFatal,
    handled: domain.errorHandled,
    fingerprint,
    title,
    occurrenceCount,
    summary,
    route: routeOf(event),
    userId: userIdOf(event),
    sessionId: event.sessionId,
    traceId: event.traceId,
    appVersion: appVersionOf(event),
    environment: environmentOf(event),
  };
}

function httpCatalogItemFromEvent(event: MonitorEvent): HttpCatalogItem {
  const http = httpCatalogFieldsOf(event);
  return {
    eventId: event.eventId ?? '',
    timestamp: event.timestamp ?? event.startTime,
    method: http.method,
    url: http.url,
    host: http.host,
    statusCode: http.statusCode,
    businessCode: http.businessCode,
    businessCodeState: http.businessCodeState,
    durationMs: event.durationMs,
    success: http.success,
    route: routeOf(event),
    userId: userIdOf(event),
    sessionId: event.sessionId,
    traceId: event.traceId,
    requestId: http.requestId,
    appVersion: appVersionOf(event),
    environment: environmentOf(event),
    devicePlatform: devicePlatformOf(event),
    requestSizeBytes: numericAttribute(event, 'http.request_content_length') ?? numericAttribute(event, 'http.request.size_bytes'),
    responseSizeBytes: numericAttribute(event, 'http.response_content_length') ?? numericAttribute(event, 'http.response.size_bytes'),
    detailDropped: readPayloadBoolean(event, 'http.detail_dropped'),
  };
}

function readPayloadBoolean(event: MonitorEvent, key: string): boolean {
  return event.payload?.[key] === true;
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

function catalogOrderSql(
  sortBy: string | undefined,
  sortDir: 'asc' | 'desc' | undefined,
  columns: Record<string, string>,
  defaultColumn: string,
): string {
  const column = (sortBy && columns[sortBy]) || defaultColumn;
  const direction = sortDir === 'asc' ? 'asc' : 'desc';
  const nulls = direction === 'asc' ? `${column} is null,` : `${column} is not null,`;
  return `order by ${nulls} ${column} ${direction}, sequence ${direction}`;
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

function addNumericListFilter(
  clauses: string[],
  params: SqlParam[],
  columnName: string,
  values: number[] | undefined,
): void {
  if (!values?.length) return;
  clauses.push(`${columnName} in (${values.map(() => '?').join(', ')})`);
  params.push(...values);
}

function booleanSqlValue(value: boolean | undefined): number | null {
  if (value === undefined) return null;
  return value ? 1 : 0;
}

function withoutPaging(filters: EventFilters): EventFilters {
  const { limit: _limit, offset: _offset, ...rest } = filters;
  return rest;
}

function appendWhere(whereSql: string, predicate: string): string {
  return `${whereSql} ${whereSql ? 'and' : 'where'} ${predicate}`.trim();
}

function numeric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function optionalNumeric(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parsedTimestamp(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function analyticsBucketFor(fromMs: number | undefined, toMs: number | undefined): AnalyticsRange['bucket'] {
  if (fromMs === undefined || toMs === undefined) return 'day';
  const span = Math.max(toMs - fromMs, 0);
  if (span <= 48 * 60 * 60 * 1000) return 'hour';
  if (span <= 120 * 24 * 60 * 60 * 1000) return 'day';
  if (span <= 2 * 365 * 24 * 60 * 60 * 1000) return 'week';
  return 'month';
}

function analyticsBucketMs(bucket: AnalyticsRange['bucket']): number {
  if (bucket === 'hour') return 60 * 60 * 1000;
  if (bucket === 'day') return 24 * 60 * 60 * 1000;
  if (bucket === 'week') return 7 * 24 * 60 * 60 * 1000;
  return 30 * 24 * 60 * 60 * 1000;
}

function publicAnalyticsRange(range: ResolvedAnalyticsRange): AnalyticsRange {
  return {
    from: range.from,
    to: range.to,
    bucket: range.bucket,
    generatedAt: range.generatedAt,
  };
}

function analyticsGroupFromRow(row: AnalyticsGroupRow): AnalyticsGroupItem {
  return {
    key: String(row.key ?? '未知'),
    count: numeric(row.count),
    failed: optionalNumeric(row.failed),
    averageMs: optionalNumeric(row.average_ms),
    maxMs: optionalNumeric(row.max_ms),
    eventId: row.event_id || undefined,
    sessionId: row.session_id || undefined,
    traceId: row.trace_id || undefined,
    route: row.route || undefined,
  };
}

function analyticsMatrixFromRow(row: AnalyticsMatrixRow): AnalyticsMatrixCell {
  return {
    row: String(row.row_key ?? '未知'),
    column: String(row.column_key ?? '未知'),
    count: numeric(row.count),
    failed: optionalNumeric(row.failed),
    eventId: row.event_id || undefined,
    sessionId: row.session_id || undefined,
    traceId: row.trace_id || undefined,
  };
}

function analyticsAttentionFromRow(row: AnalyticsAttentionRow): AnalyticsAttentionItem {
  const domain: AnalyticsAttentionItem['domain'] = row.http_url || row.http_method
    ? 'http'
    : row.catalog_problem_kind === 'business_failure'
      ? 'business'
      : 'error';
  const title = domain === 'http'
    ? `${row.http_method ?? 'HTTP'} ${row.http_url ?? '未知端点'}`
    : domain === 'business'
      ? row.business_action ?? '业务失败'
      : row.error_type ?? row.error_message ?? '未知异常';
  const detail = domain === 'http'
    ? (row.http_status_code === undefined ? '请求失败' : `HTTP ${row.http_status_code}`)
    : domain === 'business'
      ? row.business_result ?? 'failed'
      : row.error_message;
  return {
    domain,
    eventId: row.event_id,
    sessionId: row.session_id,
    traceId: row.trace_id,
    timestamp: row.timestamp_ms === undefined ? undefined : new Date(row.timestamp_ms).toISOString(),
    title,
    detail,
    route: row.route,
    count: numeric(row.count ?? 1),
    affectedSessions: numeric(row.affected_sessions ?? (row.session_id ? 1 : 0)),
  };
}

function caseBucketExpression(expression: string, allowed: string[], otherLabel: string): string {
  if (allowed.length === 0) return `'${escapeSqlLiteral(otherLabel)}'`;
  const whens = allowed.map((value) => `when ${expression} = '${escapeSqlLiteral(value)}' then '${escapeSqlLiteral(value)}'`).join(' ');
  return `case ${whens} else '${escapeSqlLiteral(otherLabel)}' end`;
}

function escapeSqlLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

function percentile(sorted: number[], ratio: number): number | undefined {
  if (sorted.length === 0) return undefined;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
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
