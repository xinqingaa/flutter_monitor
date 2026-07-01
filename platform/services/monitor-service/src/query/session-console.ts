import type {
  MonitorEvent,
  SessionConsoleMetric,
  SessionConsoleResult,
  SessionConsoleRow,
  SessionConsoleSegment,
  SessionConsoleSummary,
  SessionProblemChip,
  SessionSdkHealthSummary,
} from '../store/event-types';
import {
  appKeyOf,
  appNameOf,
  appVersionOf,
  buildNumberOf,
  channelOf,
  deviceManufacturerOf,
  deviceModelOf,
  devicePlatformOf,
  deviceTierOf,
  environmentOf,
  flavorOf,
  isBusinessFailureEvent,
  isCompletedHttpEvent,
  isErrorEvent,
  isFailedHttpEvent,
  isJankEvent,
  nativeAvailableOf,
  nativePlatformOf,
  nativeVersionOf,
  osVersionOf,
  packageNameOf,
  routeOf,
  statusOf,
  userIdOf,
} from '../store/event-accessors';

type RecordValue = Record<string, unknown>;

interface MutableSegment {
  kind: SessionConsoleSegment['kind'];
  route?: string;
  rows: SessionConsoleRow[];
  startValue: number;
}

const SLOW_HTTP_MS = 1000;
const SLOW_PAGE_MS = 1000;

export function buildSessionConsole(sessionId: string, inputEvents: MonitorEvent[]): SessionConsoleResult {
  const events = sortEvents(inputEvents);
  const rows = events.map(toConsoleRow);
  const sdkHealth = buildSdkHealth(events);
  const summary = buildConsoleSummary(sessionId, events, rows, sdkHealth);
  const segments = buildSegments(rows);

  return {
    sessionId,
    count: rows.length,
    summary,
    problemChips: buildProblemChips(rows, sdkHealth),
    segments,
    rows,
    httpRows: rows.filter((row) => row.group === 'http'),
    sdkHealth,
  };
}

function toConsoleRow(event: MonitorEvent): SessionConsoleRow {
  const http = httpInfo(event);
  const route = routeOf(event);
  const module = stringPath(event, ['context', 'module', 'name']);
  const scene = stringPath(event, ['context', 'scene', 'name']);
  const phase = stringPath(event, ['attributes', 'event.phase']);
  const pageInstanceId = stringPath(event, ['attributes', 'page.instance_id']) ?? stringPath(event, ['payload', 'page.instance_id']);
  const pageActivePhase = stringPath(event, ['attributes', 'page.active_phase']) ?? stringPath(event, ['payload', 'page.active_phase']);
  const pageActiveTrigger = stringPath(event, ['attributes', 'page.active_trigger']) ?? stringPath(event, ['payload', 'page.active_trigger']);
  const issueLabels = rowIssueLabels(event, http);
  const group = rowGroup(event, issueLabels);
  const title = rowTitle(event, http);
  const badges = rowBadges(event, http);
  const metrics = rowMetrics(event, http, group);

  return {
    eventId: event.eventId,
    timestamp: event.timestamp,
    startTime: event.startTime,
    endTime: event.endTime,
    durationMs: event.durationMs,
    signalType: event.signalType,
    name: event.name,
    phase,
    status: event.status,
    level: event.level,
    priority: event.priority,
    traceId: event.traceId,
    spanId: event.spanId,
    parentSpanId: event.parentSpanId,
    route,
    module,
    scene,
    pageInstanceId,
    pageActivePhase,
    pageActiveTrigger,
    group,
    title,
    badges,
    issueLabels,
    metrics,
    ...http,
  };
}

function rowGroup(event: MonitorEvent, issueLabels: string[]): SessionConsoleRow['group'] {
  const name = event.name ?? '';
  if (name === 'http.client') return 'http';
  if (name === 'app.cold_start' || name === 'sdk.init') return 'startup';
  if (event.signalType === 'sdk' || name.startsWith('sdk.')) return 'sdk';
  if (isMemoryEvent(event)) return 'memory';
  if (name.includes('lifecycle') || name === 'app.background_duration' || name === 'app.hot_start') return 'lifecycle';
  if (name === 'interaction.measure' || readPath(event, ['attributes', 'interaction.mode']) !== undefined) return 'interaction';
  if (readPath(event, ['attributes', 'business.action']) !== undefined || name.startsWith('business.')) return 'business';
  if (name.startsWith('page.') || name === 'route.push' || name === 'route.pop') return 'page';
  if (isJankEvent(event)) return 'problem';
  if (issueLabels.length > 0 || isErrorEvent(event)) return 'problem';
  if (event.signalType === 'metric' || typeof event.durationMs === 'number') return 'performance';
  return 'event';
}

function rowMetrics(
  event: MonitorEvent,
  http: Partial<SessionConsoleRow>,
  group: SessionConsoleRow['group'],
): SessionConsoleMetric[] {
  if (group === 'http') return httpMetrics(event, http);
  if (group === 'startup') return startupMetrics(event);
  if (group === 'page') return pageMetrics(event);
  if (group === 'interaction') return interactionMetrics(event);
  if (group === 'business') return businessMetrics(event);
  if (group === 'memory') return memoryMetrics(event);
  if (event.name === 'app.hot_start') return hotStartMetrics(event);
  if (group === 'lifecycle') return lifecycleMetrics(event);
  if (group === 'sdk') return sdkMetrics(event);
  if (group === 'problem') return problemMetrics(event);
  return commonMetrics(event);
}

