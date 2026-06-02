import type { MonitorEvent } from '../../shared/datasource/types';
import { eventKind, issueLabels, routeOf } from '../../shared/event-model/accessors';
import { formatDuration } from '../../shared/formatting/format';

export type SegmentKind = 'startup' | 'page';
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
  nodeCount: number;
  severity: SegmentSeverity;
  hasIssue: boolean;
  issueCount: number;
}

interface RawSegment {
  kind: SegmentKind;
  route?: string;
  events: MonitorEvent[];
  start: number;
}

export function buildTimelineSegments(events: MonitorEvent[]): TimelineSegment[] {
  const prepared = prepareSessionEvents(events);
  const raw: RawSegment[] = [];
  let current: RawSegment | undefined;

  for (const event of prepared) {
    const kind = eventKind(event);
    const route = realRoute(event);
    const isEntry = event.name === 'page.visit' || event.name === 'route.push';

    if (!current) {
      current = makeRaw(kind === 'startup' ? 'startup' : 'page', kind === 'startup' ? undefined : route, event);
      raw.push(current);
    } else {
      const leavesStartupViaPage = current.kind === 'startup' && kind === 'page' && route !== undefined;
      const pageChanged = current.kind === 'page' && route !== undefined && route !== current.route;
      const explicitNewPage = isEntry && route !== undefined && route !== current.route;
      if (explicitNewPage || leavesStartupViaPage || pageChanged) {
        current = makeRaw('page', route ?? current.route, event);
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

  return [...passthrough, ...merged.values()].sort((a, b) => effectiveStart(a) - effectiveStart(b));
}

function mergeKey(event: MonitorEvent): string | undefined {
  if (event.signalType === 'span' && event.spanId) return `span:${event.spanId}`;
  if (event.signalType === 'trace' && event.name === 'page.visit' && event.traceId) return undefined;
  if (event.signalType === 'trace' && event.traceId) return `trace:${event.traceId}:${event.name ?? ''}`;
  return undefined;
}

function prefersClosed(candidate: MonitorEvent, existing: MonitorEvent): boolean {
  const closed = (event: MonitorEvent) => (event.endTime ? 1 : 0);
  return closed(candidate) >= closed(existing);
}

function makeRaw(kind: SegmentKind, route: string | undefined, first: MonitorEvent): RawSegment {
  return { kind, route, events: [], start: effectiveStart(first) };
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
    title: kind === 'startup' ? '启动' : (route ?? '页面'),
    events,
    nodes,
    spans,
    startTimestamp: first?.timestamp,
    durationLabel: segmentDurationLabel(kind, events, segment.start, nextStart),
    nodeCount: nodes.length,
    severity,
    hasIssue: issueCount > 0,
    issueCount,
  };
}

export function firstTimelineEvent(events: MonitorEvent[]): MonitorEvent | undefined {
  return buildTimelineSegments(events).flatMap((segment) => segment.nodes)[0];
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

  const stay = byName('page.stay')?.durationMs;
  const boundary = nextStart !== undefined ? nextStart - start : undefined;
  const duration = stay ?? boundary ?? safeSpanDuration(events);
  return duration !== undefined ? `停留 ${formatDuration(duration)}` : undefined;
}

function safeSpanDuration(events: MonitorEvent[]): number | undefined {
  const relevant = events.filter((event) => event.signalType !== 'metric');
  const starts = relevant.map((event) => timeMs(event.startTime) ?? timeMs(event.timestamp)).filter(isNumber);
  const ends = relevant.map((event) => timeMs(event.endTime) ?? timeMs(event.timestamp)).filter(isNumber);
  if (starts.length === 0 || ends.length === 0) return undefined;
  return Math.max(...ends) - Math.min(...starts);
}

function segmentSeverity(events: MonitorEvent[]): SegmentSeverity {
  if (events.some((event) => eventKind(event) === 'error' || event.status === 'error')) return 'error';
  if (events.some((event) => issueLabels(event).length > 0)) return 'warn';
  return 'normal';
}

function realRoute(event: MonitorEvent): string | undefined {
  const route = routeOf(event);
  return route && route !== '-' ? route : undefined;
}

function effectiveStart(event: MonitorEvent): number {
  return timeMs(event.startTime) ?? timeMs(event.timestamp) ?? 0;
}

function timeMs(timestamp?: string): number | undefined {
  if (!timestamp) return undefined;
  const value = Date.parse(timestamp);
  return Number.isNaN(value) ? undefined : value;
}

function isNumber(value: number | undefined): value is number {
  return value !== undefined;
}
