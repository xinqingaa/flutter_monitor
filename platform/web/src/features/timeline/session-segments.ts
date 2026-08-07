import type { MonitorEvent } from '../../shared/datasource/types';
import { eventKind, issueLabels } from '../../shared/event-model/accessors';
import { isNativeLifecycleEvent, isNativeMemoryEvent } from '../../shared/event-model/native';
import { routeFullName, routeGroupName } from '../../shared/event-model/route-display';
import { formatDuration } from '../../shared/formatting/format';
import {
  extractFrameEvidence,
  extractRssEvidence,
  formatFrameMs,
  formatFps,
  formatRssDelta,
  formatStability,
  isPageVisitEnd,
  isStartupTraceEnd,
} from '../performance/performance-evidence';

export type SegmentKind = 'startup' | 'page' | 'activity' | 'sdk';
export type SegmentSeverity = 'normal' | 'warn' | 'error';

export interface TimelineSegment {
  id: string;
  kind: SegmentKind;
  title: string;
  /** Short route for headers (`context.route.name`), never query fullName. */
  route?: string;
  /** Optional full route for tooltip only. */
  routeDetail?: string;
  events: MonitorEvent[];
  nodes: MonitorEvent[];
  spans: MonitorEvent[];
  startTimestamp?: string;
  durationLabel?: string;
  summaryItems: string[];
  nodeCount: number;
  severity: SegmentSeverity;
  hasIssue: boolean;
  issueCount: number;
  resumed: boolean;
}

interface RawSegment {
  kind: SegmentKind;
  route?: string;
  pageKey?: string;
  resumed?: boolean;
  events: MonitorEvent[];
  start: number;
}

export function buildTimelineSegments(events: MonitorEvent[]): TimelineSegment[] {
  const prepared = prepareSessionEvents(events);
  const raw: RawSegment[] = [];
  const pageSegments = new Map<string, RawSegment[]>();
  let current: RawSegment | undefined;
  let startup: RawSegment | undefined;
  let initialStartupClosed = false;
  let seenPageEntry = false;

  for (const event of prepared) {
    const route = realRoute(event);
    const isSdk = isSdkTimelineEvent(event);
    const isEntry = isPageEntry(event);
    const isResume = isPageResume(event);

    if (isInitialStartupEvent(event, { startup, initialStartupClosed, seenPageEntry })) {
      if (!startup) {
        startup = makeRaw('startup', undefined, event);
        raw.push(startup);
        if (!current) current = startup;
      }
      startup.events.push(event);
      if (event.name === 'app.cold_start' && eventPhase(event) === 'end') initialStartupClosed = true;
      continue;
    }

    if (isEntry || isResume) seenPageEntry = true;

    const targetPageSegment = isSdk ? undefined : isResume ? undefined : pageSegmentForEvent(event, pageSegments);
    if (targetPageSegment && targetPageSegment !== current) {
      targetPageSegment.events.push(event);
      continue;
    }

    if (!current) {
      current = makeRaw(isSdk ? 'sdk' : isEntry || isResume ? 'page' : 'activity', route, event);
      if (isResume) current.resumed = true;
      registerPageSegment(current, pageSegments);
      raw.push(current);
    } else {
      const leavesStartupViaPage = current.kind === 'startup' && (isEntry || isResume) && route !== undefined;
      const entryPageKey = pageInstanceKey(event);
      const explicitNewPage = (isEntry || isResume) && route !== undefined && (
        isResume ||
        current.kind !== 'page' ||
        route !== current.route ||
        (entryPageKey !== undefined && entryPageKey !== current.pageKey)
      );
      const belongsToCurrentPage = current.kind === 'page' && eventBelongsToPageSegment(event, current);
      const leavesPageForActivity = current.kind === 'page' && !isPageTimelineEvent(event) && !belongsToCurrentPage;
      const activityRouteChanged = current.kind === 'activity' && route !== undefined && route !== current.route;

      if (isSdk && current.kind !== 'sdk') {
        // Normal SDK self-monitoring belongs to the current user-visible flow;
        // only orphan SDK diagnostics need a standalone segment.
        current.events.push(event);
        continue;
      } else if (explicitNewPage || leavesStartupViaPage) {
        current = makeRaw('page', route ?? current.route, event);
        current.pageKey = entryPageKey;
        current.resumed = isResume;
        registerPageSegment(current, pageSegments);
        raw.push(current);
      } else if (!isSdk && (leavesPageForActivity || activityRouteChanged)) {
        current = makeRaw('activity', route ?? current.route, event);
        raw.push(current);
      }
    }
    current.events.push(event);
  }

  return raw.map((segment, index) => finalizeSegment(segment, index, raw[index + 1]?.start));
}

