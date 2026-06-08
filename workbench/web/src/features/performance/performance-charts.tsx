import { Link } from '@tanstack/react-router';
import { AlertCircle, ArrowRight, BarChart3, ListTree } from 'lucide-react';
import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/common/empty-state';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import type { PerformanceMetricEvent } from '../../shared/datasource/types';
import { cn } from '../../shared/formatting/cn';
import { compactNumber, formatDateTime, formatDuration } from '../../shared/formatting/format';
import { statusLabel } from '../../shared/event-model/status';
import { EchartsPanel, type WorkbenchChartOption } from './echarts-panel';

export type ChartPoint = {
  id: string;
  label: string;
  timestamp?: string;
  value?: number;
  sessionId?: string;
  traceId?: string;
  eventName?: string;
};

export type BarDatum = {
  label: string;
  value: number;
  tone?: 'normal' | 'danger' | 'warn' | 'good';
};

export type TableColumn = {
  key: string;
  label: string;
  align?: 'left' | 'right';
  render: (event: PerformanceMetricEvent) => ReactNode;
};

export function SignalSummary({
  title,
  description,
  events,
  issueCount,
  sampleLabel,
  sampleCount,
  sampleField,
  sampleHint,
  issueLabel = '问题数',
  issueField = 'problem_type',
  issueHint = '来源：Workbench query summary 的问题分类计数。',
}: {
  title: string;
  description: string;
  events: PerformanceMetricEvent[];
  issueCount: number;
  sampleLabel?: string;
  sampleCount?: number;
  sampleField?: string;
  sampleHint?: string;
  issueLabel?: string;
  issueField?: string;
  issueHint?: string;
}) {
  const withDuration = events.filter((event) => typeof event.durationMs === 'number').length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-3">
        <SummaryCell label="事件数" value={events.length} field="events.length" hint="来源：当前筛选范围内匹配该类 signal 的 SDK envelope 数量" />
        <SummaryCell
          label={sampleLabel ?? '耗时事件'}
          value={sampleCount ?? withDuration}
          field={sampleField ?? 'durationMs'}
          hint={sampleHint ?? '来源：SDK envelope.durationMs。未提供 durationMs 的事件不会进入耗时类折线。'}
        />
        <SummaryCell label={issueLabel} value={issueCount} field={issueField} hint={issueHint} tone={issueCount > 0 ? 'danger' : 'normal'} />
      </CardContent>
    </Card>
  );
}

export function LineChartPanel({
  title,
  description,
  source,
  points,
  emptyTitle = '暂无可画点位',
  thresholds = [],
}: {
  title: string;
  description: string;
  source: string;
  points: ChartPoint[];
  emptyTitle?: string;
  thresholds?: Array<{ label: string; value: number }>;
}) {
  const drawable = points.filter((point) => typeof point.value === 'number') as Array<ChartPoint & { value: number }>;
  const option = lineOption(drawable, thresholds);
  return (
    <EchartsPanel
      title={title}
      description={description}
      source={source}
      option={option}
      empty={drawable.length === 0}
      height={280}
    />
  );
}

export function BarChartPanel({
  title,
  description,
  source,
  data,
  emptyTitle = '暂无分布数据',
}: {
  title: string;
  description: string;
  source: string;
  data: BarDatum[];
  emptyTitle?: string;
}) {
  return (
    <EchartsPanel
      title={title}
      description={description}
      source={source}
      option={barOption(data)}
      empty={data.length === 0}
      height={260}
    />
  );
}

export { EchartsPanel };