function httpMetrics(event: MonitorEvent, http: Partial<SessionConsoleRow>): SessionConsoleMetric[] {
  const metrics: SessionConsoleMetric[] = [];
  pushMetric(metrics, '状态', typeof http.statusCode === 'number' ? String(http.statusCode) : http.errorType, http.success === false ? 'danger' : 'good');
  pushMetric(metrics, '耗时', durationLabel(event.durationMs), event.durationMs !== undefined && event.durationMs >= SLOW_HTTP_MS ? 'warn' : 'neutral');
  pushMetric(metrics, '响应', byteLabel(http.responseSizeBytes));
  pushMetric(metrics, '请求', byteLabel(http.requestSizeBytes));
  pushMetric(
    metrics,
    '来源',
    stringPath(event, ['attributes', 'http.source']) ??
      stringPath(event, ['payload', 'http.source']) ??
      stringPath(event, ['payload', 'source']),
  );
  pushMetric(metrics, '响应页', http.routeChanged ? http.completionRoute : undefined, 'info');
  const evidence = [
    http.hasRequestHeaders ? 'Req headers' : undefined,
    http.hasRequestBody ? 'Req body' : undefined,
    http.hasResponseHeaders ? 'Res headers' : undefined,
    http.hasResponseBody ? 'Res body' : undefined,
    http.hasHttpQuery ? 'Query' : undefined,
    http.bodyTruncated ? 'body truncated' : undefined,
    http.detailDropped ? 'detail dropped' : undefined,
  ].filter(Boolean).join(' / ');
  pushMetric(metrics, '证据', evidence, http.detailDropped ? 'warn' : 'info');
  return metrics;
}

function startupMetrics(event: MonitorEvent): SessionConsoleMetric[] {
  const metrics: SessionConsoleMetric[] = [];
  pushMetric(metrics, '耗时', durationLabel(event.durationMs));
  pushMetric(metrics, '首帧', durationLabel(numberPath(event, ['attributes', 'app.first_frame_ms']) ?? numberPath(event, ['attributes', 'page.first_frame_ms'])));
  pushMetric(metrics, '可交互', durationLabel(numberPath(event, ['attributes', 'app.interactive_ms']) ?? numberPath(event, ['attributes', 'app.time_to_interactive_ms'])));
  pushMetric(metrics, 'SDK 初始化', event.name === 'sdk.init' ? durationLabel(event.durationMs) : durationLabel(numberPath(event, ['attributes', 'sdk.init.duration_ms'])));
  pushMetric(metrics, '启动类型', stringPath(event, ['attributes', 'app.start.type']));
  pushMetric(metrics, '结束口径', stringPath(event, ['attributes', 'app.start.end_reason']));
  pushMetric(metrics, 'RSS', memoryDeltaLabel(event));
  return metrics;
}

function pageMetrics(event: MonitorEvent): SessionConsoleMetric[] {
  const metrics: SessionConsoleMetric[] = [];
  pushMetric(metrics, '阶段', stringPath(event, ['attributes', 'event.phase']));
  pushMetric(metrics, '耗时', durationLabel(event.durationMs));
  pushMetric(metrics, '加载', durationLabel(numberPath(event, ['attributes', 'page.load_ms'])));
  pushMetric(metrics, '首帧', durationLabel(numberPath(event, ['attributes', 'page.first_frame_ms'])));
  pushMetric(metrics, '停留', event.name === 'page.stay' ? durationLabel(event.durationMs) : undefined);
  pushMetric(metrics, '帧', frameLabel(event), frameTone(event));
  pushMetric(metrics, 'RSS', memoryDeltaLabel(event));
  pushMetric(metrics, '去向', stringPath(event, ['attributes', 'page.to']) ?? stringPath(event, ['payload', 'page.to']));
  return metrics;
}

function interactionMetrics(event: MonitorEvent): SessionConsoleMetric[] {
  const metrics: SessionConsoleMetric[] = [];
  pushMetric(metrics, '动作', stringPath(event, ['attributes', 'business.action']));
  pushMetric(metrics, '模式', stringPath(event, ['attributes', 'interaction.mode']));
  pushMetric(metrics, '活跃', durationLabel(numberPath(event, ['attributes', 'interaction.active_ms'])));
  pushMetric(metrics, '稳定', durationLabel(numberPath(event, ['attributes', 'interaction.settle_ms'])));
  pushMetric(metrics, '耗时', durationLabel(event.durationMs));
  pushMetric(metrics, '帧', frameLabel(event), frameTone(event));
  return metrics;
}

function businessMetrics(event: MonitorEvent): SessionConsoleMetric[] {
  const metrics: SessionConsoleMetric[] = [];
  pushMetric(metrics, '动作', stringPath(event, ['attributes', 'business.action']));
  pushMetric(metrics, '状态', event.status, event.status === 'error' ? 'danger' : 'neutral');
  pushMetric(metrics, '耗时', durationLabel(event.durationMs));
  pushMetric(metrics, '结果', stringPath(event, ['attributes', 'business.result']) ?? stringPath(event, ['payload', 'result']));
  return metrics;
}

function memoryMetrics(event: MonitorEvent): SessionConsoleMetric[] {
  const metrics: SessionConsoleMetric[] = [];
  pushMetric(metrics, 'RSS', mbLabel(numberPath(event, ['attributes', 'memory.rss_mb']) ?? numberPath(event, ['attributes', 'memory.current_rss_mb'])));
  pushMetric(metrics, '增长', mbDeltaLabel(numberPath(event, ['attributes', 'memory.growth_mb'])), 'warn');
  pushMetric(metrics, '压力', stringPath(event, ['attributes', 'memory.pressure_level']) ?? stringPath(event, ['attributes', 'native.memory.pressure_level']), isMemoryProblem(event) ? 'warn' : 'neutral');
  pushMetric(metrics, 'native used', mbLabel(numberPath(event, ['attributes', 'native.memory.used_mb']) ?? numberPath(event, ['attributes', 'memory.native_used_mb'])));
  pushMetric(metrics, '来源', stringPath(event, ['attributes', 'memory.sample_source']) ?? stringPath(event, ['payload', 'source']));
  return metrics;
}

