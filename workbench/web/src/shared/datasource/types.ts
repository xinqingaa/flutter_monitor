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
  nativeAvailable?: boolean;
  nativeVersion?: string;
  nativePlatform?: string;
  errorCount: number;
  jankCount: number;
  failedHttpCount: number;
}

export interface PerformanceMetricEvent {
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
  attributes?: JsonObject;
  resource?: JsonObject;
  context?: JsonObject;
}

export interface PerformanceMetricSummary {
  count: number;
  errorCount: number;
  durationSummary?: DurationSummary;
  events: PerformanceMetricEvent[];
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
  recent: PerformanceMetricEvent[];
}

export interface PerformanceOverview {
  startup: StartupPerformanceSummary;
  pages: PagePerformanceSummary;
  http: HttpPerformanceSummary;
  jank: JankPerformanceSummary;
  errors: ErrorPerformanceSummary;
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
  offset?: number;
}

export interface SessionListResult {
  sessions: SessionSummary[];
  userIdAvailable: boolean;
  userIdQueryAvailable?: boolean;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface EventListResult {
  events: MonitorEvent[];
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface WorkbenchDatasource {
  health(): Promise<Record<string, unknown>>;
  recent(limit?: number, offset?: number): Promise<EventListResult>;
  listSessions(filters: SessionFilters): Promise<SessionListResult>;
  getSession(sessionId: string): Promise<MonitorEvent[]>;
  getTrace(traceId: string): Promise<MonitorEvent[]>;
  getEvent(eventId: string): Promise<MonitorEvent | undefined>;
  performanceOverview(filters: SessionFilters): Promise<PerformanceOverview>;
  searchEvents(query: string, filters: SessionFilters): Promise<MonitorEvent[]>;
  subscribeEvents(onEvent: (event: MonitorEvent) => void): () => void;
}
