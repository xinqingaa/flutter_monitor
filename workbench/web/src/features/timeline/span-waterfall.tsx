import type { MonitorEvent } from '../../shared/datasource/types';
import { eventKind } from '../../shared/event-model/accessors';
import { formatDuration } from '../../shared/formatting/format';
import { cn } from '../../shared/formatting/cn';

interface WaterfallBar {
  event: MonitorEvent;
  leftPct: number;
  widthPct: number;
  depth: number;
  durationMs: number;
}

interface WaterfallLayout {
  bars: WaterfallBar[];
  spanMs: number;
}

export function SpanWaterfall({
  spans,
  selectedEventId,
  onSelectEvent,
}: {
  spans: MonitorEvent[];
  selectedEventId?: string;
  onSelectEvent?: (event: MonitorEvent) => void;
}) {
  const { bars, spanMs } = layoutBars(spans);
  if (bars.length === 0) {
    return <div className="px-3 py-2 text-xs text-zinc-400">该区段没有可绘制的 span 时间区间。</div>;
  }

  return (
    <div className="grid gap-1 border-l-2 border-zinc-100 bg-zinc-50/40 px-3 py-2">
      <div className="flex items-center justify-between text-[11px] text-zinc-400">
        <span>瀑布 · 按时间关系（重叠 / 串行 / 空档）</span>
        <span className="tabular-nums">跨度 {formatDuration(spanMs)}</span>
      </div>
      {bars.map((bar, index) => (
        <button
          key={bar.event.eventId ?? `${bar.event.spanId ?? bar.event.traceId ?? 'bar'}-${index}`}
          type="button"
          onClick={() => onSelectEvent?.(bar.event)}
          className={cn(
            'grid grid-cols-[minmax(120px,180px)_minmax(0,1fr)] items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-white',
            bar.event.eventId && selectedEventId === bar.event.eventId && 'bg-white ring-1 ring-teal-200',
          )}
        >
          <span
            className="min-w-0 truncate text-xs text-zinc-600"
            style={{ paddingLeft: bar.depth * 12 }}
            title={bar.event.name ?? undefined}
          >
            {bar.event.name ?? '-'}
          </span>
          <span className="relative h-4 rounded bg-zinc-100">
            <span
              className={cn('absolute inset-y-0 rounded', barTone(bar.event))}
              style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%` }}
            />
            <span className="absolute inset-y-0 right-1 flex items-center justify-end text-[10px] tabular-nums text-zinc-500">
              {formatDuration(bar.durationMs)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function layoutBars(spans: MonitorEvent[]): WaterfallLayout {
  const timed = spans
    .map((event) => ({ event, start: timeMs(event.startTime), end: timeMs(event.endTime) }))
    .filter((item): item is { event: MonitorEvent; start: number; end: number } => item.start !== undefined && item.end !== undefined)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  if (timed.length === 0) return { bars: [], spanMs: 0 };

  const axisStart = Math.min(...timed.map((item) => item.start));
  const axisEnd = Math.max(...timed.map((item) => item.end));
  const total = Math.max(axisEnd - axisStart, 1);

  const byId = new Map<string, MonitorEvent>();
  for (const { event } of timed) {
    if (event.spanId) byId.set(event.spanId, event);
  }

  return {
    spanMs: total,
    bars: timed.map(({ event, start, end }) => {
      const durationMs = Math.max(end - start, 0);
      return {
        event,
        durationMs,
        depth: depthOf(event, byId),
        leftPct: ((start - axisStart) / total) * 100,
        widthPct: Math.max(((end - start) / total) * 100, 1.5),
      };
    }),
  };
}

function depthOf(event: MonitorEvent, byId: Map<string, MonitorEvent>): number {
  let depth = 0;
  let parentId = event.parentSpanId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId) && depth < 8) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    depth += 1;
    parentId = parent.parentSpanId;
  }
  return depth;
}

function barTone(event: MonitorEvent): string {
  const kind = eventKind(event);
  if (kind === 'error' || event.status === 'error') return 'bg-red-400';
  if (kind === 'http') return 'bg-blue-400';
  if (kind === 'jank') return 'bg-amber-400';
  if (event.signalType === 'trace') return 'bg-teal-500';
  return 'bg-teal-400';
}

function timeMs(timestamp?: string): number | undefined {
  if (!timestamp) return undefined;
  const value = Date.parse(timestamp);
  return Number.isNaN(value) ? undefined : value;
}