function lifecycleMetrics(event: MonitorEvent): SessionConsoleMetric[] {
  const metrics: SessionConsoleMetric[] = [];
  pushMetric(metrics, '状态', stringPath(event, ['attributes', 'context.lifecycle.state']) ?? stringPath(event, ['context', 'lifecycle', 'state']));
  pushMetric(metrics, '前一状态', stringPath(event, ['attributes', 'context.lifecycle.previousState']) ?? stringPath(event, ['context', 'lifecycle', 'previousState']));
  const backgroundMs = numberPath(event, ['attributes', 'app.background_duration.duration_ms']) ??
    (event.name === 'app.background_duration' ? event.durationMs : undefined);
  pushMetric(metrics, '后台', durationLabel(backgroundMs));
  pushMetric(metrics, '前台', booleanPath(event, ['attributes', 'context.lifecycle.isForeground']) === undefined ? undefined : String(booleanPath(event, ['attributes', 'context.lifecycle.isForeground'])));
  return metrics;
}

function hotStartMetrics(event: MonitorEvent): SessionConsoleMetric[] {
  const metrics: SessionConsoleMetric[] = [];
  pushMetric(metrics, '热重启', durationLabel(event.durationMs));
  pushMetric(metrics, '首帧', durationLabel(numberPath(event, ['attributes', 'app.first_frame_ms'])));
  pushMetric(metrics, '可交互', durationLabel(numberPath(event, ['attributes', 'app.interactive_ms']) ?? numberPath(event, ['attributes', 'app.time_to_interactive_ms'])));
  pushMetric(metrics, '结束口径', stringPath(event, ['attributes', 'app.start.end_reason']));
  pushMetric(metrics, 'RSS', memoryDeltaLabel(event));
  return metrics;
}

function sdkMetrics(event: MonitorEvent): SessionConsoleMetric[] {
  const metrics: SessionConsoleMetric[] = [];
  pushMetric(metrics, '模式', stringPath(event, ['attributes', 'sdk.output.mode']) ?? stringPath(event, ['payload', 'output_mode']));
  pushMetric(metrics, '队列', queueLabel(event));
  pushMetric(metrics, '重试', retryLabel(event), event.name === 'sdk.retry.schedule' ? 'warn' : 'neutral');
  pushMetric(metrics, '丢弃', dropLabel(event), event.name === 'sdk.queue.drop' ? 'danger' : 'neutral');
  pushMetric(metrics, 'flush', flushLabel(event), isSdkFlushFailure(event) ? 'danger' : 'neutral');
  pushMetric(metrics, 'batch', numberLabel(numberPath(event, ['attributes', 'sdk.batch.size'])));
  return metrics;
}

function problemMetrics(event: MonitorEvent): SessionConsoleMetric[] {
  const metrics: SessionConsoleMetric[] = [];
  pushMetric(metrics, '状态', event.status, event.status === 'error' ? 'danger' : 'warn');
  pushMetric(metrics, '耗时', durationLabel(event.durationMs));
  pushMetric(metrics, '错误类型', stringPath(event, ['attributes', 'error.type']) ?? stringPath(event, ['payload', 'error_type']));
  pushMetric(metrics, '机制', stringPath(event, ['attributes', 'error.mechanism']) ?? stringPath(event, ['payload', 'mechanism']));
  pushMetric(metrics, '帧', frameLabel(event), frameTone(event));
  return metrics;
}

function commonMetrics(event: MonitorEvent): SessionConsoleMetric[] {
  const metrics: SessionConsoleMetric[] = [];
  pushMetric(metrics, '阶段', stringPath(event, ['attributes', 'event.phase']));
  pushMetric(metrics, '状态', event.status);
  pushMetric(metrics, '耗时', durationLabel(event.durationMs));
  return metrics;
}

function rowTitle(event: MonitorEvent, http: Partial<SessionConsoleRow>): string {
  const name = event.name ?? 'event';
  if (name === 'http.client') {
    return [http.method, http.url].filter(Boolean).join(' ') || 'HTTP 请求';
  }
  if (name === 'app.cold_start') return '冷启动';
  if (name === 'app.hot_start') return '热重启';
  if (name === 'sdk.init') return 'SDK 初始化';
  if (name === 'page.visit') {
    const phase = stringPath(event, ['attributes', 'event.phase']);
    const route = routeOf(event);
    return phase === 'end' ? `离开页面 ${route ?? ''}`.trim() : `进入页面 ${route ?? ''}`.trim();
  }
  if (name === 'page.view') return `页面访问 ${routeOf(event) ?? ''}`.trim();
  if (name === 'page.load') return `页面加载 ${routeOf(event) ?? ''}`.trim();
  if (name === 'page.stay') return `页面停留 ${routeOf(event) ?? ''}`.trim();
  if (name === 'route.push') return '路由进入';
  if (name === 'route.pop') return '路由返回';
  if (name === 'interaction.measure') {
    const action = stringPath(event, ['attributes', 'business.action']);
    return action ? `交互性能 ${action}` : '交互性能';
  }
  const businessAction = stringPath(event, ['attributes', 'business.action']);
  if (businessAction) return `业务操作 ${businessAction}`;
  if (name === 'ui.jank.sequence') return '连续卡顿';
  if (name === 'memory.pressure' || name === 'native.memory.pressure') return '内存压力';
  if (name === 'memory.growth') return '内存增长';
  if (name === 'memory.leak.suspect') return '疑似泄漏线索';
  return name;
}

function rowBadges(event: MonitorEvent, http: Partial<SessionConsoleRow>): string[] {
  const badges = new Set<string>();
  if (event.signalType) badges.add(event.signalType);
  if (event.status) badges.add(event.status);
  if (event.priority) badges.add(event.priority);
  if (event.name === 'http.client') {
    if (http.method) badges.add(http.method);
    if (typeof http.statusCode === 'number') badges.add(String(http.statusCode));
    if (http.detailDropped) badges.add('detail dropped');
    if (http.bodyTruncated) badges.add('body truncated');
  }
  return [...badges].slice(0, 5);
}