export function prepareSessionEvents(events: MonitorEvent[]): MonitorEvent[] {
  const merged = new Map<string, MonitorEvent>();
  const passthrough: MonitorEvent[] = [];

  for (const event of events) {
    const key = mergeKey(event);
    if (!key) {
      passthrough.push(event);
      continue;
    }
    const existing = merged.get(key);
    if (!existing || prefersClosed(event, existing)) merged.set(key, event);
  }

  return [...passthrough, ...merged.values()].sort(compareTimelineEvents);
}

function mergeKey(event: MonitorEvent): string | undefined {
  if (event.signalType === 'span' && event.spanId) return `span:${event.spanId}`;
  if (event.signalType === 'trace' && event.name === 'app.cold_start') return undefined;
  if (event.signalType === 'trace' && event.name === 'page.visit' && event.traceId) return undefined;
  if (event.signalType === 'trace' && event.traceId) return `trace:${event.traceId}:${event.name ?? ''}`;
  return undefined;
}

function prefersClosed(candidate: MonitorEvent, existing: MonitorEvent): boolean {
  const closed = (event: MonitorEvent) => (event.endTime ? 1 : 0);
  return closed(candidate) >= closed(existing);
}

function makeRaw(kind: SegmentKind, route: string | undefined, first: MonitorEvent): RawSegment {
  return { kind, route, pageKey: kind === 'page' ? pageInstanceKey(first) : undefined, events: [], start: timelineTime(first) };
}

function registerPageSegment(segment: RawSegment, segments: Map<string, RawSegment[]>): void {
  if (segment.kind !== 'page' || !segment.pageKey) return;
  const current = segments.get(segment.pageKey) ?? [];
  current.push(segment);
  segments.set(segment.pageKey, current);
}

function pageCompletionSegment(event: MonitorEvent, segments: Map<string, RawSegment[]>): RawSegment | undefined {
  if (event.name !== 'page.stay' && !isPageVisitEnd(event)) return undefined;
  const key = pageInstanceKey(event);
  return key ? latestSegment(segments.get(key)) : undefined;
}

function pageSegmentForEvent(event: MonitorEvent, segments: Map<string, RawSegment[]>): RawSegment | undefined {
  const completion = pageCompletionSegment(event, segments);
  if (completion) return completion;
  const key = pageInstanceKey(event);
  return key ? latestSegment(segments.get(key)) : undefined;
}

function latestSegment(segments: RawSegment[] | undefined): RawSegment | undefined {
  return segments?.at(-1);
}

function finalizeSegment(segment: RawSegment, index: number, nextStart: number | undefined): TimelineSegment {
  const { events, kind } = segment;
  const nodes = events;
  const spans = events.filter((event) => timeMs(event.startTime) !== undefined && timeMs(event.endTime) !== undefined);
  const first = events[0];
  const issueCount = events.filter((event) => issueLabels(event).length > 0 || eventKind(event) === 'error').length;
  const severity = segmentSeverity(events);
  const route = segment.route ?? events.map(segmentRoute).find(Boolean);
  const routeDetail = events.map(segmentRouteDetail).find(Boolean);

  return {
    id: `${index}-${first?.eventId ?? 'segment'}`,
    kind,
    route,
    routeDetail: routeDetail && routeDetail !== route ? routeDetail : undefined,
    title: segmentTitle(kind, events, route),
    events,
    nodes,
    spans,
    startTimestamp: first?.timestamp,
    durationLabel: segmentDurationLabel(kind, events, segment.start, nextStart),
    summaryItems: segmentSummaryItems(kind, events),
    nodeCount: nodes.length,
    severity,
    hasIssue: issueCount > 0,
    issueCount,
    resumed: Boolean(segment.resumed),
  };
}

