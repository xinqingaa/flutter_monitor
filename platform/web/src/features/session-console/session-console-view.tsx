import {
  Activity,
  ChevronDown,
  ChevronRight,
  Layers3,
  Maximize2,
  Search,
  ServerCog,
  Settings2,
  Timer,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { EmptyState } from '../../components/common/empty-state';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader } from '../../components/ui/card';
import { IconTooltipButton } from '../../components/ui/icon-tooltip-button';
import { Input } from '../../components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import type {
  SessionConsoleMetric,
  SessionConsoleResult,
  SessionConsoleRow,
  SessionConsoleSegment,
  SessionProblemChip,
} from '../../shared/datasource/types';
import { cn } from '../../shared/formatting/cn';
import { formatDuration, formatTime } from '../../shared/formatting/format';
import { NodePeekPopover } from './node-peek-popover';
import { groupLabel, groupTone, iconClass, issueTone, primaryStatusBadge, rowIcon } from './row-display';

type FilterKey = 'all' | 'problems' | 'pages' | 'http' | 'startup' | 'interaction' | 'business' | 'memory' | 'lifecycle' | 'sdk';
type FilterItem = { key: FilterKey; label: string };
type ScrollReason = 'user-click' | 'external' | 'live';
type PendingScroll = { type: 'row' | 'segment'; id: string; reason: ScrollReason };
type ChipKind = SessionProblemChip['kind'];

type StreamBlock =
  | { kind: 'row'; row: SessionConsoleRow }
  | { kind: 'page-card'; instanceId: string; main: SessionConsoleRow; auxiliary: SessionConsoleRow[] };

const filters: FilterItem[] = [
  { key: 'all', label: '全部' },
  { key: 'problems', label: '问题' },
  { key: 'pages', label: '页面' },
  { key: 'http', label: 'HTTP' },
  { key: 'startup', label: '启动' },
  { key: 'interaction', label: '交互性能' },
  { key: 'business', label: '业务埋点' },
  { key: 'memory', label: '内存' },
  { key: 'lifecycle', label: '生命周期' },
  { key: 'sdk', label: 'SDK' },
];

const tabStorageKey = 'flutter-monitor.session-console.enabled-tabs';
const defaultEnabledTabs: FilterKey[] = ['all', 'pages', 'http', 'business'];
const lockedTabs = new Set<FilterKey>(defaultEnabledTabs);
const filterKeySet = new Set<FilterKey>(filters.map((item) => item.key));
const tabConfigFilters: FilterItem[] = [
  ...defaultEnabledTabs
    .filter((key) => key !== 'all')
    .map((key) => filters.find((item) => item.key === key))
    .filter((item): item is FilterItem => Boolean(item)),
  ...filters.filter((item) => item.key !== 'all' && !lockedTabs.has(item.key)),
];

const tabChipKinds: Record<FilterKey, ChipKind[]> = {
  all: ['error', 'business_failure', 'failed_http', 'slow_http', 'slow_page', 'jank', 'memory', 'sdk_drop', 'sdk_retry', 'sdk_flush_failure', 'detail_dropped'],
  problems: ['error', 'business_failure', 'slow_page', 'jank'],
  pages: ['slow_page'],
  http: ['failed_http', 'slow_http', 'detail_dropped'],
  startup: [],
  interaction: [],
  business: ['business_failure'],
  memory: ['memory'],
  lifecycle: [],
  sdk: ['sdk_drop', 'sdk_retry', 'sdk_flush_failure'],
};

function readEnabledTabs(): Set<FilterKey> {
  if (typeof window === 'undefined') return new Set(defaultEnabledTabs);
  const stored = window.localStorage.getItem(tabStorageKey);
  if (!stored) return new Set(defaultEnabledTabs);
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return new Set(defaultEnabledTabs);
    const next = parsed.filter((key): key is FilterKey => filterKeySet.has(key));
    return new Set([...defaultEnabledTabs, ...next]);
  } catch {
    return new Set(defaultEnabledTabs);
  }
}

function writeEnabledTabs(tabs: Set<FilterKey>) {
  if (typeof window === 'undefined') return;
  const ordered = filters.map((item) => item.key).filter((key) => tabs.has(key));
  window.localStorage.setItem(tabStorageKey, JSON.stringify(ordered));
}

