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
  sessionId?: string | string[];
  appKey?: string | string[];
  appName?: string | string[];
  packageName?: string | string[];
  channel?: string | string[];
  flavor?: string | string[];
  buildNumber?: string | string[];
  userId?: string | string[];
  from?: string;
  to?: string;
  appVersion?: string | string[];
  environment?: string | string[];
  devicePlatform?: string | string[];
  deviceModel?: string | string[];
  deviceTier?: string | string[];
  osVersion?: string | string[];
  nativeAvailable?: boolean;
  nativePlatform?: string | string[];
  route?: string | string[];
  status?: string | string[];
  name?: string | string[];
  signalType?: string | string[];
  problemType?: string | string[];
  limit?: number;
  offset?: number;
}

export type HttpBusinessCodeState = 'value' | 'absent' | 'detail_unavailable' | 'parse_failed';

export interface HttpCatalogQuery extends EventFilters {
  url?: string;
  method?: string[];
  result?: 'success' | 'failed' | 'unknown';
  requestId?: string;
  statusCode?: number[];
  businessCode?: string[];
  host?: string;
  slowOnly?: boolean;
  slowThresholdMs?: number;
}

export interface HttpCatalogItem {
  eventId: string;
  timestamp?: string;
  method?: string;
  url?: string;
  host?: string;
  statusCode?: number;
  businessCode?: string;
  businessCodeState: HttpBusinessCodeState;
  durationMs?: number;
  success?: boolean;
  route?: string;
  sessionId?: string;
  traceId?: string;
  requestId?: string;
  requestSizeBytes?: number;
  responseSizeBytes?: number;
  detailDropped: boolean;
}

export interface HttpCatalogResult {
  items: HttpCatalogItem[];
  total: number;
  limit: number;
  offset: number;
  slowThresholdMs: number;
}

export interface BusinessCatalogQuery extends EventFilters {
  action?: string;
  result?: string[];
}

export interface BusinessCatalogItem {
  eventId: string;
  timestamp?: string;
  action: string;
  result?: string;
  route?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  appVersion?: string;
  summary: boolean;
}