function rowIssueLabels(event: MonitorEvent, http: Partial<SessionConsoleRow>): string[] {
  const labels: string[] = [];
  if (isFailedHttpEvent(event)) labels.push('请求失败');
  if (event.name === 'http.client' && typeof event.durationMs === 'number' && event.durationMs >= SLOW_HTTP_MS) labels.push('慢请求');
  if (isBusinessFailureEvent(event)) labels.push('业务失败');
  if (isNonHttpStabilityError(event)) labels.push('错误');
  if (isJankEvent(event)) labels.push('卡顿');
  if (isSlowPage(event)) labels.push('页面慢');
  if (isMemoryProblem(event)) labels.push(memoryLabel(event));
  if (event.name === 'sdk.queue.drop') labels.push('SDK 丢弃');
  if (event.name === 'sdk.retry.schedule') labels.push('SDK 重试');
  if (isSdkFlushFailure(event)) labels.push('SDK 发送失败');
  if (event.name === 'sdk.health.report') {
    if ((numberPath(event, ['attributes', 'sdk.health.dropped_count']) ?? 0) > 0) labels.push('SDK 丢弃');
    if ((numberPath(event, ['attributes', 'sdk.health.retry_count']) ?? 0) > 0) labels.push('SDK 重试');
    if ((numberPath(event, ['attributes', 'sdk.health.flush_failure_count']) ?? 0) > 0) labels.push('SDK 发送失败');
  }
  if (http.detailDropped) labels.push('HTTP 详情剥离');
  return [...new Set(labels)];
}

function httpInfo(event: MonitorEvent): Partial<SessionConsoleRow> {
  if (!isCompletedHttpEvent(event) && event.name !== 'http.client') return {};

  const detail = recordValue(readPath(event, ['payload', 'http.detail']));
  const request = recordValue(detail?.request);
  const response = recordValue(detail?.response);
  const requestHeaders = recordValue(request?.headers);
  const responseHeaders = recordValue(response?.headers);
  const requestBody = request?.body;
  const responseBody = response?.body;
  const query = readPath(event, ['payload', 'http.query']);
  const method = stringPath(event, ['attributes', 'http.method']);
  const url = stringPath(event, ['payload', 'url']) ?? stringPath(event, ['attributes', 'http.url.normalized']);
  const statusCode = numberPath(event, ['attributes', 'http.status_code']);
  const routeChanged = booleanPath(event, ['attributes', 'http.route_changed']);
  const completionRoute =
    stringPath(event, ['attributes', 'http.completion.route.full_name']) ??
    stringPath(event, ['attributes', 'http.completion.route.name']);

  return {
    method,
    url,
    statusCode,
    success: booleanPath(event, ['attributes', 'http.success']),
    errorType: stringPath(event, ['attributes', 'http.error_type']) ?? stringPath(event, ['payload', 'error_type']),
    requestSizeBytes: numberPath(event, ['attributes', 'http.request_content_length']) ?? numberPath(event, ['attributes', 'http.request.size_bytes']),
    responseSizeBytes: numberPath(event, ['attributes', 'http.response_content_length']) ?? numberPath(event, ['attributes', 'http.response.size_bytes']),
    routeChanged,
    completionRoute,
    completionPageInstanceId: stringPath(event, [
      'attributes',
      'http.completion.page_instance_id',
    ]),
    hasHttpQuery: isNonEmptyValue(query),
    hasRequestHeaders: requestHeaders !== undefined && Object.keys(requestHeaders).length > 0,
    hasRequestBody: isNonEmptyValue(requestBody),
    hasResponseHeaders: responseHeaders !== undefined && Object.keys(responseHeaders).length > 0,
    hasResponseBody: isNonEmptyValue(responseBody),
    bodyTruncated: booleanPath(event, ['payload', 'body_truncated']) ?? booleanPath(event, ['payload', 'http.body_truncated']),
    bodyOriginalLength: numberPath(event, ['payload', 'body_original_length']) ?? numberPath(event, ['payload', 'http.body_original_length']),
    detailDropped: booleanPath(event, ['payload', 'http.detail_dropped']),
  };
}

