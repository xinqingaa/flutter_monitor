import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, AppWindow, ChevronDown, ChevronRight, Rocket } from 'lucide-react';
import { EmptyState } from '../../components/common/empty-state';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import type { MonitorEvent } from '../../shared/datasource/types';
import { eventKind, httpStatusOf, issueLabels, readPath, stringPath } from '../../shared/event-model/accessors';
import { formatDuration, formatTime } from '../../shared/formatting/format';
import { cn } from '../../shared/formatting/cn';
import { EventKindBadge } from './status-badge';
import { buildTimelineSegments, type TimelineSegment } from './session-segments';
import type * as React from 'react';

export function SessionTimeline({
  events,
  selectedEventId,
  onSelectEvent,
}: {
  events: MonitorEvent[];
  selectedEventId?: string;
  onSelectEvent?: (event: MonitorEvent) => void;
}) {
  const segments = useMemo(() => buildTimelineSegments(events), [events]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const selectedNodeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    selectedNodeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedEventId]);

  function toggle(set: Set<string>, id: string): Set<string> {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  return (
    <Card className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader>
        <CardTitle>会话链路</CardTitle>
        <CardDescription>时间自上而下，启动和页面形成区段；阶段、请求、错误、卡顿和足迹挂在所属区段下。</CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 overflow-auto p-0">
        {segments.length === 0 ? (
          <div className="p-3">
            <EmptyState title="暂无链路" description="选择会话后会展示完整链路。" />
          </div>
        ) : (
          <div>
            {segments.map((segment) => (
              <SegmentView
                key={segment.id}
                segment={segment}
                collapsed={collapsed.has(segment.id)}
                onToggleCollapse={() => setCollapsed((prev) => toggle(prev, segment.id))}
                selectedEventId={selectedEventId}
                selectedNodeRef={selectedNodeRef}
                onSelectEvent={onSelectEvent}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SegmentView({
  segment,
  collapsed,
  onToggleCollapse,
  selectedEventId,
  selectedNodeRef,
  onSelectEvent,
}: {
  segment: TimelineSegment;
  collapsed: boolean;
  onToggleCollapse: () => void;
  selectedEventId?: string;
  selectedNodeRef: React.MutableRefObject<HTMLButtonElement | null>;
  onSelectEvent?: (event: MonitorEvent) => void;
}) {
  const Icon = segment.kind === 'startup' ? Rocket : AppWindow;
  const issueTone = segment.severity === 'error' ? 'danger' : 'warn';

  return (
    <div className="border-b border-zinc-100 last:border-b-0">
      <div className="sticky top-0 z-10 border-b border-zinc-100 bg-zinc-50/95 px-3 py-2 backdrop-blur">
        <button type="button" onClick={onToggleCollapse} className="grid w-full min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2 text-left">
          {collapsed ? <ChevronRight className="size-4 shrink-0 text-zinc-400" /> : <ChevronDown className="size-4 shrink-0 text-zinc-400" />}
          <span className={cn(
            'inline-flex size-7 items-center justify-center rounded-md border bg-white',
            segment.severity === 'error' && 'border-red-200 bg-red-50 text-red-600',
            segment.severity === 'warn' && 'border-amber-200 bg-amber-50 text-amber-700',
            segment.severity === 'normal' && 'border-zinc-200 text-zinc-500',
          )}>
            <Icon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate text-sm font-semibold text-zinc-900">{segment.title}</span>
              <span className="shrink-0 text-xs text-zinc-400">{segment.kind === 'startup' ? '启动区段' : '页面区段'}</span>
            </span>
            <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2 text-xs text-zinc-500">
              {segment.durationLabel ? <span className="tabular-nums">{segment.durationLabel}</span> : null}
              <span>{segment.nodeCount} 个节点</span>
              {segment.hasIssue ? (
                <Badge tone={issueTone} className="rounded-md px-1.5 py-0">
                  <AlertTriangle className="size-3" />
                  问题 {segment.issueCount}
                </Badge>
              ) : null}
            </span>
          </span>
        </button>
      </div>
      {collapsed ? null : (
        <div className="py-1">
          {segment.nodes.length === 0 ? (
            <div className="px-3 py-2 pl-9 text-xs text-zinc-400">无更多节点</div>
          ) : (
            segment.nodes.map((node, index) => (
              <TimelineNode
                key={node.eventId ?? `${segment.id}-${index}`}
                event={node}
                selected={Boolean(node.eventId && selectedEventId === node.eventId)}
                selectedNodeRef={selectedNodeRef}
                onSelect={() => onSelectEvent?.(node)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TimelineNode({
  event,
  selected,
  selectedNodeRef,
  onSelect,
}: {
  event: MonitorEvent;
  selected: boolean;
  selectedNodeRef: React.MutableRefObject<HTMLButtonElement | null>;
  onSelect: () => void;
}) {
  const kind = eventKind(event);
  const isError = kind === 'error' || event.status === 'error';
  const labels = issueLabels(event);
  const display = nodeDisplay(event);

  return (
    <button
      ref={selected ? selectedNodeRef : undefined}
      type="button"
      onClick={onSelect}
      className={cn(
        'grid w-full grid-cols-[88px_minmax(0,1fr)] items-start gap-2 px-3 py-1.5 text-left hover:bg-teal-50',
        selected && 'bg-teal-50',
        isError && 'bg-red-50/60 hover:bg-red-50',
      )}
    >
      <span className="pt-0.5 text-right text-xs tabular-nums text-zinc-400">{formatTime(event.startTime ?? event.timestamp)}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <EventKindBadge event={event} />
          <span className={cn('min-w-0 truncate text-sm font-medium', isError ? 'text-red-700' : 'text-zinc-900')}>
            {event.name ?? '-'}
          </span>
          {display.primary.map((item) => (
            <span key={item} className="max-w-[180px] truncate text-xs font-medium text-zinc-600">{item}</span>
          ))}
          {typeof event.durationMs === 'number' ? (
            <span className="text-xs tabular-nums text-zinc-500">{formatDuration(event.durationMs)}</span>
          ) : null}
          {labels.map((label) => (
            <Badge key={label} tone={label === '错误' || label.includes('失败') ? 'danger' : 'warn'}>
              {label}
            </Badge>
          ))}
        </div>
        {display.secondary.length > 0 ? <div className="mt-0.5 truncate text-xs text-zinc-500">{display.secondary.join(' · ')}</div> : null}
      </div>
    </button>
  );
}

function nodeDisplay(event: MonitorEvent): { primary: string[]; secondary: string[] } {
  const kind = eventKind(event);
  const primary: string[] = [];
  const secondary: string[] = [];
  const route = stringPath(event, ['context', 'route', 'name']);

  if (kind === 'http') {
    const url =
      stringPath(event, ['attributes', 'http.url']) ??
      stringPath(event, ['attributes', 'url.normalized']) ??
      stringPath(event, ['payload', 'url']);
    if (url) primary.push(url);
    const status = httpStatusOf(event);
    if (status && status !== '-') secondary.push(`HTTP ${status}`);
  } else if (kind === 'error') {
    const message =
      stringPath(event, ['payload', 'message']) ??
      stringPath(event, ['attributes', 'error.message']) ??
      stringPath(event, ['payload', 'error', 'message']);
    if (message) primary.push(message);
  } else if (kind === 'business') {
    const target = stringPath(event, ['attributes', 'ui.target']) ?? stringPath(event, ['payload', 'target']);
    if (target) primary.push(target);
  } else if (kind === 'page') {
    if (route) primary.push(route);
    pushNumber(secondary, 'load', readPath(event, ['attributes', 'page.load_ms']), 'ms');
    pushNumber(secondary, 'first frame', readPath(event, ['attributes', 'page.first_frame_ms']), 'ms');
    pushText(secondary, 'instance', stringPath(event, ['attributes', 'page.instance_id']));
  } else if (kind === 'startup') {
    pushText(primary, 'type', stringPath(event, ['attributes', 'app.start.type']));
    pushNumber(secondary, 'first frame', readPath(event, ['attributes', 'app.first_frame_ms']), 'ms');
  } else if (kind === 'memory') {
    pushNumber(primary, 'rss', readPath(event, ['attributes', 'memory.rss_mb']), 'MB', 1);
    pushText(secondary, 'source', stringPath(event, ['attributes', 'memory.sample_source']));
  } else if (event.name === 'app.lifecycle') {
    const state = stringPath(event, ['context', 'lifecycle', 'state']);
    const previous = stringPath(event, ['context', 'lifecycle', 'previousState']);
    const foreground = readPath(event, ['context', 'lifecycle', 'isForeground']);
    if (state) primary.push(state);
    if (previous) secondary.push(`from ${previous}`);
    if (typeof foreground === 'boolean') secondary.push(foreground ? 'foreground' : 'background');
  } else if (event.name === 'app.foreground_duration') {
    const state = stringPath(event, ['context', 'lifecycle', 'state']);
    if (state) primary.push(state);
    if (typeof event.durationMs === 'number') secondary.push(`foreground ${formatDuration(event.durationMs)}`);
  } else if (event.name === 'sdk.lifecycle.flush') {
    const success = readPath(event, ['attributes', 'app.exit_flush.success']);
    const trigger = stringPath(event, ['payload', 'lifecycle.trigger_state']);
    if (typeof success === 'boolean') primary.push(success ? 'success' : 'failed');
    if (trigger) secondary.push(`trigger ${trigger}`);
  } else {
    const phase = stringPath(event, ['attributes', 'event.phase']);
    if (phase) secondary.push(phase);
    if (route) primary.push(route);
  }

  return { primary, secondary };
}

function pushText(target: string[], label: string, value?: string) {
  if (value) target.push(`${label} ${value}`);
}

function pushNumber(target: string[], label: string, value: unknown, unit: string, digits = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return;
  target.push(`${label} ${value.toFixed(digits)}${unit}`);
}
