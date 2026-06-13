import {
  Activity,
  AlertTriangle,
  BadgeAlert,
  ChartNoAxesColumn,
  Gauge,
  Globe2,
  HardDrive,
  Layers3,
  Radio,
  Search,
  ServerCog,
  Timer,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EmptyState } from '../../components/common/empty-state';
import { Badge, type BadgeProps } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import type { SessionConsoleMetric, SessionConsoleResult, SessionConsoleRow, SessionConsoleSegment } from '../../shared/datasource/types';
import { cn } from '../../shared/formatting/cn';
import { formatDuration, formatTime } from '../../shared/formatting/format';

type FilterKey = 'all' | 'problems' | 'pages' | 'http' | 'startup' | 'interaction' | 'business' | 'memory' | 'lifecycle' | 'sdk';

const filters: Array<{ key: FilterKey; label: string }> = [
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

export function SessionConsoleView({
  consoleData,
  selectedEventId,
  onSelectEvent,
}: {
  consoleData?: SessionConsoleResult;
  selectedEventId?: string;
  onSelectEvent: (eventId: string) => void;
}) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const segmentRefs = useRef(new Map<string, HTMLElement>());
  const pendingScrollRef = useRef<{ type: 'row' | 'segment'; id: string } | undefined>(undefined);
  const rowsById = useMemo(() => new Map((consoleData?.rows ?? []).map((row) => [row.eventId, row])), [consoleData?.rows]);
  const rows = useMemo(
    () => filterRows(consoleData?.rows ?? [], filter, query),
    [consoleData?.rows, filter, query],
  );

  const scrollRowIntoView = useCallback((eventId: string) => {
    rowRefs.current.get(eventId)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  const scrollSegmentIntoView = useCallback((segmentId: string) => {
    segmentRefs.current.get(segmentId)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, []);

  const selectEvent = useCallback((eventId: string) => {
    onSelectEvent(eventId);
    setFilter('all');
    pendingScrollRef.current = { type: 'row', id: eventId };
  }, [onSelectEvent]);

  const selectSegment = useCallback((segment: SessionConsoleSegment) => {
    setFilter('all');
    const firstEventId = segment.rows[0];
    if (firstEventId) onSelectEvent(firstEventId);
    pendingScrollRef.current = { type: 'segment', id: segment.id };
  }, [onSelectEvent]);

  useEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending) return;
    pendingScrollRef.current = undefined;
    window.requestAnimationFrame(() => {
      if (pending.type === 'row') scrollRowIntoView(pending.id);
      if (pending.type === 'segment') scrollSegmentIntoView(pending.id);
    });
  }, [rows, scrollRowIntoView, scrollSegmentIntoView]);

  useEffect(() => {
    if (!selectedEventId) return;
    scrollRowIntoView(selectedEventId);
  }, [selectedEventId, scrollRowIntoView]);

  if (!consoleData) {
    return (
      <Card className="h-full min-h-0">
        <CardContent className="grid h-full min-h-0 place-items-center p-3">
          <EmptyState title="正在读取会话链路" description="等待 Monitor Service 返回 Session Console 摘要。" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-2 py-2.5">
        <div className="min-w-0">
          <CardTitle>Session Console</CardTitle>
          <p className="mt-1 truncate text-xs text-zinc-500">用导航定位，用日志流还原顺序；完整 envelope 从右侧 Inspector 回查。</p>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          {consoleData.sdkHealth.detailDroppedCount > 0 ? <Badge tone="warn">HTTP 详情剥离 {consoleData.sdkHealth.detailDroppedCount}</Badge> : null}
          {consoleData.sdkHealth.droppedEventCount > 0 ? <Badge tone="danger">SDK 丢弃 {consoleData.sdkHealth.droppedEventCount}</Badge> : null}
        </div>
      </CardHeader>

      <div className="flex min-w-0 flex-col gap-2 border-b border-zinc-200 px-3 pb-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap gap-1">
          {filters.map((item) => (
            <Button
              key={item.key}
              type="button"
              size="sm"
              variant={filter === item.key ? 'default' : 'secondary'}
              className="h-7 px-2"
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <label className="relative min-w-0 lg:w-72">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="筛选 title/url/route/eventId"
            className="h-8 pl-7 text-xs"
          />
        </label>
      </div>

      <div className="grid min-h-0 grid-cols-1 overflow-hidden bg-zinc-50 xl:grid-cols-[250px_minmax(0,1fr)]">
        <SessionNavigator
          consoleData={consoleData}
          rowsById={rowsById}
          selectedEventId={selectedEventId}
          onSelectEvent={selectEvent}
          onSelectSegment={selectSegment}
        />
        <LogStream
          rows={rows}
          rowsById={rowsById}
          segments={consoleData.segments}
          selectedEventId={selectedEventId}
          onSelectEvent={selectEvent}
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
    </Card>
  );
}

function SessionNavigator({
  consoleData,
  rowsById,
  selectedEventId,
  onSelectEvent,
  onSelectSegment,
}: {
  consoleData: SessionConsoleResult;
  rowsById: Map<string | undefined, SessionConsoleRow>;
  selectedEventId?: string;
  onSelectEvent: (eventId: string) => void;
  onSelectSegment: (segment: SessionConsoleSegment) => void;
}) {
  return (
    <aside className="grid min-h-[220px] grid-rows-[auto_minmax(0,1fr)] border-b border-zinc-200 bg-white xl:min-h-0 xl:border-b-0 xl:border-r">
      <div className="grid gap-2 border-b border-zinc-100 p-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
          <AlertTriangle className="size-3.5" />
          快速定位
        </div>
        <ProblemList consoleData={consoleData} onSelectEvent={onSelectEvent} />
      </div>
      <div className="min-h-0 overflow-auto p-2">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
          <Layers3 className="size-3.5" />
          会话分段
        </div>
        <div className="grid gap-1.5">
          {consoleData.segments.map((segment) => {
            const firstEventId = segment.rows[0];
            const active = selectedEventId !== undefined && segment.rows.includes(selectedEventId);
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
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-zinc-950">{segment.title}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                      {[formatDuration(segment.durationMs), `${segment.eventCount} 事件`, segment.issueCount > 0 ? `${segment.issueCount} 问题` : undefined].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </span>
                <MetricStrip metrics={segment.summaryItems.slice(2, 6)} compact />
                {firstEventId && rowsById.get(firstEventId)?.eventId ? null : <span className="text-[11px] text-zinc-400">没有可选事件</span>}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function ProblemList({
  consoleData,
  onSelectEvent,
}: {
  consoleData: SessionConsoleResult;
  onSelectEvent: (eventId: string) => void;
}) {
  const chips = consoleData.problemChips;
  if (chips.length === 0) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800">
        <Zap className="size-3.5" />
        暂无明显问题
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1.5 xl:grid-cols-1">
      {chips.map((chip) => (
        <button
          key={chip.kind}
          type="button"
          disabled={!chip.eventId}
          onClick={() => chip.eventId && onSelectEvent(chip.eventId)}
          className={cn(
            'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-md border px-2 py-1.5 text-xs font-medium',
            chipToneClass(chip.tone),
            chip.eventId ? 'hover:brightness-95' : 'cursor-default opacity-75',
          )}
        >
          <span className="truncate">{chip.label}</span>
          <span className="tabular-nums">{chip.count}</span>
        </button>
      ))}
    </div>
  );
}

function LogStream({
  rows,
  rowsById,
  segments,
  selectedEventId,
  onSelectEvent,
  setRowRef,
  setSegmentRef,
}: {
  rows: SessionConsoleRow[];
  rowsById: Map<string | undefined, SessionConsoleRow>;
  segments: SessionConsoleSegment[];
  selectedEventId?: string;
  onSelectEvent: (eventId: string) => void;
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

  const visibleEventIds = new Set(rows.map((row) => row.eventId).filter(Boolean));

  return (
    <div className="min-h-0 overflow-auto bg-zinc-50 p-2">
      <div className="grid gap-2">
        {segments.map((segment) => {
          const segmentRows = segment.rows
            .filter((eventId) => visibleEventIds.has(eventId))
            .map((eventId) => rowsById.get(eventId))
            .filter((row): row is SessionConsoleRow => Boolean(row));
          if (segmentRows.length === 0) return null;
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
                        {[formatDuration(segment.durationMs), `${segment.eventCount} 事件`, segment.issueCount > 0 ? `${segment.issueCount} 问题` : undefined].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                  <MetricStrip metrics={segment.summaryItems.slice(2, 8)} compact />
                </div>
              </div>
              <div className="divide-y divide-zinc-100">
                {segmentRows.map((row) => (
                  <LogRow
                    key={row.eventId ?? `${row.timestamp}-${row.title}`}
                    row={row}
                    selected={selectedEventId === row.eventId}
                    onSelectEvent={onSelectEvent}
                    setRowRef={setRowRef}
                  />
                ))}
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
  setRowRef,
}: {
  row: SessionConsoleRow;
  selected: boolean;
  onSelectEvent: (eventId: string) => void;
  setRowRef: (eventId: string, node: HTMLButtonElement | null) => void;
}) {
  const Icon = rowIcon(row);
  return (
    <button
      ref={(node) => {
        if (row.eventId) setRowRef(row.eventId, node);
      }}
      type="button"
      disabled={!row.eventId}
      onClick={() => row.eventId && onSelectEvent(row.eventId)}
      className={cn(
        'grid w-full grid-cols-[76px_30px_minmax(0,1fr)] gap-2 px-3 py-2.5 text-left hover:bg-zinc-50',
        selected && 'bg-teal-50 hover:bg-teal-50',
      )}
    >
      <span className="pt-0.5 text-xs tabular-nums text-zinc-500">{formatTime(row.timestamp ?? row.startTime)}</span>
      <span className={cn('mt-0.5 inline-flex size-7 items-center justify-center rounded-md border', iconClass(row))}>
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="min-w-0 truncate text-sm font-semibold text-zinc-950">{row.title}</span>
          <Badge tone={groupTone(row.group)} className="rounded-md px-1.5 py-0">{groupLabel(row.group)}</Badge>
          {row.durationMs !== undefined ? <Badge tone={row.durationMs >= 1000 ? 'warn' : 'neutral'} className="rounded-md px-1.5 py-0">{formatDuration(row.durationMs)}</Badge> : null}
          {row.issueLabels.map((label) => <Badge key={label} tone={issueTone(label)} className="rounded-md px-1.5 py-0">{label}</Badge>)}
        </span>
        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
          {row.subtitle ? <span className="min-w-0 truncate">{row.subtitle}</span> : null}
          {row.route ? <span className="min-w-0 truncate">route {row.route}</span> : null}
          {row.eventId ? <span className="font-mono">{shortId(row.eventId)}</span> : null}
        </span>
        <MetricStrip metrics={row.metrics} />
      </span>
    </button>
  );
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

function filterRows(rows: SessionConsoleRow[], filter: FilterKey, query: string): SessionConsoleRow[] {
  const normalized = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter === 'http' && row.group !== 'http') return false;
    if (filter === 'problems' && row.issueLabels.length === 0 && row.group !== 'problem' && row.group !== 'memory') return false;
    if (filter === 'pages' && row.group !== 'page') return false;
    if (filter === 'startup' && row.group !== 'startup') return false;
    if (filter === 'interaction' && row.group !== 'interaction') return false;
    if (filter === 'business' && row.group !== 'business') return false;
    if (filter === 'memory' && row.group !== 'memory') return false;
    if (filter === 'lifecycle' && row.group !== 'lifecycle') return false;
    if (filter === 'sdk' && row.group !== 'sdk') return false;
    if (!normalized) return true;
    return [
      row.title,
      row.subtitle,
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

function rowIcon(row: SessionConsoleRow) {
  if (row.group === 'http') return Globe2;
  if (row.group === 'sdk') return ServerCog;
  if (row.group === 'business') return BadgeAlert;
  if (row.group === 'interaction') return ChartNoAxesColumn;
  if (row.group === 'startup') return Timer;
  if (row.group === 'page') return Layers3;
  if (row.group === 'memory') return HardDrive;
  if (row.group === 'lifecycle') return Radio;
  if (row.issueLabels.length > 0 || row.group === 'problem') return AlertTriangle;
  if (row.group === 'performance') return Gauge;
  return Activity;
}

function iconClass(row: SessionConsoleRow): string {
  if (row.issueLabels.some((label) => label.includes('失败') || label === '错误' || label.includes('丢弃'))) return 'border-red-200 bg-red-50 text-red-700';
  if (row.issueLabels.length > 0) return 'border-amber-200 bg-amber-50 text-amber-800';
  if (row.group === 'http') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (row.group === 'sdk') return 'border-zinc-200 bg-zinc-50 text-zinc-600';
  if (row.group === 'business') return 'border-violet-200 bg-violet-50 text-violet-700';
  if (row.group === 'interaction') return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  if (row.group === 'memory') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-teal-200 bg-teal-50 text-teal-700';
}

function segmentIconClass(segment: SessionConsoleSegment, active: boolean): string {
  if (active) return 'border-teal-300 bg-white text-teal-700';
  if (segment.issueCount > 0) return 'border-amber-200 bg-amber-50 text-amber-800';
  if (segment.kind === 'sdk') return 'border-zinc-200 bg-zinc-50 text-zinc-600';
  return 'border-zinc-200 bg-zinc-50 text-zinc-600';
}

function groupLabel(group: SessionConsoleRow['group']): string {
  const labels: Record<SessionConsoleRow['group'], string> = {
    startup: '启动',
    page: '页面',
    http: 'HTTP',
    interaction: '交互',
    business: '埋点',
    problem: '问题',
    performance: '性能',
    lifecycle: '生命周期',
    memory: '内存',
    sdk: 'SDK',
    event: '事件',
  };
  return labels[group];
}

function groupTone(group: SessionConsoleRow['group']): BadgeProps['tone'] {
  if (group === 'http') return 'info';
  if (group === 'interaction') return 'teal';
  if (group === 'business') return 'neutral';
  if (group === 'memory') return 'good';
  if (group === 'problem') return 'warn';
  if (group === 'sdk') return 'neutral';
  return 'neutral';
}

function issueTone(label: string): BadgeProps['tone'] {
  if (label.includes('失败') || label === '错误' || label.includes('丢弃')) return 'danger';
  return 'warn';
}

function chipToneClass(tone: SessionConsoleResult['problemChips'][number]['tone']): string {
  if (tone === 'danger') return 'border-red-200 bg-red-50 text-red-700';
  if (tone === 'warn') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (tone === 'info') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-zinc-200 bg-zinc-50 text-zinc-700';
}

function metricToneClass(tone: SessionConsoleMetric['tone']): string {
  if (tone === 'danger') return 'border-red-200 bg-red-50 text-red-700';
  if (tone === 'warn') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (tone === 'good') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (tone === 'info') return 'border-blue-200 bg-blue-50 text-blue-800';
  return 'border-zinc-200 bg-zinc-50 text-zinc-700';
}

function shortId(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 8)}...${value.slice(-4)}`;
}