function buildConsoleSummary(
  sessionId: string,
  events: MonitorEvent[],
  rows: SessionConsoleRow[],
  sdkHealth: SessionSdkHealthSummary,
): SessionConsoleSummary | undefined {
  if (events.length === 0) return undefined;
  const first = events[0];
  const last = events[events.length - 1];
  const routes = rows.map((row) => row.route).filter((route): route is string => Boolean(route));
  const uniqueRoutes = [...new Set(routes)];
  const firstWithUser = events.find((event) => Boolean(userIdOf(event)));
  const firstWithApp = events.find((event) => Boolean(appKeyOf(event) || appNameOf(event) || appVersionOf(event) || environmentOf(event)));
  const firstWithDevice = events.find((event) => Boolean(devicePlatformOf(event) || deviceModelOf(event) || deviceTierOf(event) || osVersionOf(event)));
  const firstNativeAvailable = events.find((event) => nativeAvailableOf(event) === true);
  const firstNativeVersion = events.find((event) => Boolean(nativeVersionOf(event)));
  const firstNativePlatform = events.find((event) => Boolean(nativePlatformOf(event)));
  const status = events.some(isNonHttpStabilityError)
    ? 'error'
    : rows.some((row) => row.issueLabels.length > 0)
      ? 'warning'
      : [...events].reverse().map(statusOf).find(Boolean);
  const durationMs = timestampDiff(first?.timestamp ?? first?.startTime, last?.timestamp ?? last?.endTime);
  const pageStays = events
    .filter((event) => event.name === 'page.stay' && typeof event.durationMs === 'number')
    .map((event) => ({ route: routeOf(event), durationMs: event.durationMs as number, eventId: event.eventId }))
    .sort((a, b) => b.durationMs - a.durationMs);

  return {
    sessionId,
    count: events.length,
    firstTimestamp: first?.timestamp,
    lastTimestamp: last?.timestamp,
    firstEventId: first?.eventId,
    lastEventId: last?.eventId,
    appKey: firstWithApp ? appKeyOf(firstWithApp) : undefined,
    appName: firstWithApp ? appNameOf(firstWithApp) : undefined,
    packageName: firstWithApp ? packageNameOf(firstWithApp) : undefined,
    buildNumber: firstWithApp ? buildNumberOf(firstWithApp) : undefined,
    channel: firstWithApp ? channelOf(firstWithApp) : undefined,
    flavor: firstWithApp ? flavorOf(firstWithApp) : undefined,
    userId: firstWithUser ? userIdOf(firstWithUser) : undefined,
    appVersion: firstWithApp ? appVersionOf(firstWithApp) : undefined,
    environment: firstWithApp ? environmentOf(firstWithApp) : undefined,
    devicePlatform: firstWithDevice ? devicePlatformOf(firstWithDevice) : undefined,
    deviceModel: firstWithDevice ? deviceModelOf(firstWithDevice) : undefined,
    deviceManufacturer: firstWithDevice ? deviceManufacturerOf(firstWithDevice) : undefined,
    deviceTier: firstWithDevice ? deviceTierOf(firstWithDevice) : undefined,
    osVersion: firstWithDevice ? osVersionOf(firstWithDevice) : undefined,
    route: routes.at(-1),
    status,
    nativeAvailable: firstNativeAvailable ? true : undefined,
    nativeVersion: firstNativeVersion ? nativeVersionOf(firstNativeVersion) : undefined,
    nativePlatform: firstNativePlatform ? nativePlatformOf(firstNativePlatform) : undefined,
    errorCount: events.filter(isNonHttpStabilityError).length,
    jankCount: events.filter(isJankEvent).length,
    failedHttpCount: events.filter(isFailedHttpEvent).length,
    businessFailureCount: events.filter(isBusinessFailureEvent).length,
    durationMs,
    slowHttpCount: rows.filter((row) => row.group === 'http' && typeof row.durationMs === 'number' && row.durationMs >= SLOW_HTTP_MS).length,
    slowPageCount: events.filter(isSlowPage).length,
    sdkDroppedCount: sdkHealth.droppedEventCount,
    sdkRetryCount: sdkHealth.retryCount,
    sdkFlushFailureCount: sdkHealth.flushFailureCount,
    latestQueueLength: sdkHealth.latestQueueLength,
    latestQueueBytes: sdkHealth.latestQueueBytes,
    detailDroppedCount: sdkHealth.detailDroppedCount,
    httpCount: rows.filter((row) => row.group === 'http').length,
    interactionEventCount: rows.filter((row) => row.group === 'interaction').length,
    businessEventCount: rows.filter((row) => row.group === 'business').length,
    memoryEventCount: rows.filter((row) => row.group === 'memory').length,
    lifecycleEventCount: rows.filter((row) => row.group === 'lifecycle').length,
    pageCount: rows.filter((row) => row.group === 'page').length,
    routeCount: uniqueRoutes.length,
    firstRoute: routes[0],
    lastRoute: routes.at(-1),
    longestPageStay: pageStays[0],
    outputModes: sdkHealth.outputModes,
  };
}

function buildProblemChips(rows: SessionConsoleRow[], sdkHealth: SessionSdkHealthSummary): SessionProblemChip[] {
  const chips: SessionProblemChip[] = [];
  pushChip(chips, rows, 'error', '错误', 'danger', (row) => row.issueLabels.includes('错误'));
  pushChip(chips, rows, 'business_failure', '业务失败', 'warn', (row) => row.issueLabels.includes('业务失败'));
  pushChip(chips, rows, 'failed_http', '失败 HTTP', 'danger', (row) => row.issueLabels.includes('请求失败'));
  pushChip(chips, rows, 'slow_http', '慢 HTTP', 'warn', (row) => row.issueLabels.includes('慢请求'));
  pushChip(chips, rows, 'slow_page', '慢页面', 'warn', (row) => row.issueLabels.includes('页面慢'));
  pushChip(chips, rows, 'jank', '卡顿', 'warn', (row) => row.issueLabels.includes('卡顿'));
  pushChip(chips, rows, 'memory', '内存', 'warn', (row) => row.group === 'memory' && row.issueLabels.length > 0);
  if (sdkHealth.droppedEventCount > 0) chips.push({ kind: 'sdk_drop', label: 'SDK 丢弃', count: sdkHealth.droppedEventCount, eventId: rows.find((row) => row.issueLabels.includes('SDK 丢弃'))?.eventId, tone: 'danger' });
  if (sdkHealth.retryCount > 0) chips.push({ kind: 'sdk_retry', label: 'SDK 重试', count: sdkHealth.retryCount, eventId: rows.find((row) => row.issueLabels.includes('SDK 重试'))?.eventId, tone: 'warn' });
  if (sdkHealth.flushFailureCount > 0) chips.push({ kind: 'sdk_flush_failure', label: 'SDK 发送失败', count: sdkHealth.flushFailureCount, eventId: rows.find((row) => row.issueLabels.includes('SDK 发送失败'))?.eventId, tone: 'danger' });
  if (sdkHealth.detailDroppedCount > 0) chips.push({ kind: 'detail_dropped', label: 'HTTP 详情剥离', count: sdkHealth.detailDroppedCount, eventId: rows.find((row) => row.detailDropped)?.eventId, tone: 'warn' });
  return chips;
}

