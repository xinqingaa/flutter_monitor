import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, AppWindow, ChevronDown, ChevronRight, Rocket } from 'lucide-react';
import { EmptyState } from '../../components/common/empty-state';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import type { MonitorEvent } from '../../shared/datasource/types';
import { eventKind, issueLabels } from '../../shared/event-model/accessors';
import { formatDateTime, formatTime } from '../../shared/formatting/format';
import { cn } from '../../shared/formatting/cn';
import { buildTimelineSegments, type TimelineSegment } from './session-segments';
import type * as React from 'react';
import { timelineDisplay } from '../../shared/event-model/display';

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
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="min-w-0 truncate text-sm font-semibold text-zinc-900">{segment.kind === 'startup' ? '启动链路' : `页面 ${segment.title}`}</span>
              {segment.durationLabel ? <span className="shrink-0 text-xs font-medium tabular-nums text-zinc-600">{segment.durationLabel}</span> : null}
              <span className="shrink-0 text-xs text-zinc-400">{segment.nodeCount} 个节点</span>
            </span>
            <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2 text-xs text-zinc-500">
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
            <div>
              {segment.nodes.map((node, index) => (
                <TimelineNode
                  key={node.eventId ?? `${segment.id}-${index}`}
                  event={node}
                  selected={Boolean(node.eventId && selectedEventId === node.eventId)}
                  selectedNodeRef={selectedNodeRef}
                  onSelect={() => onSelectEvent?.(node)}
                />
              ))}
            </div>
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
  const visibleLabels = labels.slice(0, 2);

  return (
    <button
      ref={selected ? selectedNodeRef : undefined}
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full min-w-0 flex-col items-start justify-between gap-2 border-l-2 border-b-[0.5px] border-l-transparent border-b-zinc-200 px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-teal-50',
        selected && 'border-l-teal-500 bg-teal-50',
        isError && 'bg-red-50/60 hover:bg-red-50',
      )}
    >
      <div className="flex w-full justify-between min-w-0 ">
        <Badge tone={display.tone} className="rounded-md px-1.5 py-0">{display.kindLabel}</Badge>
        <span className="shrink-0 pt-0.5 text-right text-xs tabular-nums text-zinc-400">{formatDateTime(event.startTime ?? event.timestamp)}</span>
      </div>
      <div className='flex flex-col gap-1 w-full'>
        <div className='flex justify-between'>
          <span className={cn('min-w-0 truncate text-xs font-medium', isError ? 'text-red-700' : 'text-zinc-900')}>
            {display.title} 
            {display.durationLabel ? <span className="text-xs  ml-2 font-medium tabular-nums text-zinc-500">{display.durationLabel}</span> : null}
          </span>
          {display.phaseLabel ? <span className="text-xs font-medium text-zinc-500">{display.phaseLabel}</span> : null}
        </div>
        {event.status && event.status !== 'ok' && event.status !== 'unknown' ? <span className="text-xs text-zinc-500">{event.status}</span> : null}
        {visibleLabels.map((label) => (
          <Badge key={label} tone={label === '错误' || label.includes('失败') ? 'danger' : 'warn'} className="rounded-md px-1.5 py-0">
            {label}
          </Badge>
        ))}
        {display.summaryItems.length > 0 ? (
          <div className=" truncate text-xs text-zinc-500">
            {display.summaryItems.slice(0, 2).join(' · ')}
          </div>
        ) : null}
      </div>
      
    </button>
  );
}

function nodeDisplay(event: MonitorEvent) {
  return timelineDisplay(event);
}
