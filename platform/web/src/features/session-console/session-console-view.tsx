import { Activity, AlertTriangle, BadgeAlert, Bug, Gauge, Globe2, HardDrive, Layers3, Radio, Search, ServerCog, Timer, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '../../components/common/empty-state';
import { Badge, type BadgeProps } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import type { SessionConsoleResult, SessionConsoleRow } from '../../shared/datasource/types';
import { cn } from '../../shared/formatting/cn';
import { formatDuration, formatTime } from '../../shared/formatting/format';

type FilterKey = 'all' | 'http' | 'problems' | 'pages' | 'business' | 'performance' | 'sdk';

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'http', label: 'HTTP' },
  { key: 'problems', label: '问题' },
  { key: 'pages', label: '页面' },
  { key: 'business', label: '业务' },
  { key: 'performance', label: '性能' },
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
  const rows = useMemo(
    () => filterRows(consoleData?.rows ?? [], filter, query),
    [consoleData?.rows, filter, query],
  );

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
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <div className="min-w-0">
          <CardTitle>Session Console</CardTitle>
          <p className="mt-1 truncate text-xs text-zinc-500">按链路聚合展示，会话中的 raw envelope 可从右侧 Inspector 回查。</p>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          {consoleData.sdkHealth.detailDroppedCount > 0 ? <Badge tone="warn">HTTP 详情剥离 {consoleData.sdkHealth.detailDroppedCount}</Badge> : null}
          {consoleData.sdkHealth.droppedEventCount > 0 ? <Badge tone="danger">SDK 丢弃 {consoleData.sdkHealth.droppedEventCount}</Badge> : null}
        </div>
      </CardHeader>

      <div className="grid gap-2 border-b border-zinc-200 p-3">
        <ProblemStrip consoleData={consoleData} onSelectEvent={onSelectEvent} />
        <SessionLaneMap consoleData={consoleData} selectedEventId={selectedEventId} onSelectEvent={onSelectEvent} />
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
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
      </div>

      <div className="min-h-0 overflow-auto bg-zinc-50">
        <LogStream rows={rows} selectedEventId={selectedEventId} onSelectEvent={onSelectEvent} />
      </div>
    </Card>
  );
}

function ProblemStrip({
  consoleData,
  onSelectEvent,
}: {
  consoleData: SessionConsoleResult;
  onSelectEvent: (eventId: string) => void;
}) {
  const chips = consoleData.problemChips;
  if (chips.length === 0) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-800">
        <Zap className="size-3.5" />
        暂无明显问题，仍可按日志流查看 HTTP、页面、业务和 SDK 事件。
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className="mr-1 inline-flex items-center gap-1 text-xs font-medium text-zinc-500">
        <AlertTriangle className="size-3.5" />
        快速定位
      </span>
      {chips.map((chip) => (
        <button
          key={chip.kind}
          type="button"
          disabled={!chip.eventId}
          onClick={() => chip.eventId && onSelectEvent(chip.eventId)}
          className={cn(
            'inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs font-medium',
            chipToneClass(chip.tone),
            chip.eventId ? 'hover:brightness-95' : 'cursor-default opacity-75',
          )}
        >
          {chip.label}
          <span className="tabular-nums">{chip.count}</span>
        </button>
      ))}
    </div>
  );
}

