import { Inject, Injectable } from '@nestjs/common';
import { businessCatalogQueryFromQuery, clampLimit, clampNumber, errorCatalogQueryFromQuery, filtersFromQuery, httpCatalogQueryFromQuery } from '../query/request-filters';
import type { MonitorStore } from '../store/monitor-store';
import { MONITOR_STORE } from '../store/store.tokens';
import { buildSessionConsole } from './session-console';

type QueryRecord = Record<string, string | string[] | undefined>;

@Injectable()
export class QueryService {
  constructor(@Inject(MONITOR_STORE) private readonly store: MonitorStore) {}

  recent(query: QueryRecord) {
    const filters = filtersFromQuery(query);
    const limit = clampLimit(query.limit, 50);
    const offset = clampNumber(query.offset, 0, 0, Number.MAX_SAFE_INTEGER);
    const result = this.store.getRecentEvents(limit, offset, filters);
    return {
      count: result.events.length,
      limit,
      offset,
      hasMore: result.hasMore,
      events: result.events,
    };
  }

  httpCatalog(query: QueryRecord) {
    return this.store.listHttpCatalog(httpCatalogQueryFromQuery(query));
  }

  businessCatalog(query: QueryRecord) { return this.store.listBusinessCatalog(businessCatalogQueryFromQuery(query)); }

  errorCatalog(query: QueryRecord) { return this.store.listErrorCatalog(errorCatalogQueryFromQuery(query)); }

  dimensions(query: QueryRecord) {
    const q = typeof query.q === 'string' ? query.q : undefined;
    return this.store.dimensions(filtersFromQuery(query), { q, limit: clampLimit(query.limit, 20) });
  }

  sessions(query: QueryRecord) {
    const filters = filtersFromQuery(query);
    const result = this.store.listSessions(filters);
    return {
      count: result.sessions.length,
      limit: result.limit,
      offset: result.offset,
      hasMore: result.hasMore,
      userIdAvailable: result.userIdAvailable,
      userIdQueryAvailable: filters.userId ? result.userIdAvailable : undefined,
      sessions: result.sessions,
    };
  }

  sessionConsole(sessionId: string) {
    return buildSessionConsole(sessionId, this.store.getSessionEvents(sessionId));
  }

  search(query: QueryRecord) {
    const filters = filtersFromQuery(query);
    const searchQuery = typeof query.query === 'string' ? query.query : '';
    const events = this.store.searchEvents(searchQuery, filters);
    return { query: searchQuery, count: events.length, events };
  }

  performanceOverview(query: QueryRecord) {
    return this.store.performanceOverview(filtersFromQuery(query));
  }

  analyticsOverview(query: QueryRecord) {
    return this.store.analyticsOverview(filtersFromQuery(query));
  }

  analyticsSessions(query: QueryRecord) {
    return this.store.analyticsSessions(filtersFromQuery(query));
  }

  analyticsHttp(query: QueryRecord) {
    return this.store.analyticsHttp(httpCatalogQueryFromQuery(query));
  }

  analyticsBusiness(query: QueryRecord) {
    return this.store.analyticsBusiness(businessCatalogQueryFromQuery(query));
  }

  analyticsErrors(query: QueryRecord) {
    return this.store.analyticsErrors(errorCatalogQueryFromQuery(query));
  }

  failureTimeseries(query: QueryRecord) {
    const filters = filtersFromQuery(query);
    const now = Date.now();
    const from = filters.from ?? new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const to = filters.to ?? new Date(now).toISOString();
    const bucket = query.bucket === 'day' ? 'day' : 'hour';
    return this.store.failureTimeseries({ ...filters, from, to, limit: undefined, offset: undefined }, bucket);
  }

  businessActions(query: QueryRecord) {
    return this.store.businessActionSummary(filtersFromQuery(query), clampLimit(query.limit, 8));
  }

  performancePages(query: QueryRecord) {
    return this.performanceOverview(query).pages;
  }

  performanceHttp(query: QueryRecord) {
    return this.performanceOverview(query).http;
  }

  groups(query: QueryRecord) {
    const by = typeof query.by === 'string' ? query.by : 'session';
    const groups = this.store.groupEvents(by);
    return { by, count: groups.length, groups };
  }
}