function tabPredicate(filter: FilterKey, row: SessionConsoleRow): boolean {
  if (filter === 'all') return true;
  if (filter === 'problems') return row.issueLabels.length > 0 || row.group === 'problem';
  if (filter === 'pages') return row.group === 'page';
  if (filter === 'http') return row.group === 'http';
  if (filter === 'startup') return row.group === 'startup';
  if (filter === 'interaction') return row.group === 'interaction';
  if (filter === 'business') return row.group === 'business';
  if (filter === 'memory') return row.group === 'memory';
  if (filter === 'lifecycle') return row.group === 'lifecycle';
  if (filter === 'sdk') return row.group === 'sdk';
  return true;
}

function chipPredicate(kind: ChipKind): (row: SessionConsoleRow) => boolean {
  switch (kind) {
    case 'error':
      return (row) => row.issueLabels.includes('错误');
    case 'business_failure':
      return (row) => row.issueLabels.includes('业务失败');
    case 'failed_http':
      return (row) => row.issueLabels.includes('请求失败');
    case 'slow_http':
      return (row) => row.issueLabels.includes('慢请求');
    case 'slow_page':
      return (row) => row.issueLabels.includes('页面慢');
    case 'jank':
      return (row) => row.issueLabels.includes('卡顿');
    case 'memory':
      return (row) => row.group === 'memory' && row.issueLabels.length > 0;
    case 'sdk_drop':
      return (row) => row.issueLabels.includes('SDK 丢弃');
    case 'sdk_retry':
      return (row) => row.issueLabels.includes('SDK 重试');
    case 'sdk_flush_failure':
      return (row) => row.issueLabels.includes('SDK 发送失败');
    case 'detail_dropped':
      return (row) => row.detailDropped === true;
    default:
      return () => false;
  }
}

function isPageEntryRow(row: SessionConsoleRow): boolean {
  if (row.group !== 'page' || !row.pageInstanceId) return false;
  if (row.name === 'page.visit') return row.phase !== 'end';
  if (row.name === 'page.load') return true;
  if (row.name === 'page.view') return true;
  if (row.name === 'route.push') return true;
  return false;
}

function pickMainRow(rows: SessionConsoleRow[]): SessionConsoleRow {
  return (
    rows.find((r) => r.name === 'page.visit' && r.phase === 'start') ??
    rows.find((r) => r.name === 'page.visit') ??
    rows.find((r) => r.name === 'page.load') ??
    rows[0]
  );
}

function buildBlocks(rows: SessionConsoleRow[]): StreamBlock[] {
  const blocks: StreamBlock[] = [];
  let pending: { instanceId: string; rows: SessionConsoleRow[] } | undefined;
  const flush = () => {
    if (!pending) return;
    if (pending.rows.length <= 1) {
      blocks.push({ kind: 'row', row: pending.rows[0] });
    } else {
      const main = pickMainRow(pending.rows);
      const auxiliary = pending.rows.filter((r) => r !== main);
      blocks.push({ kind: 'page-card', instanceId: pending.instanceId, main, auxiliary });
    }
    pending = undefined;
  };
  for (const row of rows) {
    if (isPageEntryRow(row)) {
      const id = row.pageInstanceId as string;
      if (!pending || pending.instanceId !== id) {
        flush();
        pending = { instanceId: id, rows: [row] };
      } else {
        pending.rows.push(row);
      }
    } else {
      flush();
      blocks.push({ kind: 'row', row });
    }
  }
  flush();
  return blocks;
}