function SessionLaneMap({
  consoleData,
  selectedEventId,
  onSelectEvent,
}: {
  consoleData: SessionConsoleResult;
  selectedEventId?: string;
  onSelectEvent: (eventId: string) => void;
}) {
  const rows = consoleData.rows;
  const firstTime = Math.min(...rows.map(rowTime).filter(isFiniteNumber));
  const lastTime = Math.max(...rows.map(rowTime).filter(isFiniteNumber));
  const span = Number.isFinite(firstTime) && Number.isFinite(lastTime) && lastTime > firstTime ? lastTime - firstTime : 1;
  const lanes = [
    { key: 'page', label: 'Page', icon: Layers3, predicate: (row: SessionConsoleRow) => row.group === 'page' || row.group === 'startup' || row.group === 'lifecycle' },
    { key: 'http', label: 'HTTP', icon: Globe2, predicate: (row: SessionConsoleRow) => row.group === 'http' },
    { key: 'problem', label: 'Problem', icon: Bug, predicate: (row: SessionConsoleRow) => row.issueLabels.length > 0 || row.group === 'problem' || row.group === 'memory' },
    { key: 'sdk', label: 'SDK', icon: ServerCog, predicate: (row: SessionConsoleRow) => row.group === 'sdk' },
  ];

  return (
    <div className="grid gap-1.5 rounded-md border border-zinc-200 bg-white p-2">
      {lanes.map(({ key, label, icon: Icon, predicate }) => {
        const laneRows = rows.filter(predicate).slice(-80);
        return (
          <div key={key} className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
              <Icon className="size-3.5" />
              {label}
            </div>
            <div className="relative h-7 rounded bg-zinc-50">
              {laneRows.length === 0 ? (
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-zinc-400">无事件</span>
              ) : laneRows.map((row) => {
                const left = `${Math.max(0, Math.min(100, ((rowTime(row) - firstTime) / span) * 100))}%`;
                return (
                  <button
                    key={`${key}-${row.eventId}`}
                    type="button"
                    disabled={!row.eventId}
                    title={[formatTime(row.timestamp ?? row.startTime), row.title, row.subtitle].filter(Boolean).join(' · ')}
                    onClick={() => row.eventId && onSelectEvent(row.eventId)}
                    className={cn(
                      'absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border',
                      dotClass(row),
                      selectedEventId === row.eventId && 'ring-2 ring-zinc-900 ring-offset-1',
                    )}
                    style={{ left }}
                    aria-label={row.title}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LogStream({
  rows,
  selectedEventId,
  onSelectEvent,
}: {
  rows: SessionConsoleRow[];
  selectedEventId?: string;
  onSelectEvent: (eventId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="grid h-full min-h-[240px] place-items-center p-3">
        <EmptyState title="没有匹配的日志" description="换一个筛选条件，或清空搜索关键字。" />
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-100 bg-white">
      {rows.map((row) => (
        <LogRow
          key={row.eventId ?? `${row.timestamp}-${row.title}`}
          row={row}
          selected={selectedEventId === row.eventId}
          onSelectEvent={onSelectEvent}
        />
      ))}
    </div>
  );
}

function LogRow({
  row,
  selected,
  onSelectEvent,
}: {
  row: SessionConsoleRow;
  selected: boolean;
  onSelectEvent: (eventId: string) => void;
}) {
  const Icon = rowIcon(row);
  return (
    <button
      type="button"
      disabled={!row.eventId}
      onClick={() => row.eventId && onSelectEvent(row.eventId)}
      className={cn(
        'grid w-full grid-cols-[78px_28px_minmax(0,1fr)] gap-2 px-3 py-2 text-left hover:bg-zinc-50',
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
          {row.durationMs !== undefined ? <Badge tone={row.durationMs >= 1000 ? 'warn' : 'neutral'} className="rounded-md px-1.5 py-0">{formatDuration(row.durationMs)}</Badge> : null}
          {row.issueLabels.map((label) => <Badge key={label} tone={issueTone(label)} className="rounded-md px-1.5 py-0">{label}</Badge>)}
        </span>
        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-zinc-500">
          {row.subtitle ? <span className="min-w-0 truncate">{row.subtitle}</span> : null}
          {row.group === 'http' ? <HttpEvidence row={row} /> : null}
          {row.eventId ? <span className="font-mono">{shortId(row.eventId)}</span> : null}
        </span>
      </span>
    </button>
  );
}

function HttpEvidence({ row }: { row: SessionConsoleRow }) {
  const flags = [
    row.hasRequestHeaders ? 'Req headers' : undefined,
    row.hasRequestBody ? 'Req body' : undefined,
    row.hasResponseHeaders ? 'Res headers' : undefined,
    row.hasResponseBody ? 'Res body' : undefined,
    row.bodyTruncated ? 'body truncated' : undefined,
    row.detailDropped ? 'detail dropped' : undefined,
  ].filter(Boolean);
  if (flags.length === 0) return <span>无详情摘要</span>;
  return <span>{flags.join(' · ')}</span>;
}

function filterRows(rows: SessionConsoleRow[], filter: FilterKey, query: string): SessionConsoleRow[] {
  const normalized = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter === 'http' && row.group !== 'http') return false;
    if (filter === 'problems' && row.issueLabels.length === 0 && row.group !== 'problem' && row.group !== 'memory') return false;
    if (filter === 'pages' && row.group !== 'page' && row.group !== 'startup' && row.group !== 'lifecycle') return false;
    if (filter === 'business' && row.group !== 'business') return false;
    if (filter === 'performance' && !['performance', 'startup', 'page', 'http', 'memory'].includes(row.group)) return false;
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
    ].filter(Boolean).join(' ').toLowerCase().includes(normalized);
  });
}

function rowIcon(row: SessionConsoleRow) {
  if (row.group === 'http') return Globe2;
  if (row.group === 'sdk') return ServerCog;
  if (row.group === 'business') return BadgeAlert;
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
  return 'border-teal-200 bg-teal-50 text-teal-700';
}

function dotClass(row: SessionConsoleRow): string {
  if (row.issueLabels.some((label) => label.includes('失败') || label === '错误' || label.includes('丢弃'))) return 'border-red-300 bg-red-500';
  if (row.issueLabels.length > 0) return 'border-amber-300 bg-amber-400';
  if (row.group === 'http') return 'border-blue-300 bg-blue-500';
  if (row.group === 'sdk') return 'border-zinc-300 bg-zinc-500';
  return 'border-teal-300 bg-teal-500';
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

function rowTime(row: SessionConsoleRow): number {
  const value = Date.parse(row.timestamp ?? row.startTime ?? '');
  return Number.isNaN(value) ? 0 : value;
}

function shortId(value: string): string {
  return value.length <= 12 ? value : `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}
