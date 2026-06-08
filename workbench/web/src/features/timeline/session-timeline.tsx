import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, AppWindow, ChevronDown, ChevronRight, Clock3, Rocket } from 'lucide-react';
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
import { IconTooltipButton } from '../../components/ui/icon-tooltip-button';

type CollapseMode = 'collapsed' | 'expanded' | 'mixed';

export function SessionTimeline({
  events,
  selectedEventId,
  autoExpandSelected = false,
  onSelectEvent,
}: {
  events: MonitorEvent[];
  selectedEventId?: string;
  autoExpandSelected?: boolean;
  onSelectEvent?: (event: MonitorEvent) => void;
}) {
  const segments = useMemo(() => buildTimelineSegments(events), [events]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(segments.map((segment) => segment.id)));
  const [collapseMode, setCollapseMode] = useState<CollapseMode>('collapsed');
  const selectedNodeRef = useRef<HTMLButtonElement | null>(null);
  const previousAutoExpandedSelection = useRef<string | undefined>(undefined);
  const knownSegmentIds = useRef<Set<string>>(new Set());
  const collapsedCount = segments.filter((segment) => collapsed.has(segment.id)).length;
  const allExpanded = segments.length > 0 && collapsedCount === 0;
  const nextBulkAction = allExpanded ? '收起全部' : '展开全部';

  useEffect(() => {
    const previousSegmentIds = knownSegmentIds.current;
    setCollapsed((current) => syncCollapsedSegments(segments, current, collapseMode, previousSegmentIds));
    knownSegmentIds.current = segmentIdSet(segments);
  }, [collapseMode, segments]);

  useEffect(() => {
    if (!autoExpandSelected || !selectedEventId) {
      previousAutoExpandedSelection.current = undefined;
      return;
    }
    const selectedSegment = segments.find((segment) => containsEvent(segment, selectedEventId));
    if (!selectedSegment) return;

    const selectionKey = `${selectedEventId}:${selectedSegment.id}`;
    if (selectionKey === previousAutoExpandedSelection.current) return;

    const shouldScroll = previousAutoExpandedSelection.current !== undefined;
    previousAutoExpandedSelection.current = selectionKey;
    setCollapsed((current) => {
      const next = new Set(current);
      next.delete(selectedSegment.id);
      return next;
    });
    if (shouldScroll) selectedNodeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [autoExpandSelected, segments, selectedEventId]);

  function toggle(set: Set<string>, id: string): Set<string> {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  function toggleAllSegments(): void {
    if (allExpanded) {
      setCollapseMode('collapsed');
      setCollapsed(new Set(segments.map((segment) => segment.id)));
      return;
    }
    setCollapseMode('expanded');
    setCollapsed(new Set());
  }

  return (
    <Card className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <CardTitle>会话链路</CardTitle>
          <CardDescription>时间自上而下，启动、页面和会话活动形成区段；阶段、请求、错误、卡顿和足迹挂在所属区段下。</CardDescription>
        </div>
        <IconTooltipButton
          type="button"
          variant="secondary"
          size="icon"
          label={allExpanded ? '收起所有区段' : '展开所有区段'}
          icon={allExpanded ? ChevronDown : ChevronRight}
          onClick={toggleAllSegments}
        />
      </CardHeader>
      <CardContent className="min-h-0 overflow-auto p-0">
        {segments.length === 0 ? (
          <div className="p-3">
            <EmptyState title="暂无链路" description="选择会话后会展示完整链路。" />
          </div>
        ) : (
          <div className="bg-zinc-50/50 py-2">
            {segments.map((segment) => (
              <SegmentView
                key={segment.id}
                segment={segment}
                collapsed={collapsed.has(segment.id)}
                onToggleCollapse={() => {
                  setCollapseMode('mixed');
                  setCollapsed((prev) => toggle(prev, segment.id));
                }}
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
  const Icon = segment.kind === 'startup' ? Rocket : segment.kind === 'activity' ? Activity : AppWindow;
  const issueTone = segment.severity === 'error' ? 'danger' : 'warn';
  const accentClass = segment.severity === 'error' ? 'border-l-red-400' : segment.severity === 'warn' ? 'border-l-amber-400' : segment.kind === 'startup' ? 'border-l-teal-400' : segment.kind === 'activity' ? 'border-l-violet-300' : 'border-l-blue-300';
  const heading = segment.kind === 'startup'
    ? '启动链路'
    : segment.kind === 'activity'
      ? segment.title
      : `页面 ${segment.title}`;

  return (
    <div className={cn('mx-2 mb-2 overflow-hidden rounded-lg border border-zinc-200 border-l-4 bg-white shadow-sm shadow-zinc-200/50 last:mb-0', accentClass)}>
      <div className="sticky top-0 z-10 border-b border-zinc-100 bg-white/95 px-3 py-2 backdrop-blur">
        <button type="button" onClick={onToggleCollapse} className="grid w-full min-w-0 grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2 text-left">
          {collapsed ? <ChevronRight className="size-4 shrink-0 text-zinc-400" /> : <ChevronDown className="size-4 shrink-0 text-zinc-400" />}
          <span className={cn(
            'inline-flex size-7 items-center justify-center rounded-md border',
            segment.severity === 'error' && 'border-red-200 bg-red-50 text-red-600',
            segment.severity === 'warn' && 'border-amber-200 bg-amber-50 text-amber-700',
            segment.severity === 'normal' && segment.kind === 'startup' && 'border-teal-200 bg-teal-50 text-teal-700',
            segment.severity === 'normal' && segment.kind === 'activity' && 'border-violet-200 bg-violet-50 text-violet-700',
            segment.severity === 'normal' && segment.kind === 'page' && 'border-blue-200 bg-blue-50 text-blue-700',
          )}>
            <Icon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="min-w-0 truncate text-sm font-semibold text-zinc-900">{heading}</span>
              <span className="shrink-0 text-xs text-zinc-400">{segment.nodeCount} 个节点</span>
            </span>
            <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-2 text-xs text-zinc-500">
              {segment.durationLabel ? (
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="size-3" />
                  {segment.durationLabel}
                </span>
              ) : null}
              {segment.hasIssue ? (
                <Badge tone={issueTone} className="rounded-md px-1.5 py-0">
                  <AlertTriangle className="size-3" />
                  问题 {segment.issueCount}
                </Badge>
              ) : null}
              {segment.summaryItems.map((item) => (
                <span key={item} className="inline-flex items-center gap-1 text-zinc-500">
                  {item}
                </span>
              ))}
            </span>
          </span>
        </button>
      </div>
      {collapsed ? null : (
        <div className="bg-white py-1">
          {segment.nodes.length === 0 ? (
            <div className="px-3 py-2 pl-9 text-xs text-zinc-400">无更多节点</div>
          ) : (
            <div className="relative mx-3 my-1 border-dashed border-zinc-200 pl-3">
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
  const isError = kind === 'error';
  const labels = issueLabels(event);
  const display = nodeDisplay(event);
  const visibleLabels = labels.slice(0, 2);
  const isSlow = labels.some((label) => label.includes('慢'));
  const hasWarningIssue = labels.length > 0 && !isError && !isSlow;

  return (
    <button
      ref={selected ? selectedNodeRef : undefined}
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative mb-1 flex w-full min-w-0 flex-col items-start justify-between gap-2 rounded-md border border-zinc-100 bg-white px-3 py-2 text-left transition-colors last:mb-0 hover:border-teal-200 hover:bg-teal-50/60',
        !selected && !isError && !isSlow && !hasWarningIssue && 'border-b-zinc-200',
        selected && 'border-teal-300 bg-teal-50 shadow-sm shadow-teal-100',
        isError && 'border-red-200 bg-red-50/60 hover:border-red-300 hover:bg-red-50',
        isSlow && !isError && 'border-amber-300 hover:border-amber-400',
        hasWarningIssue && 'border-amber-300 bg-amber-50/40 hover:border-amber-400 hover:bg-amber-50',
      )}
    >
      <span className={cn(
        'absolute -left-[18px] top-3 size-2 rounded-full border border-white bg-zinc-300',
        selected && 'size-2.5 bg-teal-700',
        isError && 'bg-red-600',
        isSlow && !isError && !selected && 'bg-amber-500',
        hasWarningIssue && !selected && 'bg-amber-500',
      )} />
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

        </div>
        {event.status && event.status !== 'ok' && event.status !== 'unknown' ? <span className="text-xs text-zinc-500">{event.status}</span> : null}
        <div>
          {visibleLabels.map((label) => (
            <Badge key={label} tone={issueLabelTone(label)} className="rounded-md px-1.5 py-0">
              {label}
            </Badge>
          ))}
        </div>
        
        {display.summaryItems.length > 0 ? (
          <div className=" truncate text-xs text-zinc-500">
            {display.summaryItems.slice(0, 2).join(' · ')}
          </div>
        ) : null}
      </div>
      
    </button>
  );
}

function issueLabelTone(label: string): 'danger' | 'warn' {
  if (label === '错误' || label === '请求失败') return 'danger';
  return 'warn';
}

function nodeDisplay(event: MonitorEvent) {
  return timelineDisplay(event);
}

function containsEvent(segment: TimelineSegment, eventId: string | undefined): boolean {
  if (!eventId) return false;
  return segment.nodes.some((event) => event.eventId === eventId);
}

function syncCollapsedSegments(
  segments: TimelineSegment[],
  current: Set<string>,
  mode: CollapseMode,
  previousSegmentIds: Set<string>,
): Set<string> {
  const collapsed = new Set<string>();

  for (const segment of segments) {
    if (mode === 'collapsed') collapsed.add(segment.id);
    else if (mode === 'mixed' && (current.has(segment.id) || !previousSegmentIds.has(segment.id))) collapsed.add(segment.id);
  }

  return collapsed;
}

function segmentIdSet(segments: TimelineSegment[]): Set<string> {
  return new Set(segments.map((segment) => segment.id));
}
