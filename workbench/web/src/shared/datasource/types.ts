export type JsonObject = Record<string, unknown>;

export interface MonitorEvent extends JsonObject {
  eventId?: string;
  timestamp?: string;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  signalType?: string;
  name?: string;
  level?: string;
  status?: string;
  priority?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  resource?: JsonObject;
  context?: JsonObject;
  attributes?: JsonObject;
  payload?: JsonObject;
}

export interface SessionSummary {
  sessionId: string;
  count: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
  firstEventId?: string;
  lastEventId?: string;
  userId?: string;
  appVersion?: string;
  environment?: string;
  route?: string;
  status?: string;
  errorCount: number;
  jankCount: number;
  failedHttpCount: number;
}

export interface PerformanceMetricEvent {
  eventId?: string;
  sessionId?: string;
  traceId?: string;
  name?: string;
  route?: string;
  durationMs?: number;
  status?: string;
  timestamp?: string;
}

export interface PerformanceMetricSummary {
  count: number;
  errorCount: number;
  p50Ms?: number;
  p95Ms?: number;
  maxMs?: number;
  slowCount: number;
  events: PerformanceMetricEvent[];
}

export interface PerformanceOverview {
  startup: PerformanceMetricSummary;
  pages: PerformanceMetricSummary;
  http: PerformanceMetricSummary;
  jank: PerformanceMetricSummary;
  errors: PerformanceMetricSummary;
}

export interface SessionFilters {
  userId?: string;
  from?: string;
  to?: string;
  appVersion?: string;
  environment?: string;
  route?: string;
  status?: string;
  name?: string;
  signalType?: string;
  limit?: number;
}

export interface SessionListResult {
  sessions: SessionSummary[];
  userIdAvailable: boolean;
  userIdQueryAvailable?: boolean;
}

export interface WorkbenchDatasource {
  health(): Promise<Record<string, unknown>>;
  recent(limit?: number): Promise<MonitorEvent[]>;
  listSessions(filters: SessionFilters): Promise<SessionListResult>;
  getSession(sessionId: string): Promise<MonitorEvent[]>;
  getTrace(traceId: string): Promise<MonitorEvent[]>;
  getEvent(eventId: string): Promise<MonitorEvent | undefined>;
  performanceOverview(filters: SessionFilters): Promise<PerformanceOverview>;
  searchEvents(query: string, filters: SessionFilters): Promise<MonitorEvent[]>;
  subscribeEvents(onEvent: (event: MonitorEvent) => void): () => void;
}