export function firstTimelineEvent(events: MonitorEvent[]): MonitorEvent | undefined {
  return buildTimelineSegments(events).flatMap((segment) => segment.nodes)[0];
}

function segmentTitle(kind: SegmentKind, events: MonitorEvent[], route: string | undefined): string {
  if (kind === 'startup') return '启动';
  if (kind === 'page') return [route ?? '页面', pageResumed(events) ? '返回后继续' : undefined, ...pageDiagnosticLabels(events)].filter(isString).join(' · ');
  if (kind === 'sdk') return [`页面 ${route}`, 'SDK 诊断'].filter(isString).join(' · ');
  return route ? `页面活动 ${route}` : '会话活动';
}

function segmentDurationLabel(
  kind: SegmentKind,
  events: MonitorEvent[],
  start: number,
  nextStart: number | undefined,
): string | undefined {
  const byName = (name: string) => events.find((event) => event.name === name);

  if (kind === 'startup') {
    const cold = byName('app.cold_start');
    const hot = byName('app.hot_start');
    const startup = cold ?? hot;
    const label = startup === hot && !cold ? '热重启' : '冷启动';
    const duration = startup?.durationMs ?? safeSpanDuration(events);
    return duration !== undefined ? `${label} ${formatDuration(duration)}` : undefined;
  }

  if (kind === 'activity') {
    const duration = safeWindowDuration(events, start, nextStart) ?? safeSpanDuration(events);
    return duration !== undefined ? `持续 ${formatDuration(duration)}` : undefined;
  }

  const stay = byName('page.stay')?.durationMs;
  const boundary = nextStart !== undefined ? nextStart - start : undefined;
  const duration = stay ?? boundary ?? safeSpanDuration(events);
  return duration !== undefined ? `停留 ${formatDuration(duration)}` : undefined;
}

function safeWindowDuration(events: MonitorEvent[], start: number, nextStart: number | undefined): number | undefined {
  if (nextStart !== undefined && nextStart >= start) return nextStart - start;
  const last = events.map((event) => timelineTime(event)).filter(isNumber).at(-1);
  return last !== undefined && last >= start ? last - start : undefined;
}

function safeSpanDuration(events: MonitorEvent[]): number | undefined {
  const relevant = events.filter((event) => event.signalType !== 'metric');
  const starts = relevant.map((event) => timeMs(event.startTime) ?? timeMs(event.timestamp)).filter(isNumber);
  const ends = relevant.map((event) => timeMs(event.endTime) ?? timeMs(event.timestamp)).filter(isNumber);
  if (starts.length === 0 || ends.length === 0) return undefined;
  return Math.max(...ends) - Math.min(...starts);
}

