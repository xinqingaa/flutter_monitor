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
  durationSummary?: DurationSummary;
  events: Array<{
    eventId?: string;
    sessionId?: string;
    traceId?: string;
    signalType?: string;
    name?: string;
    route?: string;
    durationMs?: number;
    level?: string;
    status?: string;
    timestamp?: string;
    attributes?: Record<string, unknown>;
    resource?: Record<string, unknown>;
    context?: Record<string, unknown>;
  }>;
}

export interface DurationSummary {
  sourceFields: string[];
  sampleCount: number;
  averageMs?: number;
  maxMs?: number;
  latestMs?: number;
  maxEventId?: string;
  latestEventId?: string;
}

export interface MetricGroupSummary {
  key: string;
  count: number;
  sampleCount?: number;
  averageMs?: number;
  maxMs?: number;
  latestMs?: number;
  eventId?: string;
  sessionId?: string;
  traceId?: string;
  route?: string;
}

export interface StartupPerformanceSummary extends PerformanceMetricSummary {
  /** Current SDK semantics: app.cold_start.durationMs is cumulative cold-start-to-first-frame duration. */
  coldStart: DurationSummary;
  /** app.first_frame_ms marks the same cold-start first-frame endpoint and may equal coldStart. */
  firstFrame: DurationSummary;
  sdkInit: DurationSummary;
  /** Lifecycle background interval, not hot resume rendering duration. */
  backgroundInterval: DurationSummary;
  /** app.hot_start.durationMs is hot foreground-resume duration when provided by SDK. */
  hotResume: DurationSummary & {
    available: boolean;
    missingReason?: string;
  };
}

export interface PagePerformanceSummary extends PerformanceMetricSummary {
  load: DurationSummary;
  firstFrame: DurationSummary;
  stay: DurationSummary;
  routeSummaries: MetricGroupSummary[];
}

export interface HttpPerformanceSummary extends PerformanceMetricSummary {
  failedCount: number;
  slowCount: number;
  affectedSessionCount: number;
  routeSummaries: MetricGroupSummary[];
  endpointSummaries: MetricGroupSummary[];
  statusSummaries: MetricGroupSummary[];
}

export interface JankPerformanceSummary extends PerformanceMetricSummary {
  affectedSessionCount: number;
  totalJankFrames: number;
  maxFrame: DurationSummary;
  avgFrame: DurationSummary;
  jankFrames: DurationSummary;
  routeSummaries: MetricGroupSummary[];
}

export interface ErrorPerformanceSummary extends PerformanceMetricSummary {
  affectedSessionCount: number;
  typeSummaries: MetricGroupSummary[];
  mechanismSummaries: MetricGroupSummary[];
  routeSummaries: MetricGroupSummary[];
  recent: PerformanceMetricSummary['events'];
}

export interface PerformanceOverview {
  startup: StartupPerformanceSummary;
  pages: PagePerformanceSummary;
  http: HttpPerformanceSummary;
  jank: JankPerformanceSummary;
  errors: ErrorPerformanceSummary;
}