function pushChip(
  chips: SessionProblemChip[],
  rows: SessionConsoleRow[],
  kind: SessionProblemChip['kind'],
  label: string,
  tone: SessionProblemChip['tone'],
  predicate: (row: SessionConsoleRow) => boolean,
): void {
  const matches = rows.filter(predicate);
  if (matches.length > 0) chips.push({ kind, label, count: matches.length, eventId: matches[0]?.eventId, tone });
}

function buildSegments(rows: SessionConsoleRow[]): SessionConsoleSegment[] {
  const mutable: MutableSegment[] = [];
  let current: MutableSegment | undefined;

  for (const row of rows) {
    const route = row.route;
    const rowStartsPage = isPageEntryRow(row);
    const desiredKind = segmentKindForRow(row, current);
    const entryContinuesCurrentPage = rowStartsPage && continuesCurrentPageEntry(row, current);
    const shouldStart = !current ||
      (rowStartsPage && !entryContinuesCurrentPage) ||
      desiredKind !== current.kind ||
      (desiredKind === 'page' && route !== undefined && current.route !== undefined && route !== current.route) ||
      (desiredKind === 'activity' && route !== undefined && current.route !== undefined && route !== current.route);

    if (shouldStart) {
      current = {
        kind: desiredKind,
        route,
        rows: [],
        startValue: timeValue(row.startTime ?? row.timestamp),
      };
      mutable.push(current);
    }
    const active = current;
    if (!active) continue;
    active.rows.push(row);
    if (!active.route && route) active.route = route;
  }

  return mutable.map((segment, index) => finalizeSegment(segment, index, mutable[index + 1]));
}

function segmentKindForRow(row: SessionConsoleRow, current: MutableSegment | undefined): SessionConsoleSegment['kind'] {
  if (row.group === 'startup') return 'startup';
  if (row.group === 'sdk') {
    if (!isSdkDiagnosticRow(row)) {
      return current?.kind ?? (row.route ? 'page' : 'activity');
    }
    if (current && (current.kind === 'page' || current.kind === 'activity') && rowBelongsToSegmentRoute(row, current)) {
      return current.kind;
    }
    return 'sdk';
  }
  if (row.group === 'page' && (isPageEntryRow(row) || current?.kind === 'page')) return 'page';
  if (row.route) return 'page';
  return 'activity';
}

function isSdkDiagnosticRow(row: SessionConsoleRow): boolean {
  if (row.group !== 'sdk') return false;
  if (row.issueLabels.some((label) => label.startsWith('SDK '))) return true;
  return row.name === 'sdk.queue.state' || row.name === 'sdk.retry.schedule' || row.name === 'sdk.queue.drop' || row.name === 'sdk.output.flush';
}

function rowBelongsToSegmentRoute(row: SessionConsoleRow, segment: MutableSegment): boolean {
  return !row.route || !segment.route || row.route === segment.route;
}

function continuesCurrentPageEntry(row: SessionConsoleRow, current: MutableSegment | undefined): boolean {
  if (!current || current.kind !== 'page') return false;
  if (!row.route || current.route !== row.route) return false;
  const rowTime = timeValue(row.startTime ?? row.timestamp);
  return Math.abs(rowTime - current.startValue) <= 100;
}

function finalizeSegment(segment: MutableSegment, index: number, next: MutableSegment | undefined): SessionConsoleSegment {
  const first = segment.rows[0];
  const last = segment.rows.at(-1);
  const explicitDuration = maxNumber(segment.rows.map((row) => row.name === 'page.stay' || (segment.kind === 'startup' && (row.name === 'app.cold_start' || row.name === 'app.hot_start')) ? row.durationMs : undefined));
  const durationMs = explicitDuration ?? (next?.startValue !== undefined && next.startValue >= segment.startValue ? next.startValue - segment.startValue : timestampDiff(first?.timestamp ?? first?.startTime, last?.timestamp ?? last?.endTime));
  const issueCount = segment.rows.filter((row) => row.issueLabels.length > 0).length;
  const groupCounts = buildGroupCounts(segment.rows);
  return {
    id: `${index}-${first?.eventId ?? 'segment'}`,
    kind: segment.kind,
    title: segmentTitle(segment, issueCount),
    route: segment.route,
    startTime: first?.startTime ?? first?.timestamp,
    endTime: last?.endTime ?? last?.timestamp,
    durationMs,
    eventCount: segment.rows.length,
    issueCount,
    summaryItems: segmentSummaryItems(segment.rows, durationMs, issueCount, groupCounts),
    groupCounts,
    rows: segment.rows.map((row) => row.eventId).filter((eventId): eventId is string => Boolean(eventId)),
  };
}

function segmentTitle(segment: MutableSegment, issueCount: number): string {
  if (segment.kind === 'startup') return '启动链路';
  if (segment.kind === 'sdk') return segment.route ? `SDK 诊断 · ${segment.route}` : 'SDK 诊断';
  if (segment.kind === 'page') {
    const labels = segment.rows.flatMap((row) => row.issueLabels).filter((label) => label !== '页面慢');
    const suffix = [...new Set(labels)].slice(0, 2).join(' · ');
    return [segment.route ? `页面 ${segment.route}` : '页面活动', suffix].filter(Boolean).join(' · ');
  }
  return issueCount > 0 ? '会话活动 · 有问题' : '会话活动';
}

function buildGroupCounts(rows: SessionConsoleRow[]): Partial<Record<SessionConsoleRow['group'], number>> {
  const counts: Partial<Record<SessionConsoleRow['group'], number>> = {};
  for (const row of rows) {
    counts[row.group] = (counts[row.group] ?? 0) + 1;
  }
  return counts;
}