function segmentSummaryItems(kind: SegmentKind, events: MonitorEvent[]): string[] {
  const performanceItems = performanceSummaryItems(kind, events);
  const failedHttp = events.filter(isFailedHttpEvent).length;
  const errors = events.filter(isNonHttpErrorEvent).length;
  const hotStarts = events.filter((event) => event.name === 'app.hot_start' && event.durationMs !== undefined).length;
  const background = events
    .filter((event) => event.name === 'app.background_duration' && typeof event.durationMs === 'number')
    .map((event) => event.durationMs as number);
  const memorySamples = events.filter((event) => event.name === 'memory.sample').length;
  const healthReports = events.filter((event) => event.name === 'sdk.health.report');
  const sdkDrops = events
    .filter((event) => event.name === 'sdk.queue.drop')
    .reduce((sum, event) => sum + (numberAttribute(event, 'sdk.drop.count') ?? 1), 0)
    + healthReports.reduce((sum, event) => sum + (numberAttribute(event, 'sdk.health.dropped_count') ?? 0), 0);
  // sdk.retry.schedule 只是进入重试状态的边沿事件，重试次数以 health report 计数为准。
  const healthRetryCount = healthReports.reduce((sum, event) => sum + (numberAttribute(event, 'sdk.health.retry_count') ?? 0), 0);
  const sdkRetries = healthRetryCount > 0
    ? healthRetryCount
    : events.filter((event) => event.name === 'sdk.retry.schedule').length;
  const sdkFlushes = events.filter((event) => event.name === 'sdk.output.flush' || event.name === 'sdk.lifecycle.flush').length;
  const nativeLifecycle = events.filter(isNativeLifecycleEvent).length;
  const nativeMemory = events.filter(isNativeMemoryEvent).length;
  const lifecycle = events.filter((event) => event.name === 'app.lifecycle').length;
  const business = events.filter(isBusinessEvent).length;
  const interactions = events.filter(isInteractionMeasureEvent).length;
  const slowInteractions = events.filter(isSlowInteractionEvent).length;

  const items: string[] = [...performanceItems];
  if (sdkDrops > 0) items.push(`丢弃 ${sdkDrops}`);
  if (sdkRetries > 0) items.push(`重试 ${sdkRetries}`);
  if (sdkFlushes > 0) items.push(`发送回执 ${sdkFlushes}`);
  if (interactions > 0) items.push(`交互 ${interactions}`);
  if (slowInteractions > 0) items.push(`慢交互 ${slowInteractions}`);
  if (business > 0) items.push(`业务操作 ${business}`);
  if (failedHttp > 0) items.push(`失败请求 ${failedHttp}`);
  if (errors > 0) items.push(`错误 ${errors}`);
  if (hotStarts > 0) items.push(`热重启 ${hotStarts}`);
  if (background.length > 0) items.push(`后台 ${formatDuration(Math.max(...background))}`);
  if (nativeLifecycle > 0) items.push(`Native lifecycle ${nativeLifecycle}`);
  if (nativeMemory > 0) items.push(`Native 内存 ${nativeMemory}`);
  if (memorySamples > 0) items.push(`内存采样 ${memorySamples}`);
  if (lifecycle > 0) items.push(`生命周期 ${lifecycle}`);
  return items.slice(0, 4);
}

function performanceSummaryItems(kind: SegmentKind, events: MonitorEvent[]): string[] {
  if (kind === 'startup') {
    const startup = [...events].reverse().find(isStartupTraceEnd);
    if (!startup) return [];
    const rss = extractRssEvidence(startup, 'startup');
    return [
      startup.durationMs !== undefined ? `启动 ${formatDuration(startup.durationMs)}` : undefined,
      rss.deltaRssMb !== undefined ? `RSS 变化 ${formatRssDelta(rss.deltaRssMb)}` : undefined,
    ].filter(isString);
  }
  if (kind === 'page') {
    const visit = [...events].reverse().find(isPageVisitEnd);
    if (!visit) return [];
    const frame = extractFrameEvidence(visit);
    const rss = extractRssEvidence(visit, 'page');
    const stay = events.find((event) => event.name === 'page.stay' && typeof event.durationMs === 'number')?.durationMs;
    const load = events.find((event) => event.name === 'page.load' && typeof event.durationMs === 'number')?.durationMs;
    return [
      stay !== undefined ? `停留 ${formatDuration(stay)}` : load !== undefined ? `加载 ${formatDuration(load)}` : visit.durationMs !== undefined ? `停留 ${formatDuration(visit.durationMs)}` : undefined,
      frame.fps !== undefined || frame.stability !== undefined ? `${formatFps(frame.fps)} / ${formatStability(frame.stability)}` : undefined,
      frame.maxMs !== undefined ? `最大帧 ${formatFrameMs(frame.maxMs)}` : undefined,
      rss.deltaRssMb !== undefined ? `RSS 变化 ${formatRssDelta(rss.deltaRssMb)}` : undefined,
    ].filter(isString);
  }
  return [];
}

