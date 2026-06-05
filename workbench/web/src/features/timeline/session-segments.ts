import type { MonitorEvent } from '../../shared/datasource/types';
import { eventKind, issueLabels } from '../../shared/event-model/accessors';
import { isNativeLifecycleEvent, isNativeMemoryEvent } from '../../shared/event-model/native';
import { routeDisplayName } from '../../shared/event-model/route-display';
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

export type SegmentKind = 'startup' | 'page' | 'activity';
export type SegmentSeverity = 'normal' | 'warn' | 'error';

export interface TimelineSegment {
  id: string;
  kind: SegmentKind;
  title: string;
  route?: string;
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
}

interface RawSegment {
  kind: SegmentKind;
  route?: string;
  pageKey?: string;
  events: MonitorEvent[];
  start: number;
}

export function buildTimelineSegments(events: MonitorEvent[]): TimelineSegment[] {
  const prepared = prepareSessionEvents(events);
  const raw: RawSegment[] = [];
  const pageSegments = new Map<string, RawSegment>();
  let current: RawSegment | undefined;
  let startup: RawSegment | undefined;
  let initialStartupClosed = false;
  let seenPageEntry = false;

  for (const event of prepared) {
    const route = realRoute(event);
    const isEntry = isPageEntry(event);

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

    if (isEntry) seenPageEntry = true;

    const targetPageSegment = pageCompletionSegment(event, pageSegments);
    if (targetPageSegment && targetPageSegment !== current) {
      targetPageSegment.events.push(event);
      continue;
    }

    if (!current) {
      current = makeRaw(isEntry ? 'page' : 'activity', route, event);
      registerPageSegment(current, pageSegments);
      raw.push(current);
    } else {
      const leavesStartupViaPage = current.kind === 'startup' && isEntry && route !== undefined;
      const entryPageKey = pageInstanceKey(event);
      const explicitNewPage = isEntry && route !== undefined && (
        current.kind !== 'page' ||
        route !== current.route ||
        (entryPageKey !== undefined && entryPageKey !== current.pageKey)
      );
      const leavesPageForActivity = current.kind === 'page' && !isPageTimelineEvent(event);
      const activityRouteChanged = current.kind === 'activity' && route !== undefined && route !== current.route;

      if (explicitNewPage || leavesStartupViaPage) {
        current = makeRaw('page', route ?? current.route, event);
        current.pageKey = entryPageKey;
        registerPageSegment(current, pageSegments);
        raw.push(current);
      } else if (leavesPageForActivity || activityRouteChanged) {
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

function registerPageSegment(segment: RawSegment, segments: Map<string, RawSegment>): void {
  if (segment.kind === 'page' && segment.pageKey) segments.set(segment.pageKey, segment);
}

function pageCompletionSegment(event: MonitorEvent, segments: Map<string, RawSegment>): RawSegment | undefined {
  if (event.name !== 'page.stay' && !isPageVisitEnd(event)) return undefined;
  const key = pageInstanceKey(event);
  return key ? segments.get(key) : undefined;
}

function finalizeSegment(segment: RawSegment, index: number, nextStart: number | undefined): TimelineSegment {
  const { events, kind } = segment;
  const nodes = events;
  const spans = events.filter((event) => timeMs(event.startTime) !== undefined && timeMs(event.endTime) !== undefined);
  const first = events[0];
  const issueCount = events.filter((event) => issueLabels(event).length > 0 || eventKind(event) === 'error').length;
  const severity = segmentSeverity(events);
  const route = segment.route ?? events.map(realRoute).find(Boolean);

  return {
    id: `${index}-${first?.eventId ?? 'segment'}`,
    kind,
    route,
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
  };
}

export function firstTimelineEvent(events: MonitorEvent[]): MonitorEvent | undefined {
  return buildTimelineSegments(events).flatMap((segment) => segment.nodes)[0];
}

function segmentTitle(kind: SegmentKind, events: MonitorEvent[], route: string | undefined): string {
  if (kind === 'startup') return '启动';
  if (kind === 'page') return route ?? '页面';
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
  const nativeLifecycle = events.filter(isNativeLifecycleEvent).length;
  const nativeMemory = events.filter(isNativeMemoryEvent).length;
  const lifecycle = events.filter((event) => event.name === 'app.lifecycle').length;

  const items: string[] = [...performanceItems];
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
  if (events.some((event) => eventKind(event) === 'error' || event.status === 'error')) return 'error';
  if (events.some((event) => issueLabels(event).length > 0)) return 'warn';
  return 'normal';
}

function isFailedHttpEvent(event: MonitorEvent): boolean {
  return eventKind(event) === 'http' && (event.status === 'error' || event.attributes?.['http.success'] === false);
}

function isNonHttpErrorEvent(event: MonitorEvent): boolean {
  return eventKind(event) !== 'http' && (eventKind(event) === 'error' || event.status === 'error');
}

function isPageEntry(event: MonitorEvent): boolean {
  if (event.name === 'route.push') return true;
  return event.name === 'page.visit' && eventPhase(event) === 'start';
}

function isPageTimelineEvent(event: MonitorEvent): boolean {
  return event.name === 'route.push' || event.name === 'page.visit' || event.name === 'page.load' ||
    event.name === 'page.view' || event.name === 'page.stay';
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
  const route = routeDisplayName(event);
  return route && route !== '-' ? route : undefined;
}

function eventPhase(event: MonitorEvent): string | undefined {
  const phase = event.attributes?.['event.phase'];
  return typeof phase === 'string' ? phase : undefined;
}

function pageInstanceKey(event: MonitorEvent): string | undefined {
  const instanceId = event.attributes?.['page.instance_id'];
  if (typeof instanceId === 'string' && instanceId.length > 0) {
    return event.traceId ? `${instanceId}:${event.traceId}` : instanceId;
  }
  if (event.name === 'page.visit' && event.traceId) return event.traceId;
  return undefined;
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
  return typeof value === 'string' && value.length > 0 && !value.includes('-');
}