export function EventTablePanel({
  title,
  description,
  source,
  events,
  columns,
}: {
  title: string;
  description: string;
  source: string;
  events: PerformanceMetricEvent[];
  columns: TableColumn[];
}) {
  return (
    <Card className="grid min-h-[360px] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="inline-flex items-center gap-2"><ListTree className="size-4" />{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-help items-center rounded-md border border-teal-200 bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">来源字段</span>
          </TooltipTrigger>
          <TooltipContent>
            <div className="max-w-[320px] text-zinc-300">{source}</div>
          </TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent className="min-h-0 overflow-auto p-0">
        {events.length === 0 ? (
          <div className="p-3">
            <EmptyState title="暂无记录" description="当前筛选范围内还没有可展示的记录。" />
          </div>
        ) : (
          <div className="min-w-[680px] xl:min-w-0">
            <div
              className="grid gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500"
              style={{ gridTemplateColumns: tableColumns(columns.length) }}
            >
              <span>记录</span>
              {columns.map((column) => (
                <span key={column.key} className={column.align === 'right' ? 'text-right' : undefined}>{column.label}</span>
              ))}
              <span className="text-right">回查</span>
            </div>
            <div className="divide-y divide-zinc-100">
              {events.map((event, index) => (
                <PerformanceRow key={event.eventId ?? `${event.sessionId ?? 'event'}-${index}`} event={event} columns={columns} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function attrNumber(event: PerformanceMetricEvent, key: string): number | undefined {
  const value = event.attributes?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function attrString(event: PerformanceMetricEvent, key: string): string | undefined {
  const value = event.attributes?.[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function attrBool(event: PerformanceMetricEvent, key: string): boolean | undefined {
  const value = event.attributes?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

export function durationPoint(event: PerformanceMetricEvent, label: string): ChartPoint {
  return {
    id: event.eventId ?? `${event.sessionId ?? 'event'}-${event.timestamp ?? label}`,
    label,
    timestamp: event.timestamp,
    value: event.durationMs,
    sessionId: event.sessionId,
    traceId: event.traceId,
    eventName: event.name,
  };
}

export function attributePoint(event: PerformanceMetricEvent, key: string, label: string): ChartPoint {
  return {
    id: `${event.eventId ?? `${event.sessionId ?? 'event'}-${event.timestamp ?? label}`}-${key}`,
    label,
    timestamp: event.timestamp,
    value: attrNumber(event, key),
    sessionId: event.sessionId,
    traceId: event.traceId,
    eventName: event.name,
  };
}

export function groupCount(values: Array<string | undefined>, fallback = '未知'): BarDatum[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value && value.length > 0 ? value : fallback;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, value]) => ({ label, value }));
}

export function pieOption(data: BarDatum[]): WorkbenchChartOption {
  return {
    color: chartColors(),
    tooltip: {
      trigger: 'item',
      formatter: '{b}<br />数量：{c} ({d}%)',
    },
    legend: {
      bottom: 0,
      type: 'scroll',
      textStyle: { color: '#52525b' },
    },
    series: [
      {
        type: 'pie',
        radius: ['42%', '70%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        data: data.map((item) => ({ name: item.label, value: item.value })),
      },
    ],
  };
}

function SummaryCell({
  label,
  field,
  hint,
  value,
  tone = 'normal',
}: {
  label: string;
  field: string;
  hint: string;
  value: number;
  tone?: 'normal' | 'danger';
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="grid cursor-help gap-1 rounded border border-zinc-100 bg-zinc-50 px-3 py-2">
          <span className="text-xs text-zinc-500">{label}</span>
          <strong className={cn('text-2xl leading-none tabular-nums', tone === 'danger' ? 'text-red-600' : 'text-zinc-950')}>
            {compactNumber(value)}
          </strong>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <SourceHint label={label} field={field} hint={hint} />
      </TooltipContent>
    </Tooltip>
  );
}

function SourceHint({ label, field, hint }: { label: string; field: string; hint: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="font-medium text-zinc-50">{label}</span>
      <span className="text-zinc-400">
        字段 <code className="text-zinc-200">{field}</code> · {hint}
      </span>
    </div>
  );
}

function PerformanceRow({ event, columns }: { event: PerformanceMetricEvent; columns: TableColumn[] }) {
  const record = (
    <div
      className="grid items-center gap-2 px-3 py-2 text-xs hover:bg-teal-50"
      style={{ gridTemplateColumns: tableColumns(columns.length) }}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          {event.status === 'error' || event.signalType === 'error' ? <AlertCircle className="size-3.5 shrink-0 text-red-500" /> : null}
          <strong className="truncate text-zinc-950">{event.name ?? '-'}</strong>
          <span className="shrink-0 text-zinc-500">{statusLabel(event.status)}</span>
        </div>
        <div className="mt-0.5 truncate text-zinc-500">{formatDateTime(event.timestamp)} · {event.route ?? '-'}</div>
      </div>
      {columns.map((column) => (
        <div key={column.key} className={cn('min-w-0 truncate text-zinc-600', column.align === 'right' && 'text-right tabular-nums')}>
          {column.render(event)}
        </div>
      ))}
      <div className="text-right">
        {event.sessionId ? (
          <Link
            to="/sessions/$sessionId"
            params={{ sessionId: event.sessionId }}
            search={{
              eventId: event.eventId,
              traceId: event.eventId ? undefined : event.traceId,
            }}
            className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900"
          >
            Session <ArrowRight className="size-3" />
          </Link>
        ) : (
          <span className="text-zinc-400">-</span>
        )}
      </div>
    </div>
  );
  return record;
}

function tableColumns(columnCount: number): string {
  return `minmax(10rem,1.25fr) repeat(${columnCount}, minmax(4.75rem,0.75fr)) minmax(3.75rem,0.45fr)`;
}

function lineOption(
  points: Array<ChartPoint & { value: number }>,
  thresholds: Array<{ label: string; value: number }>,
): WorkbenchChartOption | undefined {
  if (points.length === 0) return undefined;
  return {
    color: ['#0f766e'],
    grid: { left: 56, right: 24, top: 28, bottom: points.length > 8 ? 62 : 42 },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const item = Array.isArray(params) ? params[0] : params;
        const index = typeof item?.dataIndex === 'number' ? item.dataIndex : 0;
        const data = points[index];
        if (!data) return '';
        return [
          data.eventName ?? data.label,
          `时间：${formatFullDateTime(data.timestamp)}`,
          `数值：${formatDuration(data.value)}`,
          data.sessionId ? `Session：${data.sessionId}` : undefined,
          data.traceId ? `Trace：${data.traceId}` : undefined,
        ].filter(Boolean).join('<br />');
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: points.map((point) => axisTimeLabel(point.timestamp)),
      axisLabel: { color: '#71717a', hideOverlap: true },
      axisLine: { lineStyle: { color: '#d4d4d8' } },
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: '#71717a',
        formatter: (value: number) => formatDuration(value),
      },
      splitLine: { lineStyle: { color: '#f4f4f5' } },
    },
    dataZoom: points.length > 12 ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 18 }] : undefined,
    series: [
      {
        name: '数值',
        type: 'line',
        smooth: true,
        symbolSize: 8,
        data: points.map((point) => point.value),
        markLine: thresholds.length > 0 ? {
          symbol: 'none',
          label: { color: '#92400e' },
          lineStyle: { color: '#f59e0b', type: 'dashed' },
          data: thresholds.map((threshold) => ({ name: threshold.label, yAxis: threshold.value })),
        } : undefined,
      },
    ],
  };
}

function barOption(data: BarDatum[]): WorkbenchChartOption | undefined {
  if (data.length === 0) return undefined;
  return {
    color: ['#0f766e'],
    grid: { left: 64, right: 20, top: 18, bottom: 48 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const item = Array.isArray(params) ? params[0] : params;
        return `${item?.name ?? ''}<br />数量：${item?.value ?? 0}`;
      },
    },
    xAxis: {
      type: 'category',
      data: data.map((item) => item.label),
      axisLabel: { color: '#71717a', hideOverlap: true },
      axisLine: { lineStyle: { color: '#d4d4d8' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#71717a' },
      splitLine: { lineStyle: { color: '#f4f4f5' } },
    },
    series: [
      {
        type: 'bar',
        data: data.map((item) => ({
          value: item.value,
          itemStyle: { color: toneColor(item.tone) },
        })),
        barMaxWidth: 36,
      },
    ],
  };
}

function axisTimeLabel(timestamp: string | undefined): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatFullDateTime(timestamp?: string): string {
  if (!timestamp) return '-';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  }).format(date);
}

function chartColors(): string[] {
  return ['#0f766e', '#2563eb', '#dc2626', '#d97706', '#7c3aed', '#059669', '#4b5563', '#be123c'];
}

function toneColor(tone: BarDatum['tone']): string {
  if (tone === 'danger') return '#dc2626';
  if (tone === 'warn') return '#d97706';
  if (tone === 'good') return '#059669';
  return '#0f766e';
}