function segmentSeverity(events: MonitorEvent[]): SegmentSeverity {
  if (events.some((event) => eventKind(event) === 'error')) return 'error';
  if (events.some((event) => eventKind(event) === 'business' && event.status === 'error')) return 'warn';
  if (events.some((event) => issueLabels(event).length > 0 || isSlowInteractionEvent(event))) return 'warn';
  return 'normal';
}

function pageDiagnosticLabels(events: MonitorEvent[]): string[] {
  const labels: string[] = [];
  if (events.some(isNonHttpErrorEvent) || events.some(isFailedBusinessEvent)) labels.push('业务失败');
  if (events.some(isInteractionMeasureEvent)) labels.push('交互性能');
  if (events.some((event) => isBusinessEvent(event) && !isInteractionMeasureEvent(event))) labels.push('业务操作');
  if (events.some(isFailedHttpEvent)) labels.push('失败请求');
  if (events.some((event) => eventKind(event) === 'jank')) labels.push('卡顿');
  if (events.some((event) => eventKind(event) === 'memory' || event.name === 'app.lifecycle')) labels.push('运行状态');
  return labels.slice(0, 2);
}

function isFailedHttpEvent(event: MonitorEvent): boolean {
  return eventKind(event) === 'http' && (event.status === 'error' || event.attributes?.['http.success'] === false);
}

function isNonHttpErrorEvent(event: MonitorEvent): boolean {
  return eventKind(event) !== 'http' &&
    !isFailedBusinessEvent(event) &&
    (eventKind(event) === 'error' || event.status === 'error');
}

function isBusinessEvent(event: MonitorEvent): boolean {
  return typeof event.attributes?.['business.action'] === 'string' && event.attributes['business.action'].length > 0;
}

function isFailedBusinessEvent(event: MonitorEvent): boolean {
  return isBusinessEvent(event) && (
    event.attributes?.['business.result'] === 'failed' ||
    event.status === 'error'
  );
}

function isInteractionMeasureEvent(event: MonitorEvent): boolean {
  return event.name === 'interaction.measure' || typeof event.attributes?.['interaction.mode'] === 'string';
}

function isSlowInteractionEvent(event: MonitorEvent): boolean {
  if (!isInteractionMeasureEvent(event)) return false;
  const maxMs = numberAttribute(event, 'frame.max_ms');
  const budgetMs = numberAttribute(event, 'frame.budget_ms');
  const slowCount = numberAttribute(event, 'frame.slow_count');
  return (slowCount ?? 0) > 0 || (
    maxMs !== undefined &&
    budgetMs !== undefined &&
    maxMs > budgetMs * 2
  );
}

function isPageEntry(event: MonitorEvent): boolean {
  if (event.name === 'route.push') return true;
  return event.name === 'page.visit' && eventPhase(event) === 'start';
}

function isPageResume(event: MonitorEvent): boolean {
  return event.name === 'page.view' &&
    event.attributes?.['page.active_phase'] === 'page.resume' &&
    event.attributes?.['page.active_trigger'] === 'route_pop';
}

function isPageTimelineEvent(event: MonitorEvent): boolean {
  if (isLifecycleResumePageView(event)) return false;
  return event.name === 'route.push' || event.name === 'route.pop' || event.name === 'page.visit' || event.name === 'page.load' ||
    event.name === 'page.view' || event.name === 'page.stay';
}

function isSdkTimelineEvent(event: MonitorEvent): boolean {
  return event.signalType === 'sdk';
}

function eventBelongsToPageSegment(event: MonitorEvent, segment: RawSegment): boolean {
  if (segment.kind !== 'page') return false;
  if (isLifecycleResumePageView(event)) return false;
  if (isPageTimelineEvent(event)) return true;
  const eventKey = pageInstanceKey(event);
  if (eventKey && segment.pageKey && eventKey === segment.pageKey) return true;
  const segmentTraceId = pageSegmentTraceId(segment);
  return Boolean(segmentTraceId && event.traceId && event.traceId === segmentTraceId);
}

function isLifecycleResumePageView(event: MonitorEvent): boolean {
  return event.name === 'page.view' &&
    event.attributes?.['page.active_phase'] === 'page.resume' &&
    event.attributes?.['page.active_trigger'] === 'lifecycle_resumed';
}