export function SessionConsoleView({
  consoleData,
  selectedEventId,
  onSelectEvent,
  inspectorCollapsed = false,
  onOpenHttpDetail,
  onExpandInspector,
}: {
  consoleData?: SessionConsoleResult;
  selectedEventId?: string;
  onSelectEvent: (eventId: string) => void;
  inspectorCollapsed?: boolean;
  onOpenHttpDetail?: (eventId: string) => void;
  onExpandInspector?: () => void;
}) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [enabledTabs, setEnabledTabs] = useState<Set<FilterKey>>(readEnabledTabs);
  const [tabConfigOpen, setTabConfigOpen] = useState(false);
  const [pageOverrides, setPageOverrides] = useState<Record<string, boolean>>({});
  const [peekEventId, setPeekEventId] = useState<string>();
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const segmentRefs = useRef(new Map<string, HTMLElement>());
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollRef = useRef<PendingScroll | undefined>(undefined);
  const previousSelectedRef = useRef<string | undefined>(undefined);
  const previousRowsCountRef = useRef(0);

  const closePeek = useCallback(() => setPeekEventId(undefined), []);

  const visibleFilters = useMemo(
    () => filters.filter((item) => item.key === 'all' || enabledTabs.has(item.key)),
    [enabledTabs],
  );

  const toggleTab = useCallback((key: FilterKey) => {
    if (lockedTabs.has(key)) return;
    setEnabledTabs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      for (const tab of lockedTabs) next.add(tab);
      return next;
    });
  }, []);

  const resetTabs = useCallback(() => {
    setEnabledTabs(new Set(defaultEnabledTabs));
  }, []);

  useEffect(() => {
    if (!inspectorCollapsed) setPeekEventId(undefined);
  }, [inspectorCollapsed]);

  useEffect(() => {
    writeEnabledTabs(enabledTabs);
  }, [enabledTabs]);

  useEffect(() => {
    if (filter !== 'all' && !enabledTabs.has(filter)) setFilter('all');
  }, [enabledTabs, filter]);

  useEffect(() => {
    setPeekEventId(undefined);
  }, [filter, query]);

  useEffect(() => {
    if (!peekEventId) return;
    const container = logContainerRef.current;
    if (!container) return;
    const handleWheel = () => setPeekEventId(undefined);
    container.addEventListener('wheel', handleWheel, { passive: true });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [peekEventId]);

  const rowsById = useMemo(
    () => new Map((consoleData?.rows ?? []).map((row) => [row.eventId, row])),
    [consoleData?.rows],
  );

  const rows = useMemo(
    () => filterRows(consoleData?.rows ?? [], filter, query),
    [consoleData?.rows, filter, query],
  );

  const visibleEventIds = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) if (row.eventId) set.add(row.eventId);
    return set;
  }, [rows]);

  const visibleSegments = useMemo(() => {
    if (!consoleData) return [];
    return consoleData.segments
      .map((segment) => {
        const tabRows = segment.rows.filter((eventId) => visibleEventIds.has(eventId));
        return { segment, tabRows };
      })
      .filter((entry) => entry.tabRows.length > 0);
  }, [consoleData, visibleEventIds]);

  useEffect(() => {
    const pending = pendingScrollRef.current;
    if (pending) {
      const node = pending.type === 'row'
        ? rowRefs.current.get(pending.id)
        : segmentRefs.current.get(pending.id);
      if (node) {
        pendingScrollRef.current = undefined;
        const block: ScrollLogicalPosition = pending.reason === 'user-click' ? 'nearest' : 'center';
        window.requestAnimationFrame(() => node.scrollIntoView({ block, behavior: 'smooth' }));
        previousSelectedRef.current = selectedEventId;
        previousRowsCountRef.current = rows.length;
        return;
      }
    }
    if (selectedEventId && selectedEventId !== previousSelectedRef.current) {
      const node = rowRefs.current.get(selectedEventId);
      if (node) {
        previousSelectedRef.current = selectedEventId;
        previousRowsCountRef.current = rows.length;
        window.requestAnimationFrame(() => node.scrollIntoView({ block: 'center', behavior: 'smooth' }));
        return;
      }
    }
    const prevCount = previousRowsCountRef.current;
    previousRowsCountRef.current = rows.length;
    const container = logContainerRef.current;
    if (!container || rows.length <= prevCount) return;
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distance < 80) {
      window.requestAnimationFrame(() => {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [rows, selectedEventId]);

  const selectEvent = useCallback((eventId: string) => {
    onSelectEvent(eventId);
    const target = rowsById.get(eventId);
    if (inspectorCollapsed && target?.group === 'http') {
      onOpenHttpDetail?.(eventId);
      setPeekEventId(undefined);
    } else if (inspectorCollapsed && target) {
      // 非 HTTP 节点收起态：直接展开右侧 Inspector
      onExpandInspector?.();
      setPeekEventId(undefined);
      // 备用方案：popover 形态预留，需要时取消下行注释、并注释上面的 onExpandInspector 调用
      // setPeekEventId((current) => (current === eventId ? undefined : eventId));
    } else {
      setPeekEventId(undefined);
    }
    if (target && filter !== 'all' && !tabPredicate(filter, target)) {
      setFilter('all');
    }
    pendingScrollRef.current = { type: 'row', id: eventId, reason: 'user-click' };
  }, [filter, inspectorCollapsed, onExpandInspector, onOpenHttpDetail, onSelectEvent, rowsById]);

  const selectSegment = useCallback((segment: SessionConsoleSegment) => {
    const visibleFirst = segment.rows.find((eventId) => visibleEventIds.has(eventId));
    const targetEventId = visibleFirst ?? segment.rows[0];
    if (targetEventId) {
      const target = rowsById.get(targetEventId);
      onSelectEvent(targetEventId);
      if (target && filter !== 'all' && !tabPredicate(filter, target)) {
        setFilter('all');
      }
    }
    setPeekEventId(undefined);
    pendingScrollRef.current = { type: 'segment', id: segment.id, reason: 'user-click' };
  }, [filter, onSelectEvent, rowsById, visibleEventIds]);

  const togglePageInstance = useCallback((instanceId: string, expandedNow: boolean) => {
    setPageOverrides((prev) => ({ ...prev, [instanceId]: !expandedNow }));
  }, []);

  if (!consoleData) {
    return (
      <Card className="h-full min-h-0">
        <CardContent className="grid h-full min-h-0 place-items-center p-3">
          <EmptyState title="正在读取会话链路" description="等待 Monitor Service 返回 Session Console 摘要。" />
        </CardContent>
      </Card>
    );
  }

  const tabChipMap = chipsByTab(consoleData.problemChips);
  const peekRow = peekEventId ? rowsById.get(peekEventId) : undefined;
  const peekAnchor = peekEventId ? rowRefs.current.get(peekEventId) ?? null : null;

  return (
    <Card className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader className="grid gap-2 py-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {visibleFilters.map((item) => {
              const tabChips = tabChipMap[item.key] ?? [];
              const count = tabChips.reduce((sum, chip) => sum + chip.count, 0);
              const active = filter === item.key;
              const button = (
                <Button
                  key={item.key}
                  type="button"
                  size="sm"
                  variant={active ? 'default' : 'secondary'}
                  className="h-7 gap-1.5 px-3"
                  onClick={() => setFilter(item.key)}
                >
                  <span>{item.label}</span>
                  {count > 0 ? (
                    <span
                      className={cn(
                        'inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums',
                        active ? 'bg-white/20 text-white' : 'bg-teal-500 text-white',
                      )}
                    >
                      {count}
                    </span>
                  ) : null}
                </Button>
              );
              if (count === 0) return button;
              return (
                <Tooltip key={item.key}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent className="space-y-0.5">
                    <div className="text-[11px] font-semibold text-zinc-100">{item.label} · 共 {count}</div>
                    {tabChips.map((chip) => (
                      <div key={chip.kind} className="flex items-center gap-2 text-[11px]">
                        <span className="text-zinc-300">{chip.label}</span>
                        <span className="tabular-nums text-zinc-50">{chip.count}</span>
                      </div>
                    ))}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <label className="relative min-w-0 lg:w-72">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="筛选 title/url/route/eventId"
                className="h-8 pl-7 text-xs"
              />
            </label>
            <div className="relative shrink-0">
              <IconTooltipButton
                label="配置会话链路 tab"
                icon={Settings2}
                variant={tabConfigOpen ? 'default' : 'secondary'}
                size="icon"
                className="h-8 w-8"
                onClick={() => setTabConfigOpen((open) => !open)}
              />
              {tabConfigOpen ? (
                <div className="absolute right-0 top-9 z-30 w-48 rounded-md border border-zinc-200 bg-white p-2 shadow-lg">
                  <div className="px-1 pb-1 text-[11px] font-semibold text-zinc-500">显示 tab</div>
                  <div className="grid gap-1">
                    {tabConfigFilters.map((item) => (
                      <TabOption
                        key={item.key}
                        item={item}
                        checked={enabledTabs.has(item.key)}
                        locked={lockedTabs.has(item.key)}
                        onToggle={() => toggleTab(item.key)}
                      />
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="mt-1 h-7 w-full text-xs"
                    onClick={resetTabs}
                  >
                    恢复默认
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </CardHeader>

      <div className="grid min-h-0 grid-cols-1 overflow-hidden bg-zinc-50 xl:grid-cols-[250px_minmax(0,1fr)]">
        <SessionNavigator
          visibleSegments={visibleSegments}
          totalSegments={consoleData.segments.length}
          selectedEventId={selectedEventId}
          onSelectSegment={selectSegment}
        />
        <LogStream
          containerRef={logContainerRef}
          rows={rows}
          rowsById={rowsById}
          visibleSegments={visibleSegments}
          selectedEventId={selectedEventId}
          pageOverrides={pageOverrides}
          onTogglePageInstance={togglePageInstance}
          onSelectEvent={selectEvent}
          inspectorCollapsed={inspectorCollapsed}
          onOpenHttpDetail={onOpenHttpDetail}
          onExpandInspector={onExpandInspector}
          setRowRef={(eventId, node) => {
            if (node) rowRefs.current.set(eventId, node);
            else rowRefs.current.delete(eventId);
          }}
          setSegmentRef={(segmentId, node) => {
            if (node) segmentRefs.current.set(segmentId, node);
            else segmentRefs.current.delete(segmentId);
          }}
        />
      </div>
      <NodePeekPopover
        row={peekRow}
        anchorEl={peekAnchor}
        open={Boolean(peekRow && peekAnchor)}
        onClose={closePeek}
        onExpandInspector={onExpandInspector}
      />
    </Card>
  );
}

function chipsByTab(chips: SessionProblemChip[]): Partial<Record<FilterKey, SessionProblemChip[]>> {
  const result: Partial<Record<FilterKey, SessionProblemChip[]>> = {};
  for (const tab of filters) {
    if (tab.key === 'all') continue;
    const kinds = tabChipKinds[tab.key];
    const matched = chips.filter((chip) => kinds.includes(chip.kind) && chip.count > 0);
    if (matched.length > 0) result[tab.key] = matched;
  }
  return result;
}

function TabOption({
  item,
  checked,
  locked,
  onToggle,
}: {
  item: FilterItem;
  checked: boolean;
  locked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs',
        locked
          ? 'cursor-not-allowed bg-zinc-50 text-zinc-400'
          : 'cursor-pointer text-zinc-700 hover:bg-zinc-50',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={locked}
        onChange={onToggle}
        className="size-3.5 accent-teal-600 disabled:cursor-not-allowed"
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {locked ? <span className="text-[10px] text-zinc-400">固定</span> : null}
    </label>
  );
}

function SessionNavigator({
  visibleSegments,
  totalSegments,
  selectedEventId,
  onSelectSegment,
}: {
  visibleSegments: Array<{ segment: SessionConsoleSegment; tabRows: string[] }>;
  totalSegments: number;
  selectedEventId?: string;
  onSelectSegment: (segment: SessionConsoleSegment) => void;
}) {
  return (
    <aside className="grid min-h-[220px] grid-rows-[auto_minmax(0,1fr)] border-b border-zinc-200 bg-white xl:min-h-0 xl:border-b-0 xl:border-r">
      <div className="border-b border-zinc-100 px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
          <Layers3 className="size-3.5" />
          会话分段
        </div>
        <div className="mt-0.5 text-[11px] text-zinc-400">
          {visibleSegments.length} / {totalSegments} 段在当前视图
        </div>
      </div>
      <div className="min-h-0 overflow-auto p-3">
        {visibleSegments.length === 0 ? (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-3 text-center text-[11px] text-zinc-500">
            当前筛选下没有匹配的会话分段。
          </div>
        ) : (
          <div className="grid gap-1.5">
            {visibleSegments.map(({ segment, tabRows }) => {
              const active = selectedEventId !== undefined && segment.rows.includes(selectedEventId);
              const filtered = tabRows.length !== segment.eventCount;
              return (
                <button
                  key={segment.id}
                  type="button"
                  onClick={() => onSelectSegment(segment)}
                  className={cn(
                    'grid min-w-0 gap-1 rounded-md border px-2 py-2 text-left hover:bg-zinc-50',
                    active ? 'border-teal-300 bg-teal-50' : 'border-zinc-200 bg-white',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={cn('inline-flex size-6 shrink-0 items-center justify-center rounded-md border', segmentIconClass(segment, active))}>
                      <SegmentIcon segment={segment} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-zinc-950">{segment.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                        {[
                          formatDuration(segment.durationMs),
                          filtered ? `${tabRows.length}/${segment.eventCount} 事件` : `${segment.eventCount} 事件`,
                          segment.issueCount > 0 ? `${segment.issueCount} 问题` : undefined,
                        ].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

function LogStream({
  containerRef,
  rows,
  rowsById,
  visibleSegments,
  selectedEventId,
  pageOverrides,
  onTogglePageInstance,
  onSelectEvent,
  inspectorCollapsed,
  onOpenHttpDetail,
  onExpandInspector,
  setRowRef,
  setSegmentRef,
}: {
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  rows: SessionConsoleRow[];
  rowsById: Map<string | undefined, SessionConsoleRow>;
  visibleSegments: Array<{ segment: SessionConsoleSegment; tabRows: string[] }>;
  selectedEventId?: string;
  pageOverrides: Record<string, boolean>;
  onTogglePageInstance: (instanceId: string, expandedNow: boolean) => void;
  onSelectEvent: (eventId: string) => void;
  inspectorCollapsed: boolean;
  onOpenHttpDetail?: (eventId: string) => void;
  onExpandInspector?: () => void;
  setRowRef: (eventId: string, node: HTMLButtonElement | null) => void;
  setSegmentRef: (segmentId: string, node: HTMLElement | null) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="grid h-full min-h-[240px] place-items-center p-3">
        <EmptyState title="没有匹配的日志" description="换一个筛选条件，或清空搜索关键字。" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-0 overflow-auto bg-zinc-50 p-2">
      <div className="grid gap-2">
        {visibleSegments.map(({ segment, tabRows }) => {
          const segmentRows = tabRows
            .map((eventId) => rowsById.get(eventId))
            .filter((row): row is SessionConsoleRow => Boolean(row));
          if (segmentRows.length === 0) return null;
          const blocks = buildBlocks(segmentRows);
          const filtered = tabRows.length !== segment.eventCount;
          return (
            <section
              key={segment.id}
              ref={(node) => setSegmentRef(segment.id, node)}
              className="overflow-hidden rounded-md border border-zinc-200 bg-white"
            >
              <div className="grid gap-1 border-b border-zinc-100 bg-zinc-50 px-3 py-2">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600">
                      <SegmentIcon segment={segment} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-950">{segment.title}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {[
                          formatDuration(segment.durationMs),
                          filtered ? `${tabRows.length}/${segment.eventCount} 事件` : `${segment.eventCount} 事件`,
                          segment.issueCount > 0 ? `${segment.issueCount} 问题` : undefined,
                        ].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-zinc-100">
                {blocks.map((block, index) => {
                  if (block.kind === 'row') {
                    return (
                      <LogRow
                        key={block.row.eventId ?? `${block.row.timestamp}-${block.row.title}-${index}`}
                        row={block.row}
                        selected={selectedEventId === block.row.eventId}
                        onSelectEvent={onSelectEvent}
                        inspectorCollapsed={inspectorCollapsed}
                        onOpenHttpDetail={onOpenHttpDetail}
                        onExpandInspector={onExpandInspector}
                        setRowRef={setRowRef}
                      />
                    );
                  }
                  const auxSelected = block.auxiliary.some((r) => r.eventId === selectedEventId);
                  const override = pageOverrides[block.instanceId];
                  const expanded = override ?? auxSelected;
                  return (
                    <PageInstanceCard
                      key={`${block.instanceId}-${index}`}
                      block={block}
                      expanded={expanded}
                      onToggle={() => onTogglePageInstance(block.instanceId, expanded)}
                      selectedEventId={selectedEventId}
                      onSelectEvent={onSelectEvent}
                      inspectorCollapsed={inspectorCollapsed}
                      onOpenHttpDetail={onOpenHttpDetail}
                      onExpandInspector={onExpandInspector}
                      setRowRef={setRowRef}
                    />
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function LogRow({
  row,
  selected,
  onSelectEvent,
  inspectorCollapsed = false,
  onOpenHttpDetail,
  onExpandInspector,
  setRowRef,
  indented = false,
  showRoute = false,
}: {
  row: SessionConsoleRow;
  selected: boolean;
  onSelectEvent: (eventId: string) => void;
  inspectorCollapsed?: boolean;
  onOpenHttpDetail?: (eventId: string) => void;
  onExpandInspector?: () => void;
  setRowRef: (eventId: string, node: HTMLButtonElement | null) => void;
  indented?: boolean;
  showRoute?: boolean;
}) {
  const Icon = rowIcon(row);
  const statusBadge = primaryStatusBadge(row);
  const visibleMetrics = useMemo(
    () => row.metrics.filter((metric) => metric.label !== '耗时'),
    [row.metrics],
  );
  const rowAction = pickRowAction(row, inspectorCollapsed, onOpenHttpDetail);
  return (
    <div
      className={cn(
        'grid w-full min-w-0',
        rowAction ? 'grid-cols-[minmax(0,1fr)_auto]' : 'grid-cols-1',
        selected && 'bg-teal-50',
      )}
    >
      <button
        ref={(node) => {
          if (row.eventId) setRowRef(row.eventId, node);
        }}
        type="button"
        disabled={!row.eventId}
        onClick={() => row.eventId && onSelectEvent(row.eventId)}
        className={cn(
          'grid w-full min-w-0 grid-cols-[64px_28px_minmax(0,1fr)] gap-2 px-3 py-2 text-left hover:bg-zinc-50',
          indented && 'pl-9',
          selected && 'bg-teal-50 hover:bg-teal-50',
        )}
      >
        <span className="pt-0.5 text-xs tabular-nums text-zinc-500">{formatTime(row.timestamp ?? row.startTime)}</span>
        <span className={cn('mt-0.5 inline-flex size-6 items-center justify-center rounded-md border', iconClass(row))}>
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="min-w-0 truncate text-sm font-semibold text-zinc-950">{row.title}</span>
            <Badge tone={groupTone(row.group)} className="rounded-md px-1.5 py-0 text-[11px]">{groupLabel(row.group)}</Badge>
            {statusBadge ? (
              <Badge tone={statusBadge.tone} className="rounded-md px-1.5 py-0 text-[11px]">
                {statusBadge.label}
              </Badge>
            ) : null}
            {row.durationMs !== undefined ? (
              <Badge tone={row.durationMs >= 1000 ? 'warn' : 'neutral'} className="rounded-md px-1.5 py-0 text-[11px]">
                {formatDuration(row.durationMs)}
              </Badge>
            ) : null}
            {row.issueLabels.map((label) => (
              <Badge key={label} tone={issueTone(label)} className="rounded-md px-1.5 py-0 text-[11px]">
                {label}
              </Badge>
            ))}
          </span>
          <MetricStrip metrics={visibleMetrics} />
          {showRoute && row.route ? (
            <span className="mt-1 block truncate text-[11px] text-zinc-400">route {row.route}</span>
          ) : null}
        </span>
      </button>
      {rowAction ? (
        <div className="flex items-center pr-3">
          <IconTooltipButton
            type="button"
            variant="secondary"
            size="icon"
            label={rowAction.label}
            icon={rowAction.icon}
            onClick={(event: MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              rowAction.onClick();
            }}
            className="h-8 w-8"
          />
        </div>
      ) : null}
    </div>
  );
}

function PageInstanceCard({
  block,
  expanded,
  onToggle,
  selectedEventId,
  onSelectEvent,
  inspectorCollapsed,
  onOpenHttpDetail,
  onExpandInspector,
  setRowRef,
}: {
  block: Extract<StreamBlock, { kind: 'page-card' }>;
  expanded: boolean;
  onToggle: () => void;
  selectedEventId?: string;
  onSelectEvent: (eventId: string) => void;
  inspectorCollapsed: boolean;
  onOpenHttpDetail?: (eventId: string) => void;
  onExpandInspector?: () => void;
  setRowRef: (eventId: string, node: HTMLButtonElement | null) => void;
}) {
  const { main, auxiliary } = block;
  const Icon = rowIcon(main);
  const auxLabels = useMemo(
    () => buildAuxLabels(auxiliary),
    [auxiliary],
  );
  const visibleMetrics = useMemo(
    () => main.metrics.filter((metric) => metric.label !== '耗时'),
    [main.metrics],
  );
  const mainAction = pickRowAction(main, inspectorCollapsed, onOpenHttpDetail);

  return (
    <div className="bg-white">
      <div
        className={cn(
          'grid w-full items-start gap-2 px-3 py-2 hover:bg-zinc-50',
          mainAction
            ? 'grid-cols-[64px_28px_minmax(0,1fr)_auto_auto]'
            : 'grid-cols-[64px_28px_minmax(0,1fr)_auto]',
          selectedEventId === main.eventId && 'bg-teal-50 hover:bg-teal-50',
        )}
      >
        <button
          ref={(node) => {
            if (main.eventId) setRowRef(main.eventId, node);
          }}
          type="button"
          disabled={!main.eventId}
          onClick={() => main.eventId && onSelectEvent(main.eventId)}
          className="contents text-left"
        >
          <span className="pt-0.5 text-xs tabular-nums text-zinc-500">{formatTime(main.timestamp ?? main.startTime)}</span>
          <span className={cn('mt-0.5 inline-flex size-6 items-center justify-center rounded-md border', iconClass(main))}>
            <Icon className="size-3.5" />
          </span>
          <span className="min-w-0">
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="min-w-0 truncate text-sm font-semibold text-zinc-950">{main.title}</span>
              <Badge tone="teal" className="rounded-md px-1.5 py-0 text-[11px]">页面</Badge>
              {main.durationMs !== undefined ? (
                <Badge tone="neutral" className="rounded-md px-1.5 py-0 text-[11px]">{formatDuration(main.durationMs)}</Badge>
              ) : null}
              {main.issueLabels.map((label) => (
                <Badge key={label} tone={issueTone(label)} className="rounded-md px-1.5 py-0 text-[11px]">
                  {label}
                </Badge>
              ))}
            </span>
            <MetricStrip metrics={visibleMetrics} />
            {auxLabels.length > 0 ? (
              <span className="mt-1 flex min-w-0 flex-wrap gap-1 text-[11px] text-zinc-500">
                {auxLabels.map((label) => (
                  <span key={label} className="rounded-md border border-dashed border-zinc-200 px-1.5 py-0.5">
                    {label}
                  </span>
                ))}
              </span>
            ) : null}
          </span>
        </button>
        {mainAction ? (
          <IconTooltipButton
            type="button"
            variant="secondary"
            size="icon"
            label={mainAction.label}
            icon={mainAction.icon}
            onClick={(event: MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              mainAction.onClick();
            }}
            className="mt-0.5 h-8 w-8"
          />
        ) : null}
        {auxiliary.length > 0 ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="mt-0.5 inline-flex size-6 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 hover:bg-zinc-50"
            title={expanded ? '折叠子事件' : `展开 ${auxiliary.length} 个子事件`}
          >
            {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        ) : <span />}
      </div>
      {expanded && auxiliary.length > 0 ? (
        <div className="border-t border-dashed border-zinc-100 bg-zinc-50/50">
          {auxiliary.map((row) => (
            <LogRow
              key={row.eventId ?? `${row.timestamp}-${row.title}`}
              row={row}
              selected={selectedEventId === row.eventId}
              onSelectEvent={onSelectEvent}
              inspectorCollapsed={inspectorCollapsed}
              onOpenHttpDetail={onOpenHttpDetail}
              onExpandInspector={onExpandInspector}
              setRowRef={setRowRef}
              indented
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

type RowAction = {
  label: string;
  icon: typeof Maximize2;
  onClick: () => void;
};

function pickRowAction(
  row: SessionConsoleRow,
  inspectorCollapsed: boolean,
  onOpenHttpDetail?: (eventId: string) => void,
): RowAction | undefined {
  if (!inspectorCollapsed || !row.eventId) return undefined;
  if (row.group === 'http' && onOpenHttpDetail) {
    return {
      label: '打开 HTTP 详情',
      icon: Maximize2,
      onClick: () => onOpenHttpDetail(row.eventId as string),
    };
  }
  return undefined;
}

function buildAuxLabels(rows: SessionConsoleRow[]): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    let key: string | undefined;
    if (row.name === 'route.push') key = '路由';
    else if (row.name === 'page.load') key = '加载';
    else if (row.name === 'page.view') key = '足迹';
    else key = row.name ?? row.title;
    if (key && !seen.has(key)) {
      seen.add(key);
      labels.push(key);
    }
  }
  return labels;
}

function MetricStrip({ metrics, compact = false }: { metrics: SessionConsoleMetric[]; compact?: boolean }) {
  if (metrics.length === 0) return null;
  return (
    <span className={cn('mt-1 flex min-w-0 flex-wrap gap-1', compact && 'mt-0.5')}>
      {metrics.map((metric) => (
        <span
          key={`${metric.label}-${metric.value}`}
          className={cn(
            'inline-flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px]',
            metricToneClass(metric.tone),
          )}
        >
          <span className="text-zinc-500">{metric.label}</span>
          <span className="max-w-[180px] truncate font-medium text-zinc-900">{metric.value}</span>
        </span>
      ))}
    </span>
  );
}

function filterRows(
  rows: SessionConsoleRow[],
  filter: FilterKey,
  query: string,
): SessionConsoleRow[] {
  const normalized = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (!tabPredicate(filter, row)) return false;
    if (!normalized) return true;
    return [
      row.title,
      row.route,
      row.url,
      row.method,
      row.status,
      row.name,
      row.eventId,
      row.traceId,
      ...row.metrics.flatMap((metric) => [metric.label, metric.value]),
    ].filter(Boolean).join(' ').toLowerCase().includes(normalized);
  });
}

function SegmentIcon({ segment }: { segment: SessionConsoleSegment }) {
  if (segment.kind === 'startup') return <Timer className="size-3.5" />;
  if (segment.kind === 'sdk') return <ServerCog className="size-3.5" />;
  if (segment.kind === 'page') return <Layers3 className="size-3.5" />;
  return <Activity className="size-3.5" />;
}

function segmentIconClass(segment: SessionConsoleSegment, active: boolean): string {
  if (active) return 'border-teal-300 bg-white text-teal-700';
  if (segment.issueCount > 0) return 'border-amber-200 bg-amber-50 text-amber-800';
  if (segment.kind === 'sdk') return 'border-zinc-200 bg-zinc-50 text-zinc-600';
  return 'border-zinc-200 bg-zinc-50 text-zinc-600';
}

function metricToneClass(tone: SessionConsoleMetric['tone']): string {
  if (tone === 'danger') return 'border-red-200 bg-red-50 text-red-700';
  if (tone === 'warn') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (tone === 'good') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (tone === 'info') return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-zinc-200 bg-zinc-50 text-zinc-700';
}
