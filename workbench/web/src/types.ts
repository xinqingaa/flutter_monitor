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

export interface PerformanceMetricSummary {
  count: number;
  errorCount: number;
  p50Ms?: number;
  p95Ms?: number;
  maxMs?: number;
  slowCount: number;
  events: MonitorEvent[];
}

export interface PerformanceOverview {
  startup: PerformanceMetricSummary;
  pages: PerformanceMetricSummary;
  http: PerformanceMetricSummary;
  jank: PerformanceMetricSummary;
  errors: PerformanceMetricSummary;
}
