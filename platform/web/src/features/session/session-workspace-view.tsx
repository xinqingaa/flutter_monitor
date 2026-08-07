import { Link } from '@tanstack/react-router';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  ExternalLink,
  Filter,
  FoldVertical,
  GitBranch,
  MoreHorizontal,
  UnfoldVertical,
} from 'lucide-react';
import { useToast } from '../../components/common/toast';
import { IconTooltipButton } from '../../components/common/icon-tooltip-button';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../components/ui/empty';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../components/ui/tooltip';
import { pathOnly } from '../inspector/http-record';
import { pickScopeSearch } from '../scope/scope-filters';
import { buildTimelineSegments, type TimelineSegment } from '../timeline/session-segments';
import type { MonitorEvent } from '../../shared/datasource/types';
import {
  deviceOf,
  environmentOf,
  eventKind,
  networkOf,
  readPath,
  routeOf,
  sortEvents,
  userIdOf,
} from '../../shared/event-model/accessors';
import { cn } from '../../shared/formatting/cn';
import { copyText } from '../../shared/formatting/download';
import { resultFilterLabel } from '../../shared/formatting/filter-labels';
import { formatDateTime, formatDuration, formatTime } from '../../shared/formatting/format';

export type TimelineFilter = 'all' | 'startup' | 'page' | 'http' | 'business' | 'error';

export type SessionWorkspaceSearch = {
  tab?: TimelineFilter;
  open?: string;
  expand?: string;
  eventId?: string;
  traceId?: string;
};

const FILTERS: TimelineFilter[] = ['all', 'startup', 'page', 'http', 'business', 'error'];
const HTTP_FOLD_THRESHOLD = 12;
const SLOW_HTTP_MS = 1000;