export interface BusinessCatalogResult {
  items: BusinessCatalogItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ErrorCatalogQuery extends EventFilters {
  errorType?: string;
  mechanism?: string[];
  fatal?: boolean;
  handled?: boolean;
  businessOnly?: boolean;
}

export interface ErrorCatalogItem {
  eventId: string;
  timestamp?: string;
  kind: 'error' | 'business_failure';
  type: string;
  message?: string;
  mechanism?: string;
  fatal?: boolean;
  handled?: boolean;
  route?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  appVersion?: string;
}

export interface ErrorCatalogResult {
  items: ErrorCatalogItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface SessionSummary {
  sessionId: string;
  count: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
  firstEventId?: string;
  lastEventId?: string;
  appKey?: string;
  appName?: string;
  packageName?: string;
  buildNumber?: string;
  channel?: string;
  flavor?: string;
  userId?: string;
  appVersion?: string;
  environment?: string;
  devicePlatform?: string;
  deviceModel?: string;
  deviceManufacturer?: string;
  deviceTier?: string;
  osVersion?: string;
  route?: string;
  status?: string;
  nativeAvailable?: boolean;
  nativeVersion?: string;
  nativePlatform?: string;
  errorCount: number;
  jankCount: number;
  failedHttpCount: number;
  businessFailureCount: number;
}

export interface SessionConsoleSummary extends SessionSummary {
  durationMs?: number;
  slowHttpCount: number;
  slowPageCount: number;
  sdkDroppedCount: number;
  sdkRetryCount: number;
  sdkFlushFailureCount: number;
  latestQueueLength?: number;
  latestQueueBytes?: number;
  detailDroppedCount: number;
  httpCount: number;
  interactionEventCount: number;
  businessEventCount: number;
  memoryEventCount: number;
  lifecycleEventCount: number;
  pageCount: number;
  routeCount: number;
  firstRoute?: string;
  lastRoute?: string;
  longestPageStay?: {
    route?: string;
    durationMs: number;
    eventId?: string;
  };
  outputModes: string[];
}

export interface SessionConsoleMetric {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'warn' | 'danger' | 'info';
}

export interface SessionProblemChip {
  kind: 'error' | 'business_failure' | 'failed_http' | 'slow_http' | 'slow_page' | 'jank' | 'memory' | 'sdk_drop' | 'sdk_retry' | 'sdk_flush_failure' | 'detail_dropped';
  label: string;
  count: number;
  eventId?: string;
  tone: 'danger' | 'warn' | 'info' | 'neutral';
}

export interface SessionConsoleSegment {
  id: string;
  kind: 'startup' | 'page' | 'activity' | 'sdk';
  title: string;
  route?: string;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  eventCount: number;
  issueCount: number;
  summaryItems: SessionConsoleMetric[];
  groupCounts: Partial<Record<SessionConsoleRow['group'], number>>;
  rows: string[];
}

export interface SessionConsoleRow {
  eventId?: string;
  timestamp?: string;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  signalType?: string;
  name?: string;
  phase?: string;
  status?: string;
  level?: string;
  priority?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  route?: string;
  module?: string;
  scene?: string;
  pageInstanceId?: string;
  pageActivePhase?: string;
  pageActiveTrigger?: string;
  group: 'startup' | 'page' | 'http' | 'interaction' | 'business' | 'problem' | 'performance' | 'lifecycle' | 'memory' | 'sdk' | 'event';
  title: string;
  /** @deprecated 改由前端按 group 渲染 metrics + badges；service 已不再写入。保留字段仅为兼容旧 client。 */
  subtitle?: string;
  badges: string[];
  issueLabels: string[];
  metrics: SessionConsoleMetric[];
  method?: string;
  url?: string;
  statusCode?: number;
  success?: boolean;
  errorType?: string;
  requestSizeBytes?: number;
  responseSizeBytes?: number;
  routeChanged?: boolean;
  completionRoute?: string;
  completionPageInstanceId?: string;
  hasHttpQuery?: boolean;
  hasRequestHeaders?: boolean;
  hasRequestBody?: boolean;
  hasResponseHeaders?: boolean;
  hasResponseBody?: boolean;
  bodyTruncated?: boolean;
  bodyOriginalLength?: number;
  detailDropped?: boolean;
}

export interface SessionSdkHealthSummary {
  flushCount: number;
  flushFailureCount: number;
  retryCount: number;
  dropCount: number;
  droppedEventCount: number;
  queueStateCount: number;
  configAppliedCount: number;
  latestQueueLength?: number;
  latestQueueBytes?: number;
  outputModes: string[];
  detailDroppedCount: number;
}

export interface SessionConsoleResult {
  sessionId: string;
  count: number;
  summary?: SessionConsoleSummary;
  problemChips: SessionProblemChip[];
  segments: SessionConsoleSegment[];
  rows: SessionConsoleRow[];
  httpRows: SessionConsoleRow[];
  sdkHealth: SessionSdkHealthSummary;
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

export interface SdkReliabilitySummary extends PerformanceMetricSummary {
  flushCount: number;
  flushFailureCount: number;
  retryCount: number;
  dropCount: number;
  droppedEventCount: number;
  queueStateCount: number;
  configAppliedCount: number;
  latestQueueLength?: number;
  latestQueueBytes?: number;
  dropReasonSummaries: MetricGroupSummary[];
  retryReasonSummaries: MetricGroupSummary[];
  flushReasonSummaries: MetricGroupSummary[];
  outputModeSummaries: MetricGroupSummary[];
}

export interface PerformanceOverview {
  startup: StartupPerformanceSummary;
  pages: PagePerformanceSummary;
  http: HttpPerformanceSummary;
  jank: JankPerformanceSummary;
  errors: ErrorPerformanceSummary;
  sdk: SdkReliabilitySummary;
}

export interface DimensionAppOption {
  appKey: string;
  appName?: string;
  packageName?: string;
  eventCount: number;
  lastTimestamp?: string;
}

export interface DimensionOption {
  value: string;
  count: number;
  lastTimestamp?: string;
}

export interface DimensionSummary {
  apps: DimensionAppOption[];
  appNames: DimensionOption[];
  packageNames: DimensionOption[];
  environments: DimensionOption[];
  appVersions: DimensionOption[];
  buildNumbers: DimensionOption[];
  channels: DimensionOption[];
  flavors: DimensionOption[];
  devicePlatforms: DimensionOption[];
  deviceModels: DimensionOption[];
  deviceTiers: DimensionOption[];
  osVersions: DimensionOption[];
  nativePlatforms: DimensionOption[];
  routes: DimensionOption[];
  statuses: DimensionOption[];
  names: DimensionOption[];
  signalTypes: DimensionOption[];
  userIds: DimensionOption[];
  sessionIds: DimensionOption[];
  requestIds: DimensionOption[];
}

export type TimeseriesBucket = 'hour' | 'day';

export interface FailureTimeseriesPoint {
  from: string;
  to: string;
  httpTotal: number;
  failedHttp: number;
  errors: number;
  businessFailures: number;
  businessSuccess: number;
  businessCancelled: number;
  coldStartCount: number;
  coldStartTotalMs: number;
  coldStartSlowCount: number;
  startupEventId?: string;
  startupSessionId?: string;
}

export interface FailureTimeseries {
  from: string;
  to: string;
  bucket: TimeseriesBucket;
  points: FailureTimeseriesPoint[];
}

export interface BusinessActionSummaryItem {
  action: string;
  total: number;
  failed: number;
  eventId?: string;
  sessionId?: string;
}

export interface BusinessActionSummary {
  items: BusinessActionSummaryItem[];
}