function segmentSummaryItems(
  rows: SessionConsoleRow[],
  durationMs: number | undefined,
  issueCount: number,
  groupCounts: Partial<Record<SessionConsoleRow['group'], number>>,
): SessionConsoleMetric[] {
  const metrics: SessionConsoleMetric[] = [];
  pushMetric(metrics, '耗时', durationLabel(durationMs));
  pushMetric(metrics, '事件', String(rows.length));
  pushMetric(metrics, '问题', issueCount > 0 ? String(issueCount) : undefined, issueCount > 0 ? 'warn' : 'neutral');
  pushMetric(metrics, 'HTTP', countLabel(groupCounts.http));
  pushMetric(metrics, '交互', countLabel(groupCounts.interaction));
  pushMetric(metrics, '埋点', countLabel(groupCounts.business));
  pushMetric(metrics, '内存', countLabel(groupCounts.memory));
  pushMetric(metrics, 'SDK', countLabel(groupCounts.sdk));
  return metrics;
}

function pushMetric(
  metrics: SessionConsoleMetric[],
  label: string,
  value: string | undefined,
  tone: SessionConsoleMetric['tone'] = 'neutral',
): void {
  if (value === undefined || value === '' || value === '-') return;
  metrics.push({ label, value, tone });
}

function countLabel(value: number | undefined): string | undefined {
  return value && value > 0 ? String(value) : undefined;
}

function numberLabel(value: number | undefined): string | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined;
}

function durationLabel(value: number | undefined): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)}s`;
  return `${Math.round(value)}ms`;
}

function byteLabel(value: number | undefined): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)}MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)}KB`;
  return `${Math.round(value)}B`;
}

function mbLabel(value: number | undefined): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return `${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}MB`;
}

