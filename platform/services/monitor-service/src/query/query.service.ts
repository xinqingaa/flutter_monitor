import { Inject, Injectable } from '@nestjs/common';
import { clampLimit, clampNumber, filtersFromQuery, httpCatalogQueryFromQuery } from '../query/request-filters';
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

  dimensions(query: QueryRecord) {
    return this.store.dimensions(filtersFromQuery(query));
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
