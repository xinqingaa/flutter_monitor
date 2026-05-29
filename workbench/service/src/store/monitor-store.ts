import type {
  EventFilters,
  MonitorEvent,
  PerformanceOverview,
  SessionSummary,
} from './event-types.js';

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
  getRecentEvents(limit: number): MonitorEvent[];
  groupEvents(by: string): Array<Record<string, unknown>>;
  listSessions(filters: EventFilters): {
    sessions: SessionSummary[];
    userIdAvailable: boolean;
  };
  searchEvents(query: string, filters: EventFilters): MonitorEvent[];
  performanceOverview(filters: EventFilters): PerformanceOverview;
  health(): MonitorStoreHealth;
  close?(): void;
}