function mbDeltaLabel(value: number | undefined): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}MB`;
}

function memoryDeltaLabel(event: MonitorEvent): string | undefined {
  const delta = numberPath(event, ['attributes', 'memory.delta_rss_mb']) ??
    numberPath(event, ['attributes', 'memory.delta_mb']) ??
    numberPath(event, ['attributes', 'memory.growth_mb']);
  if (delta !== undefined) return mbDeltaLabel(delta);

  const start = numberPath(event, ['attributes', 'memory.start_rss_mb']) ??
    numberPath(event, ['attributes', 'memory.enter_rss_mb']);
  const end = numberPath(event, ['attributes', 'memory.end_rss_mb']) ??
    numberPath(event, ['attributes', 'memory.exit_rss_mb']);
  if (start !== undefined && end !== undefined) return `${mbLabel(start)} -> ${mbLabel(end)}`;
  return mbLabel(end ?? start);
}

function frameLabel(event: MonitorEvent): string | undefined {
  const slow = numberPath(event, ['attributes', 'frame.slow_count']);
  const sample = numberPath(event, ['attributes', 'frame.sample_count']);
  const max = numberPath(event, ['attributes', 'frame.max_ms']);
  const fps = numberPath(event, ['attributes', 'frame.fps']);
  const parts = [
    slow !== undefined ? `slow ${slow}${sample !== undefined ? `/${sample}` : ''}` : undefined,
    max !== undefined ? `max ${Math.round(max)}ms` : undefined,
    fps !== undefined ? `${Math.round(fps)}fps` : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : undefined;
}

function frameTone(event: MonitorEvent): SessionConsoleMetric['tone'] {
  const slow = numberPath(event, ['attributes', 'frame.slow_count']);
  return slow !== undefined && slow > 0 ? 'warn' : 'neutral';
}

function queueLabel(event: MonitorEvent): string | undefined {
  const length = numberPath(event, ['attributes', 'sdk.queue.length']);
  const bytes = numberPath(event, ['attributes', 'sdk.queue.bytes']);
  if (length === undefined && bytes === undefined) return undefined;
  return [length !== undefined ? `${length} events` : undefined, byteLabel(bytes)].filter(Boolean).join(' / ');
}

function retryLabel(event: MonitorEvent): string | undefined {
  const count = numberPath(event, ['attributes', 'sdk.retry.count']) ??
    numberPath(event, ['attributes', 'sdk.health.retry_count']);
  const delay = numberPath(event, ['attributes', 'sdk.retry.delay_ms']);
  const reason = stringPath(event, ['attributes', 'sdk.retry.reason']);
  const parts = [
    count !== undefined ? `${count} 次` : undefined,
    durationLabel(delay),
    reason,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : undefined;
}

function dropLabel(event: MonitorEvent): string | undefined {
  const count = numberPath(event, ['attributes', 'sdk.drop.count']) ??
    numberPath(event, ['attributes', 'sdk.health.dropped_count']);
  const reason = stringPath(event, ['attributes', 'sdk.drop.reason']) ?? stringPath(event, ['payload', 'reason']);
  const parts = [
    count !== undefined ? `${count} 条` : undefined,
    reason,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : undefined;
}

function flushLabel(event: MonitorEvent): string | undefined {
  const result = stringPath(event, ['attributes', 'sdk.flush.result']);
  const reason = stringPath(event, ['attributes', 'sdk.flush.reason']);
  const sent = numberPath(event, ['attributes', 'sdk.flush.sent_count']) ??
    numberPath(event, ['attributes', 'sdk.health.sent_count']);
  const parts = [
    result ?? (event.name?.includes('flush') ? event.status : undefined),
    sent !== undefined ? `${sent} sent` : undefined,
    reason,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : undefined;
}

function buildSdkHealth(events: MonitorEvent[]): SessionSdkHealthSummary {
  const healthReports = events.filter((event) => event.name === 'sdk.health.report');
  const outputModes = new Set<string>();
  for (const event of events) {
    const mode = stringPath(event, ['attributes', 'sdk.output.mode']) ?? stringPath(event, ['payload', 'output_mode']);
    if (mode) outputModes.add(mode);
  }
  const latestQueue = [...events].reverse().find((event) => numberPath(event, ['attributes', 'sdk.queue.length']) !== undefined || numberPath(event, ['attributes', 'sdk.queue.bytes']) !== undefined);

  const explicitDropCount = events
    .filter((event) => event.name === 'sdk.queue.drop')
    .reduce((sum, event) => sum + (numberPath(event, ['attributes', 'sdk.drop.count']) ?? 1), 0);
  const healthDropped = sumNumber(healthReports, ['attributes', 'sdk.health.dropped_count']);
  const healthRetries = sumNumber(healthReports, ['attributes', 'sdk.health.retry_count']);
  const healthFlushFailures = sumNumber(healthReports, ['attributes', 'sdk.health.flush_failure_count']);
  const explicitFlushFailures = events.filter(isSdkFlushFailure).length;

  return {
    flushCount: events.filter((event) => event.name === 'sdk.output.flush' || event.name === 'sdk.lifecycle.flush').length,
    flushFailureCount: Math.max(explicitFlushFailures, healthFlushFailures),
    retryCount: healthRetries > 0 ? healthRetries : events.filter((event) => event.name === 'sdk.retry.schedule').length,
    dropCount: events.filter((event) => event.name === 'sdk.queue.drop').length,
    droppedEventCount: Math.max(explicitDropCount, healthDropped),
    queueStateCount: events.filter((event) => event.name === 'sdk.queue.state').length,
    configAppliedCount: events.filter((event) => event.name === 'sdk.config.applied').length,
    latestQueueLength: latestQueue ? numberPath(latestQueue, ['attributes', 'sdk.queue.length']) : undefined,
    latestQueueBytes: latestQueue ? numberPath(latestQueue, ['attributes', 'sdk.queue.bytes']) : undefined,
    outputModes: [...outputModes],
    detailDroppedCount: events.filter((event) => booleanPath(event, ['payload', 'http.detail_dropped']) === true).length,
  };
}

function isPageEntryRow(row: SessionConsoleRow): boolean {
  if (row.name === 'route.push') return true;
  if (row.name !== 'page.visit') return false;
  if (row.phase === 'start') return true;
  if (row.phase === 'end') return false;
  return (row.status !== 'ok' && row.status !== 'success') || !row.endTime;
}

function isSlowPage(event: MonitorEvent): boolean {
  if (event.name !== 'page.load') return false;
  const loadMs = numberPath(event, ['attributes', 'page.load_ms']);
  const firstFrameMs = numberPath(event, ['attributes', 'page.first_frame_ms']);
  const duration = loadMs ?? firstFrameMs ?? event.durationMs;
  return typeof duration === 'number' && duration >= SLOW_PAGE_MS;
}

function isNonHttpStabilityError(event: MonitorEvent): boolean {
  return !isCompletedHttpEvent(event) && !isBusinessFailureEvent(event) && isErrorEvent(event);
}

function isMemoryEvent(event: MonitorEvent): boolean {
  const name = event.name ?? '';
  return name.startsWith('memory.') || name.startsWith('native.memory.');
}

function isMemoryProblem(event: MonitorEvent): boolean {
  if (event.name === 'memory.pressure' || event.name === 'native.memory.pressure') {
    const level = stringPath(event, ['attributes', 'memory.pressure_level']);
    return level === undefined || (level !== '' && level !== 'none');
  }
  if (event.name === 'memory.leak.suspect') return true;
  if (event.name === 'memory.growth') {
    const level = String(event.level ?? event.status ?? '');
    const growth = numberPath(event, ['attributes', 'memory.growth_mb']);
    return level.includes('warn') || (typeof growth === 'number' && growth > 0);
  }
  return false;
}

function memoryLabel(event: MonitorEvent): string {
  if (event.name === 'memory.leak.suspect') return '疑似泄漏';
  if (event.name === 'memory.growth') return '内存增长';
  return '内存压力';
}

function isSdkFlushFailure(event: MonitorEvent): boolean {
  if (event.name !== 'sdk.output.flush' && event.name !== 'sdk.lifecycle.flush') return false;
  return event.status === 'error' || stringPath(event, ['attributes', 'sdk.flush.result']) === 'failed';
}

function sortEvents(events: MonitorEvent[]): MonitorEvent[] {
  return [...events].sort((a, b) => timeValue(a.timestamp ?? a.startTime) - timeValue(b.timestamp ?? b.startTime));
}

function readPath(value: unknown, path: string[]): unknown {
  let current = value;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function stringPath(value: unknown, path: string[]): string | undefined {
  const result = readPath(value, path);
  return typeof result === 'string' && result.length > 0 ? result : undefined;
}

function numberPath(value: unknown, path: string[]): number | undefined {
  const result = readPath(value, path);
  return typeof result === 'number' && Number.isFinite(result) ? result : undefined;
}

function booleanPath(value: unknown, path: string[]): boolean | undefined {
  const result = readPath(value, path);
  return typeof result === 'boolean' ? result : undefined;
}

function recordValue(value: unknown): RecordValue | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return true;
}

function timeValue(timestamp?: string): number {
  const value = Date.parse(timestamp ?? '');
  return Number.isNaN(value) ? 0 : value;
}

function timestampDiff(start?: string, end?: string): number | undefined {
  const startValue = timeValue(start);
  const endValue = timeValue(end);
  if (startValue === 0 || endValue === 0 || endValue < startValue) return undefined;
  return endValue - startValue;
}

function maxNumber(values: Array<number | undefined>): number | undefined {
  const numbers = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return numbers.length > 0 ? Math.max(...numbers) : undefined;
}

function sumNumber(events: MonitorEvent[], path: string[]): number {
  let sum = 0;
  for (const event of events) {
    const value = numberPath(event, path);
    if (value !== undefined) sum += value;
  }
  return sum;
}
