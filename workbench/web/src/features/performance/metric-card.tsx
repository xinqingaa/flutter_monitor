import type { LucideIcon } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Card, CardContent } from '../../components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { compactNumber, formatDuration } from '../../shared/formatting/format';
import type { PerformanceMetricSummary } from '../../shared/datasource/types';

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
        {summary?.durationSummary ? (
          <div className="grid gap-1 text-xs">
            <MetricDuration
              label="平均耗时"
              value={summary.durationSummary.averageMs}
              hint={`Workbench 基于 ${summary.durationSummary.sourceFields.join('、')} 聚合`}
            />
            <MetricDuration
              label="最慢记录"
              value={summary.durationSummary.maxMs}
              hint={`Workbench 基于 ${summary.durationSummary.sourceFields.join('、')} 排序`}
            />
            <MetricDuration
              label="最近记录"
              value={summary.durationSummary.latestMs}
              hint={`Workbench 基于 ${summary.durationSummary.sourceFields.join('、')} 按时间取最近`}
            />
          </div>
        ) : null}
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

function MetricDuration({ label, hint, value }: { label: string; hint: string; value?: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="grid cursor-help grid-cols-[4.5rem_auto] items-baseline gap-1">
          <span className="text-zinc-400">{label}</span>
          <span className="text-right text-zinc-600 tabular-nums">{formatDuration(value)}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <FieldHint label={label} field="durationSummary" hint={hint} />
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
        字段 <code className="text-zinc-200">{field}</code> · {hint}
      </span>
    </div>
  );
}
