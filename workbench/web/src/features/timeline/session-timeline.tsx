import { useMemo, useState } from 'react';
import { AlertTriangle, AppWindow, ChevronDown, ChevronRight, GanttChartSquare, Rocket } from 'lucide-react';
import { EmptyState } from '../../components/common/empty-state';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import type { MonitorEvent } from '../../shared/datasource/types';
import { eventKind, httpStatusOf, issueLabels, stringPath } from '../../shared/event-model/accessors';
import { formatDuration, formatTime } from '../../shared/formatting/format';
import { cn } from '../../shared/formatting/cn';
import { EventKindBadge } from './status-badge';
import { buildTimelineSegments, type TimelineSegment } from './session-segments';
import { SpanWaterfall } from './span-waterfall';

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
  const [waterfalls, setWaterfalls] = useState<Set<string>>(() => new Set());

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
        <CardDescription>时间自上而下，启动和页面形成区段；请求、错误、卡顿挂在所属区段下，瀑布用于钻取 span 时间关系。</CardDescription>
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
                waterfallOpen={waterfalls.has(segment.id)}
                onToggleCollapse={() => setCollapsed((prev) => toggle(prev, segment.id))}
                onToggleWaterfall={() => setWaterfalls((prev) => toggle(prev, segment.id))}
                selectedEventId={selectedEventId}
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
  waterfallOpen,
  onToggleCollapse,
  onToggleWaterfall,
  selectedEventId,
  onSelectEvent,
}: {
  segment: TimelineSegment;
  collapsed: boolean;
  waterfallOpen: boolean;
  onToggleCollapse: () => void;
  onToggleWaterfall: () => void;
  selectedEventId?: string;
  onSelectEvent?: (event: MonitorEvent) => void;
}) {
  const Icon = segment.kind === 'startup' ? Rocket : AppWindow;
  const issueTone = segment.severity === 'error' ? 'danger' : 'warn';

  return (
    <div className="border-b border-zinc-100 last:border-b-0">
      <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-zinc-100 bg-zinc-50/95 px-3 py-2 backdrop-blur">
        <button type="button" onClick={onToggleCollapse} className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2 text-left">
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
        {!collapsed && segment.spans.length > 0 ? (
          <Button
            type="button"
            onClick={onToggleWaterfall}
            size="sm"
            variant="secondary"
            className={cn(
              'h-7 shrink-0 px-2 text-[11px]',
              waterfallOpen ? 'border-teal-200 bg-teal-50 text-teal-700' : 'border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50',
            )}
          >
            <GanttChartSquare className="size-3.5" />
            {waterfallOpen ? '收起瀑布' : '展开瀑布'}
          </Button>
        ) : null}
      </div>
      {collapsed ? null : (
        <div className="py-1">
          {waterfallOpen ? (
            <SpanWaterfall spans={segment.spans} selectedEventId={selectedEventId} onSelectEvent={onSelectEvent} />
          ) : null}
          {segment.nodes.length === 0 ? (
            <div className="px-3 py-2 pl-9 text-xs text-zinc-400">无更多节点</div>
          ) : (
            segment.nodes.map((node, index) => (
              <TimelineNode
                key={node.eventId ?? `${segment.id}-${index}`}
                event={node}
                selected={Boolean(node.eventId && selectedEventId === node.eventId)}
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
  onSelect,
}: {
  event: MonitorEvent;
  selected: boolean;
  onSelect: () => void;
}) {
  const kind = eventKind(event);
  const isError = kind === 'error' || event.status === 'error';
  const labels = issueLabels(event);
  const meta = nodeMeta(event);

  if (!isHighSignal(event)) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'grid w-full grid-cols-[64px_auto_minmax(0,1fr)] items-center gap-2 px-3 py-1 text-left text-xs text-zinc-500 hover:bg-teal-50',
          selected && 'bg-teal-50 text-zinc-700',
        )}
      >
        <span className="text-right tabular-nums text-zinc-400">{formatTime(event.timestamp ?? event.startTime)}</span>
        <span className="size-1.5 shrink-0 rounded-full bg-zinc-300" />
        <span className="min-w-0 truncate">
          {event.name ?? '-'}
          {meta ? <span className="text-zinc-400"> · {meta}</span> : null}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'grid w-full grid-cols-[64px_minmax(0,1fr)] items-start gap-2 px-3 py-1.5 text-left hover:bg-teal-50',
        selected && 'bg-teal-50',
        isError && 'bg-red-50/60 hover:bg-red-50',
      )}
    >
      <span className="pt-0.5 text-right text-xs tabular-nums text-zinc-400">{formatTime(event.timestamp ?? event.startTime)}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <EventKindBadge event={event} />
          <span className={cn('min-w-0 truncate text-sm font-medium', isError ? 'text-red-700' : 'text-zinc-900')}>
            {event.name ?? '-'}
          </span>
          {typeof event.durationMs === 'number' ? (
            <span className="text-xs tabular-nums text-zinc-500">{formatDuration(event.durationMs)}</span>
          ) : null}
          {labels.map((label) => (
            <Badge key={label} tone={label === '错误' || label.includes('失败') ? 'danger' : 'warn'}>
              {label}
            </Badge>
          ))}
        </div>
        {meta ? <div className="mt-0.5 truncate text-xs text-zinc-500">{meta}</div> : null}
      </div>
    </button>
  );
}

function isHighSignal(event: MonitorEvent): boolean {
  const kind = eventKind(event);
  if (kind === 'error' || kind === 'jank' || kind === 'memory' || kind === 'http') return true;
  if (issueLabels(event).length > 0) return true;
  if (event.signalType === 'span' || event.signalType === 'trace') return true;
  if (kind === 'startup') return true;
  return event.name === 'page.load' || event.name === 'page.first_frame';
}

function nodeMeta(event: MonitorEvent): string | undefined {
  const kind = eventKind(event);
  const parts: string[] = [];
  if (kind === 'http') {
    const url =
      stringPath(event, ['attributes', 'http.url']) ??
      stringPath(event, ['attributes', 'url.normalized']) ??
      stringPath(event, ['payload', 'url']);
    if (url) parts.push(url);
    const status = httpStatusOf(event);
    if (status && status !== '-') parts.push(`HTTP ${status}`);
  } else if (kind === 'error') {
    const message =
      stringPath(event, ['payload', 'message']) ??
      stringPath(event, ['attributes', 'error.message']) ??
      stringPath(event, ['payload', 'error', 'message']);
    if (message) parts.push(message);
  } else if (kind === 'business') {
    const target = stringPath(event, ['attributes', 'ui.target']) ?? stringPath(event, ['payload', 'target']);
    if (target) parts.push(target);
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
}