function isInitialStartupEvent(
  event: MonitorEvent,
  state: { startup?: RawSegment; initialStartupClosed: boolean; seenPageEntry: boolean },
): boolean {
  if (event.name === 'app.hot_start') return false;
  if (state.initialStartupClosed) return false;
  if (event.name === 'app.cold_start' || event.name === 'sdk.init') return true;
  return !state.seenPageEntry && event.name === 'memory.sample';
}

function realRoute(event: MonitorEvent): string | undefined {
  if (isSdkTimelineEvent(event)) return undefined;
  return routeForDisplay(event);
}

function segmentRoute(event: MonitorEvent): string | undefined {
  return routeForDisplay(event);
}

/** Segment headers use short route name so query strings do not collapse the title. */
function routeForDisplay(event: MonitorEvent): string | undefined {
  const route = routeGroupName(event);
  return route && route !== '-' && route !== '未知页面' ? route : undefined;
}

function segmentRouteDetail(event: MonitorEvent): string | undefined {
  const detail = routeFullName(event);
  return detail && detail !== '-' ? detail : undefined;
}

function eventPhase(event: MonitorEvent): string | undefined {
  const phase = event.attributes?.['event.phase'];
  return typeof phase === 'string' ? phase : undefined;
}

function pageResumed(events: MonitorEvent[]): boolean {
  return events.some(isPageResume);
}

function pageInstanceKey(event: MonitorEvent): string | undefined {
  const instanceId = event.attributes?.['page.instance_id'];
  if (typeof instanceId === 'string' && instanceId.length > 0) {
    return event.traceId ? `${instanceId}:${event.traceId}` : instanceId;
  }
  return undefined;
}

function pageSegmentTraceId(segment: RawSegment): string | undefined {
  return segment.events.find((event) => event.name === 'page.visit' && event.traceId)?.traceId ??
    segment.events.find((event) => event.traceId)?.traceId;
}

function numberAttribute(event: MonitorEvent, key: string): number | undefined {
  const value = event.attributes?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function effectiveStart(event: MonitorEvent): number {
  return timeMs(event.startTime) ?? timeMs(event.timestamp) ?? 0;
}

function compareTimelineEvents(a: MonitorEvent, b: MonitorEvent): number {
  return timelineTime(a) - timelineTime(b) ||
    timelinePriority(a) - timelinePriority(b) ||
    effectiveStart(a) - effectiveStart(b) ||
    eventId(a).localeCompare(eventId(b));
}

function timelineTime(event: MonitorEvent): number {
  const phase = eventPhase(event);
  if (phase === 'start') return timeMs(event.startTime) ?? timeMs(event.timestamp) ?? 0;
  if (phase === 'end') return timeMs(event.endTime) ?? timeMs(event.timestamp) ?? timeMs(event.startTime) ?? 0;
  return timeMs(event.timestamp) ?? timeMs(event.startTime) ?? 0;
}

function timelinePriority(event: MonitorEvent): number {
  const phase = eventPhase(event);
  if (event.name === 'page.visit' && phase === 'start') return 10;
  if (event.name === 'route.push') return 20;
  if (event.name === 'route.pop') return 25;
  if (event.name === 'page.view') return 30;
  if (event.name === 'page.load') return 40;
  if (event.name === 'page.stay') return 80;
  if (event.name === 'page.visit' && phase === 'end') return 90;
  if (event.name === 'http.client') return 55;
  if (event.signalType === 'error' || event.status === 'error') return 60;
  return 70;
}

function eventId(event: MonitorEvent): string {
  return event.eventId ?? event.spanId ?? event.traceId ?? event.name ?? '';
}

function timeMs(timestamp?: string): number | undefined {
  if (!timestamp) return undefined;
  const value = Date.parse(timestamp);
  return Number.isNaN(value) ? undefined : value;
}

function isNumber(value: number | undefined): value is number {
  return value !== undefined;
}

function isString(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0 && value !== '-';
}
