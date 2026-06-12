import type {
  DimensionSummary,
  EventFilters,
  MonitorEvent,
  PerformanceOverview,
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
  dimensions(filters: EventFilters): DimensionSummary;
  health(): MonitorStoreHealth;
  close?(): void;
}
