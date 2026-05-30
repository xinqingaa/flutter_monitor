export type MonitorEvent = Record<string, unknown> & {
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
  resource?: Record<string, unknown>;
  context?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

export interface EventFilters {
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

export interface PerformanceMetricSummary {
  count: number;
  errorCount: number;
  avgMs?: number;
  p50Ms?: number;
  p95Ms?: number;
  maxMs?: number;
  slowCount: number;
  events: Array<{
    eventId?: string;
    sessionId?: string;
    traceId?: string;
    name?: string;
    route?: string;
    durationMs?: number;
    status?: string;
    timestamp?: string;
  }>;
}

export interface PerformanceOverview {
  startup: PerformanceMetricSummary;
  pages: PerformanceMetricSummary;
  http: PerformanceMetricSummary;
  jank: PerformanceMetricSummary;
  errors: PerformanceMetricSummary;
}
