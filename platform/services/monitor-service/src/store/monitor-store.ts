import type {
  DimensionSummary,
  FailureTimeseries,
  BusinessCatalogQuery,
  BusinessCatalogResult,
  BusinessActionSummary,
  BusinessAnalytics,
  ErrorAnalytics,
  ErrorCatalogQuery,
  ErrorCatalogResult,
  EventFilters,
  HttpCatalogQuery,
  HttpCatalogResult,
  HttpAnalytics,
  MonitorEvent,
  PerformanceOverview,
  OverviewAnalytics,
  SessionAnalytics,
  SessionSummary,
} from './event-types';

export interface MonitorStoreHealth {
  storageMode: string;
  eventCount: number;
  sessionCount: number;
  traceCount: number;
  lastIngestAt?: string;
}

export interface MonitorStore {
  addEvents(events: MonitorEvent[]): MonitorEvent[];
  getEvent(eventId: string): MonitorEvent | undefined;
  getSessionEvents(sessionId: string): MonitorEvent[];
  getTraceEvents(traceId: string): MonitorEvent[];
  getRecentEvents(limit: number, offset?: number, filters?: EventFilters): {
    events: MonitorEvent[];
    hasMore: boolean;
  };
  listHttpCatalog(query: HttpCatalogQuery): HttpCatalogResult;
  listBusinessCatalog(query: BusinessCatalogQuery): BusinessCatalogResult;
  listErrorCatalog(query: ErrorCatalogQuery): ErrorCatalogResult;
  groupEvents(by: string): Array<Record<string, unknown>>;
  listSessions(filters: EventFilters): {
    sessions: SessionSummary[];
    userIdAvailable: boolean;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  searchEvents(query: string, filters: EventFilters): MonitorEvent[];
  performanceOverview(filters: EventFilters): PerformanceOverview;
  dimensions(filters: EventFilters, options?: { q?: string; limit?: number }): DimensionSummary;
  failureTimeseries(filters: EventFilters, bucket: 'hour' | 'day'): FailureTimeseries;
  businessActionSummary(filters: EventFilters, limit: number): BusinessActionSummary;
  analyticsOverview(filters: EventFilters): OverviewAnalytics;
  analyticsSessions(filters: EventFilters): SessionAnalytics;
  analyticsHttp(query: HttpCatalogQuery): HttpAnalytics;
  analyticsBusiness(query: BusinessCatalogQuery): BusinessAnalytics;
  analyticsErrors(query: ErrorCatalogQuery): ErrorAnalytics;
  health(): MonitorStoreHealth;
  close?(): void;
}