export function SessionWorkspaceView({
  sessionId,
  events,
  search,
  onSearchChange,
}: {
  sessionId: string;
  events: MonitorEvent[];
  search: SessionWorkspaceSearch;
  onSearchChange: (patch: Partial<SessionWorkspaceSearch>) => void;
}) {
  const filter = search.tab ?? 'all';
  const openSegments = useMemo(() => parseIdSet(search.open), [search.open]);
  const expanded = useMemo(() => parseIdSet(search.expand), [search.expand]);
  const focusEventId = search.eventId;
  const traceOnly = search.traceId;
  const [hoverTraceId, setHoverTraceId] = useState<string>();
  const [httpUnfolded, setHttpUnfolded] = useState<Set<string>>(() => new Set());
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());
  const segmentRefs = useRef<Map<string, HTMLElement>>(new Map());
  const focusHandled = useRef<string | undefined>(undefined);

  const primary = useMemo(() => sortEvents(events).filter(inPrimaryTimeline), [events]);
  const segments = useMemo(() => buildTimelineSegments(primary), [primary]);
  const visibleSegmentIds = useMemo(
    () => visibleSegments(segments, filter, traceOnly).map((segment) => segment.id),
    [segments, filter, traceOnly],
  );
  const allSegmentsExpanded = visibleSegmentIds.length > 0
    && visibleSegmentIds.every((id) => openSegments.has(id));
  const segmentViews = useMemo(
    () => buildSegmentViews(segments, filter, traceOnly, httpUnfolded),
    [segments, filter, traceOnly, httpUnfolded],
  );
  const focusEvent = primary.find((event) => event.eventId === focusEventId);

  useEffect(() => {
    setHttpUnfolded(new Set());
    focusHandled.current = undefined;
  }, [sessionId]);

  useEffect(() => {
    if (!focusEventId || focusHandled.current === focusEventId) return;
    const host = segments.find((segment) => segment.nodes.some((event) => event.eventId === focusEventId));
    if (!host) return;
    focusHandled.current = focusEventId;
    if (!openSegments.has(host.id)) {
      onSearchChange({ open: serializeIdSet(new Set([...openSegments, host.id])) });
    }
  }, [focusEventId, segments, openSegments, onSearchChange]);

  useEffect(() => {
    if (!focusEventId) return;
    const node = rowRefs.current.get(focusEventId) ?? segmentRefs.current.get(
      segments.find((segment) => segment.nodes.some((event) => event.eventId === focusEventId))?.id ?? '',
    );
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusEventId, openSegments, segmentViews.length, segments]);

  function setFilter(tab: TimelineFilter) {
    onSearchChange({ tab: tab === 'all' ? undefined : tab });
  }

  function toggleExpand(eventId?: string) {
    if (!eventId) return;
    const next = new Set(expanded);
    if (next.has(eventId)) next.delete(eventId);
    else next.add(eventId);
    onSearchChange({ expand: serializeIdSet(next) });
  }

  function toggleSegment(id: string) {
    const next = new Set(openSegments);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSearchChange({ open: serializeIdSet(next) });
  }

  function toggleAllSegments() {
    if (allSegmentsExpanded) {
      onSearchChange({ open: undefined });
      return;
    }
    onSearchChange({ open: serializeIdSet(new Set(visibleSegmentIds)) });
  }

  function openSegmentAndScroll(segmentId: string, eventId?: string) {
    const next = new Set(openSegments);
    next.add(segmentId);
    onSearchChange({
      open: serializeIdSet(next),
      eventId: eventId ?? focusEventId,
    });
    requestAnimationFrame(() => {
      const target = (eventId && rowRefs.current.get(eventId)) || segmentRefs.current.get(segmentId);
      target?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  function toggleHttpFold(segmentId: string) {
    setHttpUnfolded((current) => {
      const next = new Set(current);
      if (next.has(segmentId)) next.delete(segmentId);
      else next.add(segmentId);
      return next;
    });
  }

  const scrubberMarks = useMemo(
    () => buildScrubberMarks(segments, filter, traceOnly),
    [segments, filter, traceOnly],
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
        <div className="flex flex-wrap items-center gap-3 border-b px-3 py-2">
          <Tabs value={filter} onValueChange={(value) => setFilter(value as TimelineFilter)}>
            <TabsList>
              {FILTERS.map((value) => (
                <TabsTrigger key={value} value={value}>
                  {filterLabel(value)}
                  <span className="ml-1 tabular-nums opacity-60">
                    {value === 'all' ? primary.length : primary.filter((event) => timelineGroup(event) === value).length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {focusEventId ? (
            <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={() => onSearchChange({ eventId: undefined })}>
              清除定位
            </Button>
          ) : null}
          {traceOnly ? (
            <Button
              size="sm"
              variant="outline"
              className={cn('h-7', !focusEventId && 'ml-auto')}
              onClick={() => onSearchChange({ traceId: undefined })}
            >
              <Filter data-icon="inline-start" />
              取消仅看 Trace
            </Button>
          ) : null}
        </div>

        <div className="relative grid min-h-0 grid-rows-[auto_minmax(0,1fr)]">
          <div className="flex items-center justify-between gap-2 px-3 py-1">
            <IconTooltipButton
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              label={allSegmentsExpanded ? '收起全部' : '展开全部'}
              icon={allSegmentsExpanded ? FoldVertical : UnfoldVertical}
              disabled={visibleSegmentIds.length === 0}
              onClick={toggleAllSegments}
            />
            <span className="text-xs tabular-nums text-muted-foreground">
              {visibleSegmentIds.length} 段
            </span>
          </div>
          <div className="relative grid min-h-0 grid-cols-[minmax(0,1fr)_auto]">
            <ScrollArea className="h-full min-w-0">
              <div className="space-y-1.5 p-3 pt-1">
                {segmentViews.length === 0 ? (
                  <Empty className="border-0 py-16">
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><GitBranch /></EmptyMedia>
                      <EmptyTitle>没有匹配事件</EmptyTitle>
                      <EmptyDescription>调整分类或清除 Trace 过滤。</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  segmentViews.map(({ segment, children }) => {
                    const open = openSegments.has(segment.id);
                    return (
                      <div key={segment.id}>
                        <SegmentHeader
                          segment={segment}
                          open={open}
                          onToggle={() => toggleSegment(segment.id)}
                          setRef={(node) => {
                            if (node) segmentRefs.current.set(segment.id, node);
                            else segmentRefs.current.delete(segment.id);
                          }}
                        />
                        <div
                          className={cn(
                            'grid transition-[grid-template-rows] duration-200 ease-out',
                            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                          )}
                        >
                          <div className="min-h-0 overflow-hidden">
                            <div className="space-y-0.5 pb-1">
                              {children.map((item) => {
                                if (item.kind === 'http-fold') {
                                  return (
                                    <HttpFoldRow
                                      key={`http-fold-${item.segmentId}`}
                                      count={item.count}
                                      failed={item.failed}
                                      slow={item.slow}
                                      open={item.open}
                                      onToggle={() => toggleHttpFold(item.segmentId)}
                                    />
                                  );
                                }
                                return (
                                  <EventRow
                                    key={item.event.eventId ?? `${item.event.timestamp}-${item.event.name}`}
                                    event={item.event}
                                    sessionId={sessionId}
                                    focused={item.event.eventId === focusEventId}
                                    expanded={Boolean(item.event.eventId && expanded.has(item.event.eventId))}
                                    traceActive={Boolean(
                                      item.event.traceId
                                      && (item.event.traceId === hoverTraceId
                                        || item.event.traceId === traceOnly
                                        || item.event.traceId === focusEvent?.traceId),
                                    )}
                                    onHoverTrace={setHoverTraceId}
                                    onToggleExpand={() => toggleExpand(item.event.eventId)}
                                    onTraceOnly={() => item.event.traceId && onSearchChange({ traceId: item.event.traceId })}
                                    setRowRef={(node) => {
                                      if (!item.event.eventId) return;
                                      if (node) rowRefs.current.set(item.event.eventId, node);
                                      else rowRefs.current.delete(item.event.eventId);
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
            {scrubberMarks.length >= 2 ? (
              <SessionScrubber
                marks={scrubberMarks}
                onJump={(mark) => openSegmentAndScroll(mark.segmentId, mark.eventId)}
              />
            ) : null}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function SegmentHeader({
  segment,
  open,
  onToggle,
  setRef,
}: {
  segment: TimelineSegment;
  open: boolean;
  onToggle: () => void;
  setRef: (node: HTMLButtonElement | null) => void;
}) {
  const headline = segment.kind === 'startup'
    ? (segment.durationLabel ?? segment.title)
    : (segment.title || segment.route || '页面');
  const duration = segment.kind === 'startup' ? undefined : segment.durationLabel;
  const tooltip = [headline, segment.routeDetail, duration].filter(Boolean).join(' · ');

  return (
    <button
      ref={setRef}
      type="button"
      onClick={onToggle}
      title={tooltip}
      className={cn(
        'flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-2.5 text-left hover:bg-accent/50',
        segment.hasIssue && 'bg-destructive/5',
      )}
    >
      <ChevronRight
        className={cn(
          'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
          open && 'rotate-90',
        )}
      />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {segmentKindLabel(segment.kind)} · {headline}
      </span>
      {duration ? <span className="shrink-0 text-xs text-muted-foreground">{duration}</span> : null}
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{segment.nodeCount}</span>
      {segment.issueCount > 0 ? <Badge variant="destructive" className="shrink-0">{segment.issueCount} 异常</Badge> : null}
    </button>
  );
}

function HttpFoldRow({
  count,
  failed,
  slow,
  open,
  onToggle,
}: {
  count: number;
  failed: number;
  slow: number;
  open: boolean;
  onToggle: () => void;
}) {
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="ml-4 flex w-[calc(100%-1rem)] items-center gap-2 rounded-md border border-dashed px-2 py-2 text-left text-sm hover:bg-accent/40"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="font-medium">HTTP {count}</span>
      {failed > 0 ? <Badge variant="destructive">{failed} 失败</Badge> : <span className="text-xs text-muted-foreground">失败 0</span>}
      {slow > 0 ? <span className="text-xs text-muted-foreground">慢 {slow}</span> : null}
      <span className="text-xs text-muted-foreground">{open ? '收起请求' : '展开请求'}</span>
    </button>
  );
}

function EventRow({
  event,
  sessionId,
  focused,
  expanded,
  traceActive,
  onHoverTrace,
  onToggleExpand,
  onTraceOnly,
  setRowRef,
}: {
  event: MonitorEvent;
  sessionId: string;
  focused: boolean;
  expanded: boolean;
  traceActive: boolean;
  onHoverTrace: (traceId?: string) => void;
  onToggleExpand: () => void;
  onTraceOnly: () => void;
  setRowRef: (node: HTMLDivElement | null) => void;
}) {
  const group = timelineGroup(event);
  const failed = isFailed(event);
  const domain = domainTarget(event);
  const title = eventTitle(event);
  const result = resultLabel(event);
  const context = contextParts(event);
  const rail = traceRailColor(event.traceId, failed);

  return (
    <div
      ref={setRowRef}
      className={cn(
        'group ml-4 grid grid-cols-[6px_minmax(0,1fr)_auto] gap-2 rounded-md border border-transparent border-l border-l-border/70 px-2 py-2 transition-colors',
        'hover:bg-accent/40',
        focused && 'border-ring bg-muted',
        failed && 'bg-destructive/5 hover:bg-destructive/10',
        traceActive && !focused && 'bg-accent/25',
      )}
      onMouseEnter={() => onHoverTrace(event.traceId)}
      onMouseLeave={() => onHoverTrace(undefined)}
    >
      <div className="rounded-full" style={{ backgroundColor: rail }} aria-hidden />
      <div className="min-w-0">
        <button type="button" className="w-full min-w-0 text-left outline-none" onClick={onToggleExpand}>
          <RowMain group={group} title={title} result={result} failed={failed} />
          <RowContext parts={context} />
        </button>
        <div
          className={cn(
            'grid transition-[grid-template-rows] duration-200 ease-out',
            expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <EventExpand event={event} sessionId={sessionId} />
          </div>
        </div>
      </div>
      <div className="flex items-start gap-0.5">
        {domain ? (
          <Button size="sm" variant="ghost" className="h-7 px-2" asChild>
            <Link to={domain.to} params={{ eventId: domain.eventId }} search={(current) => pickScopeSearch(current)}>
              打开
            </Link>
          </Button>
        ) : null}
        <RowMenu event={event} sessionId={sessionId} onExpand={onToggleExpand} onTraceOnly={onTraceOnly} />
      </div>
    </div>
  );
}

function RowMain({
  group,
  title,
  result,
  failed,
}: {
  group: TimelineFilter;
  title: string;
  result?: string;
  failed: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Badge variant={failed ? 'destructive' : 'secondary'} className="shrink-0">{filterLabel(group)}</Badge>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
      {result ? (
        <span className={cn('shrink-0 text-xs tabular-nums', failed ? 'font-medium text-destructive' : 'text-muted-foreground')}>
          {result}
        </span>
      ) : null}
    </div>
  );
}

function RowContext({ parts }: { parts: string[] }) {
  if (!parts.length) return null;
  return <p className="mt-0.5 truncate text-xs text-muted-foreground">{parts.join(' · ')}</p>;
}

function EventExpand({
  event,
  sessionId,
}: {
  event: MonitorEvent;
  sessionId: string;
}) {
  const facts = expandFacts(event);
  const catalog = domainCatalogLink(event);
  return (
    <div className="mt-2 space-y-2 rounded-md border bg-muted/15 p-3 text-xs">
      {facts.length ? (
        <dl className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-3 gap-y-1.5">
          {facts.map((fact) => (
            <div key={fact.label} className="contents">
              <dt className="text-muted-foreground">{fact.label}</dt>
              <dd className="min-w-0 break-all font-medium">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-muted-foreground">无更多摘要</p>
      )}
      {catalog ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to={catalog.to} search={(current) => ({ ...pickScopeSearch(current), sessionId })}>
              {catalog.label}
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RowMenu({
  event,
  sessionId,
  onExpand,
  onTraceOnly,
}: {
  event: MonitorEvent;
  sessionId: string;
  onExpand: () => void;
  onTraceOnly: () => void;
}) {
  const { showToast } = useToast();
  const domain = domainTarget(event);
  const catalog = domainCatalogLink(event);

  async function copy(label: string, value?: string) {
    if (!value) return;
    try {
      await copyText(value);
      showToast({ tone: 'success', title: `已复制 ${label}` });
    } catch {
      showToast({ tone: 'danger', title: `${label} 复制失败` });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="size-7" aria-label="行操作" onClick={(click) => click.stopPropagation()}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onExpand}>展开 / 收起</DropdownMenuItem>
        {domain ? (
          <DropdownMenuItem asChild>
            <Link to={domain.to} params={{ eventId: domain.eventId }} search={(current) => pickScopeSearch(current)}>
              <ExternalLink />打开{filterLabel(timelineGroup(event))}详情
            </Link>
          </DropdownMenuItem>
        ) : null}
        {event.traceId ? <DropdownMenuItem onSelect={onTraceOnly}><Filter />仅看此 Trace</DropdownMenuItem> : null}
        {catalog ? (
          <DropdownMenuItem asChild>
            <Link to={catalog.to} search={(current) => ({ ...pickScopeSearch(current), sessionId })}>
              <ExternalLink />{catalog.menuLabel}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void copy('事件 ID', event.eventId)} disabled={!event.eventId}>
          <ClipboardCopy />复制事件 ID
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copy('Trace', event.traceId)} disabled={!event.traceId}>
          <ClipboardCopy />复制 Trace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type ScrubberMark = {
  key: string;
  label: string;
  detail?: string;
  failed: boolean;
  segmentId: string;
  eventId?: string;
};

function SessionScrubber({
  marks,
  onJump,
}: {
  marks: ScrubberMark[];
  onJump: (mark: ScrubberMark) => void;
}) {
  return (
    <div className="flex h-full w-[19px] shrink-0 flex-col justify-between py-4 pr-1">
      {marks.map((mark) => (
        <Tooltip key={mark.key}>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="h-[3px] w-[15px] shrink-0 rounded-sm bg-muted-foreground/35 hover:bg-muted-foreground/80"
              onClick={() => onJump(mark)}
              aria-label={mark.label}
            />
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-64">
            <p className="font-medium">{mark.label}</p>
            {mark.detail ? <p className="text-muted-foreground">{mark.detail}</p> : null}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

type SegmentChild =
  | { kind: 'http-fold'; segmentId: string; count: number; failed: number; slow: number; open: boolean }
  | { kind: 'event'; event: MonitorEvent; segmentId: string };

type SegmentView = {
  segment: TimelineSegment;
  children: SegmentChild[];
};

function segmentNodes(
  segment: TimelineSegment,
  filter: TimelineFilter,
  traceOnly: string | undefined,
): MonitorEvent[] {
  return segment.nodes.filter((event) => {
    if (filter !== 'all' && timelineGroup(event) !== filter) return false;
    if (traceOnly && event.traceId !== traceOnly) return false;
    return true;
  });
}

function visibleSegments(
  segments: TimelineSegment[],
  filter: TimelineFilter,
  traceOnly: string | undefined,
): TimelineSegment[] {
  return segments.filter((segment) => segmentNodes(segment, filter, traceOnly).length > 0);
}

function buildSegmentViews(
  segments: TimelineSegment[],
  filter: TimelineFilter,
  traceOnly: string | undefined,
  httpUnfolded: Set<string>,
): SegmentView[] {
  const views: SegmentView[] = [];
  for (const segment of segments) {
    const nodes = segmentNodes(segment, filter, traceOnly);
    if (nodes.length === 0) continue;

    const children: SegmentChild[] = [];
    const foldHttp = filter === 'all'
      && nodes.filter((event) => timelineGroup(event) === 'http').length >= HTTP_FOLD_THRESHOLD;
    if (!foldHttp) {
      for (const event of nodes) children.push({ kind: 'event', event, segmentId: segment.id });
    } else {
      const httpNodes = nodes.filter((event) => timelineGroup(event) === 'http');
      const otherNodes = nodes.filter((event) => timelineGroup(event) !== 'http');
      for (const event of otherNodes) children.push({ kind: 'event', event, segmentId: segment.id });
      const open = httpUnfolded.has(segment.id);
      children.push({
        kind: 'http-fold',
        segmentId: segment.id,
        count: httpNodes.length,
        failed: httpNodes.filter(isFailed).length,
        slow: httpNodes.filter((event) => (event.durationMs ?? 0) >= SLOW_HTTP_MS).length,
        open,
      });
      if (open) {
        for (const event of httpNodes) children.push({ kind: 'event', event, segmentId: segment.id });
      }
    }
    views.push({ segment, children });
  }
  return views;
}

function buildScrubberMarks(
  segments: TimelineSegment[],
  filter: TimelineFilter,
  traceOnly: string | undefined,
): ScrubberMark[] {
  const marks: ScrubberMark[] = [];
  for (const segment of segments) {
    const nodes = segmentNodes(segment, filter, traceOnly);
    if (nodes.length === 0) continue;
    const headline = segment.kind === 'startup'
      ? (segment.durationLabel ?? segment.title)
      : segment.title;
    marks.push({
      key: segment.id,
      label: `${segmentKindLabel(segment.kind)} · ${headline}`,
      detail: [
        segment.durationLabel,
        filter === 'all' ? `${segment.nodeCount} 事件` : `${nodes.length}/${segment.nodeCount} 事件`,
        nodes.some(isFailed) ? `${nodes.filter(isFailed).length} 异常` : undefined,
      ].filter(Boolean).join(' · ') || undefined,
      failed: nodes.some(isFailed),
      segmentId: segment.id,
    });
  }
  return marks;
}

function inPrimaryTimeline(event: MonitorEvent) {
  const group = timelineGroup(event);
  return group === 'startup' || group === 'page' || group === 'http' || group === 'business' || group === 'error';
}

/** 异常 Tab：稳定性错误 + 业务失败；失败 HTTP 不进入。 */
function timelineGroup(event: MonitorEvent): Exclude<TimelineFilter, 'all'> {
  const kind = eventKind(event);
  if (kind === 'http') return 'http';
  if (kind === 'startup') return 'startup';
  if (kind === 'page') return 'page';
  if (readPath(event, ['attributes', 'business.result']) === 'failed') return 'error';
  if (kind === 'business') return 'business';
  if (kind === 'error' || event.signalType === 'error' || event.status === 'error') return 'error';
  return 'page';
}

function filterLabel(filter: TimelineFilter) {
  return ({
    all: '全部',
    startup: '启动',
    page: '页面',
    http: 'HTTP',
    business: '埋点',
    error: '异常',
  })[filter];
}

function segmentKindLabel(kind: TimelineSegment['kind']) {
  return ({ startup: '启动', page: '页面', activity: '活动', sdk: 'SDK' })[kind];
}

function isFailed(event: MonitorEvent) {
  if (eventKind(event) === 'http') {
    return readPath(event, ['attributes', 'http.success']) === false || event.status === 'error';
  }
  if (readPath(event, ['attributes', 'business.result']) === 'failed') return true;
  return eventKind(event) === 'error' || (event.status === 'error' && eventKind(event) !== 'http');
}

function eventTitle(event: MonitorEvent) {
  const kind = eventKind(event);
  if (kind === 'http') {
    const method = String(readPath(event, ['attributes', 'http.method']) ?? 'HTTP');
    const url = stringValue(readPath(event, ['attributes', 'http.url.normalized']))
      ?? stringValue(readPath(event, ['payload', 'url']))
      ?? stringValue(readPath(event, ['attributes', 'http.url']));
    const path = pathOnly(url);
    return `${method} ${path === '请求' ? (url ?? '请求') : path}`;
  }
  if (kind === 'page') {
    return String(readPath(event, ['attributes', 'page.name']) ?? routeOf(event) ?? event.name ?? '页面');
  }
  if (kind === 'startup') {
    if (event.name?.includes('cold')) return '冷启动';
    if (event.name?.includes('hot')) return '热启动';
    return String(event.name ?? '启动');
  }
  if (kind === 'business') {
    return String(readPath(event, ['attributes', 'business.action']) ?? event.name ?? '埋点');
  }
  return String(readPath(event, ['attributes', 'error.type']) ?? event.name ?? '异常');
}

function resultLabel(event: MonitorEvent) {
  const kind = eventKind(event);
  if (kind === 'http') {
    const status = readPath(event, ['attributes', 'http.status_code']);
    const duration = event.durationMs !== undefined ? formatDuration(event.durationMs) : undefined;
    return [typeof status === 'number' ? String(status) : undefined, duration].filter(Boolean).join(' · ') || undefined;
  }
  if (kind === 'business' || readPath(event, ['attributes', 'business.result']) !== undefined) {
    return resultFilterLabel(stringValue(readPath(event, ['attributes', 'business.result'])));
  }
  if (kind === 'error') {
    return stringValue(readPath(event, ['attributes', 'error.type']));
  }
  if (event.durationMs !== undefined) return formatDuration(event.durationMs);
  return undefined;
}

function contextParts(event: MonitorEvent) {
  const route = routeOf(event);
  const user = userIdOf(event);
  const env = environmentOf(event);
  const platform = stringValue(readPath(event, ['resource', 'device', 'platform']));
  const time = formatTime(event.timestamp ?? event.startTime);
  return [
    route !== '-' ? route : undefined,
    user !== '-' ? user : undefined,
    env !== '-' ? env : undefined,
    platform,
    time !== '-' ? time : undefined,
  ].filter((value): value is string => Boolean(value));
}

function expandFacts(event: MonitorEvent): Array<{ label: string; value: ReactNode }> {
  const facts: Array<{ label: string; value: ReactNode }> = [];
  const packageName = stringValue(readPath(event, ['resource', 'app', 'packageName']));
  const appKey = stringValue(readPath(event, ['resource', 'app', 'appKey']));
  const user = userIdOf(event);
  const device = deviceOf(event);
  const env = environmentOf(event);
  const version = stringValue(readPath(event, ['resource', 'app', 'appVersion']));
  const route = routeOf(event);
  const network = networkOf(event);

  facts.push({ label: '时间', value: formatDateTime(event.timestamp ?? event.startTime) });
  if (packageName) facts.push({ label: '包名', value: packageName });
  if (appKey) facts.push({ label: 'AppKey', value: appKey });
  if (user !== '-') facts.push({ label: '用户', value: user });
  if (device !== '-') facts.push({ label: '设备', value: device });
  if (env !== '-') facts.push({ label: '环境', value: env });
  if (version) facts.push({ label: '版本', value: version });
  if (route !== '-') facts.push({ label: '路由', value: route });
  if (network !== '-') facts.push({ label: '网络', value: network });

  if (eventKind(event) === 'http') {
    facts.push(
      { label: '状态码', value: String(readPath(event, ['attributes', 'http.status_code']) ?? '-') },
      { label: '业务码', value: stringValue(readPath(event, ['attributes', 'http.business_code'])) ?? '-' },
      { label: '耗时', value: event.durationMs !== undefined ? formatDuration(event.durationMs) : '-' },
    );
  }
  if (eventKind(event) === 'business') {
    facts.push(
      { label: '动作', value: stringValue(readPath(event, ['attributes', 'business.action'])) ?? '-' },
      { label: '结果', value: resultFilterLabel(stringValue(readPath(event, ['attributes', 'business.result']))) },
    );
  }
  if (eventKind(event) === 'error' || timelineGroup(event) === 'error') {
    const message = stringValue(readPath(event, ['payload', 'payload.error.message']))
      ?? stringValue(readPath(event, ['payload', 'message']))
      ?? '-';
    facts.push({ label: '消息', value: message });
  }
  return facts;
}

function domainTarget(event: MonitorEvent): {
  to: '/http/$eventId' | '/business/$eventId' | '/errors/$eventId';
  eventId: string;
} | undefined {
  if (!event.eventId) return undefined;
  const group = timelineGroup(event);
  if (group === 'http') return { to: '/http/$eventId', eventId: event.eventId };
  if (group === 'business') return { to: '/business/$eventId', eventId: event.eventId };
  if (group === 'error') return { to: '/errors/$eventId', eventId: event.eventId };
  return undefined;
}

function domainCatalogLink(event: MonitorEvent): {
  to: '/http' | '/business' | '/errors';
  label: string;
  menuLabel: string;
} | undefined {
  const group = timelineGroup(event);
  if (group === 'http') {
    return { to: '/http', label: '在 HTTP 列表看本 Session', menuLabel: 'HTTP 列表（本 Session）' };
  }
  if (group === 'business') {
    return { to: '/business', label: '在埋点列表看本 Session', menuLabel: '埋点列表（本 Session）' };
  }
  if (group === 'error') {
    return { to: '/errors', label: '在异常列表看本 Session', menuLabel: '异常列表（本 Session）' };
  }
  return undefined;
}

function traceRailColor(traceId: string | undefined, failed: boolean) {
  if (failed) return 'hsl(var(--destructive))';
  if (!traceId) return 'hsl(var(--border))';
  let hash = 0;
  for (let i = 0; i < traceId.length; i += 1) hash = (hash * 31 + traceId.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue} 45% 55%)`;
}

function parseIdSet(value?: string): Set<string> {
  if (!value) return new Set();
  return new Set(value.split(',').map((item) => item.trim()).filter(Boolean));
}

function serializeIdSet(ids: Set<string>): string | undefined {
  if (ids.size === 0) return undefined;
  return [...ids].join(',');
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}

export function SessionWorkspaceEmpty({
  title,
  description,
  danger,
}: {
  title: string;
  description: string;
  danger?: boolean;
}) {
  return (
    <Empty className="h-full border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon" className={danger ? 'text-destructive' : undefined}>
          {danger ? <AlertTriangle /> : <GitBranch />}
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
