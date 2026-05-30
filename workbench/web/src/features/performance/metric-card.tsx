import type { LucideIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Card, CardContent } from '../../components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { compactNumber, formatDuration } from '../../shared/formatting/format';
import type { PerformanceMetricEvent, PerformanceMetricSummary } from '../../shared/datasource/types';

export function MetricCard({
  title,
  icon: Icon,
  summary,
  emphasis,
  to,
}: {
  title: string;
  icon: LucideIcon;
  summary?: PerformanceMetricSummary;
  emphasis?: string;
  to?: string;
}) {
  const errorCount = summary?.errorCount ?? 0;
  const isStartup = title === '启动耗时';
  const body = (
    <Card className="min-w-0">
      <CardContent className="grid gap-3 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-zinc-700">
            <Icon className="size-5 shrink-0" />
            <span className="truncate">{title}</span>
          </div>
          {emphasis ? <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">{emphasis}</span> : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <MetricNumber label="事件数" field="events.length" hint="来源：当前筛选范围内匹配该类 signal 的 SDK envelope 数量" value={summary?.count ?? 0} />
          <MetricNumber label="问题数" field="status / signalType" hint="来源：status=error 或 signalType=error 的 SDK envelope 数量" value={errorCount} tone={errorCount > 0 ? 'danger' : 'normal'} />
        </div>
        {isStartup ? <StartupSummary events={summary?.events ?? []} /> : <DurationSummary summary={summary} />}
      </CardContent>
    </Card>
  );

  if (!to) return body;

  return (
    <Link to={to} className="block min-w-0 transition-transform hover:-translate-y-0.5">
      {body}
    </Link>
  );
}

function StartupSummary({ events }: { events: PerformanceMetricEvent[] }) {
  const cold = summarizeEvents(events.filter((event) => event.name === 'app.cold_start'));
  const hot = summarizeEvents(events.filter((event) => event.name === 'app.hot_start'));
  return (
    <div className="grid gap-2 text-xs">
      <StartupGroup label="冷启动" source="name=app.cold_start · value=durationMs" summary={cold} />
      <StartupGroup label="热启动" source="name=app.hot_start · value=durationMs" summary={hot} />
    </div>
  );
}

function StartupGroup({ label, source, summary }: { label: string; source: string; summary: LocalDurationSummary }) {
  return (
    <div className="grid gap-1 rounded border border-zinc-100 bg-zinc-50 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-zinc-600">{label}</span>
        <MetricDuration
          label="次数"
          value={summary.count}
          kind="number"
          sdkField="durationMs"
          hint={`筛选口径：${source}。次数表示当前范围内匹配该启动类型的 SDK envelope 数量。`}
        />
      </div>
      <MetricDuration
        label="平均耗时"
        value={summary.averageMs}
        sdkField="durationMs"
        hint={`筛选口径：${source}。计算口径：对匹配记录的 durationMs 做算术平均。样本数：${summary.sampleCount}。`}
      />
      <MetricDuration
        label="最近记录"
        value={summary.latestMs}
        sdkField="durationMs"
        hint={`筛选口径：${source}。计算口径：按 timestamp 倒序取最近一条有 durationMs 的记录。样本数：${summary.sampleCount}。`}
      />
    </div>
  );
}

function DurationSummary({ summary }: { summary?: PerformanceMetricSummary }) {
  const sourceFields = summary?.durationSummary?.sourceFields.join('、') || 'durationMs';
  return summary?.durationSummary ? (
    <div className="grid gap-1 text-xs">
      <MetricDuration
        label="平均耗时"
        value={summary.durationSummary.averageMs}
        sdkField={sourceFields}
        hint={`计算口径：当前类别下有有效 durationMs 的 SDK envelope 算术平均值。样本数：${summary.durationSummary.sampleCount}。`}
      />
      <MetricDuration
        label="最慢记录"
        value={summary.durationSummary.maxMs}
        sdkField={sourceFields}
        hint={`计算口径：当前类别下 durationMs 最大的一条记录。样本数：${summary.durationSummary.sampleCount}。`}
      />
      <MetricDuration
        label="最近记录"
        value={summary.durationSummary.latestMs}
        sdkField={sourceFields}
        hint={`计算口径：按 timestamp 倒序取最近一条有 durationMs 的记录。样本数：${summary.durationSummary.sampleCount}。`}
      />
    </div>
  ) : null;
}

function MetricDuration({
  label,
  hint,
  sdkField,
  value,
  kind = 'duration',
}: {
  label: string;
  hint: string;
  sdkField: string;
  value?: number;
  kind?: 'duration' | 'number';
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="grid cursor-help grid-cols-[4.5rem_auto] items-baseline gap-1">
          <span className="text-zinc-400">{label}</span>
          <span className="text-right text-zinc-600 tabular-nums">{kind === 'number' ? formatOptionalNumber(value) : formatDuration(value)}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <FieldHint label={label} field={sdkField} hint={hint} />
      </TooltipContent>
    </Tooltip>
  );
}

function MetricNumber({
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
        <span className="grid cursor-help gap-1 rounded border border-zinc-100 bg-zinc-50 px-2.5 py-2">
          <span className="text-xs text-zinc-500">{label}</span>
          <strong className={`text-2xl leading-none tabular-nums ${tone === 'danger' ? 'text-red-600' : 'text-zinc-950'}`}>
            {compactNumber(value)}
          </strong>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <FieldHint label={label} field={field} hint={hint} />
      </TooltipContent>
    </Tooltip>
  );
}

function FieldHint({ label, field, hint }: { label: string; field: string; hint: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="font-medium text-zinc-50">{label}</span>
      <span className="text-zinc-400">
        SDK 来源字段 <code className="text-zinc-200">{field}</code> · {hint}
      </span>
    </div>
  );
}

type LocalDurationSummary = {
  count: number;
  sampleCount: number;
  averageMs?: number;
  latestMs?: number;
};

function summarizeEvents(events: PerformanceMetricEvent[]): LocalDurationSummary {
  const durationEvents = events
    .filter((event) => typeof event.durationMs === 'number' && Number.isFinite(event.durationMs))
    .sort((a, b) => timeValue(a.timestamp) - timeValue(b.timestamp));
  const durations = durationEvents.map((event) => event.durationMs as number);
  return {
    count: events.length,
    sampleCount: durationEvents.length,
    averageMs: durations.length > 0 ? durations.reduce((sum, value) => sum + value, 0) / durations.length : undefined,
    latestMs: durationEvents.at(-1)?.durationMs,
  };
}

function timeValue(timestamp?: string): number {
  const value = Date.parse(timestamp ?? '');
  return Number.isNaN(value) ? 0 : value;
}

function formatOptionalNumber(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? compactNumber(value) : '-';
}
