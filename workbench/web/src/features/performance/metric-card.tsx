import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { compactNumber, formatDuration } from '../../shared/formatting/format';
import type { PerformanceMetricSummary } from '../../shared/datasource/types';

export function MetricCard({
  title,
  icon: Icon,
  summary,
  emphasis,
}: {
  title: string;
  icon: LucideIcon;
  summary?: PerformanceMetricSummary;
  emphasis?: string;
}) {
  return (
    <Card className="min-w-0">
      <CardContent className="grid gap-2 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-zinc-700">
            <Icon className="size-5 shrink-0" />
            <span className="truncate">{title}</span>
          </div>
          {emphasis ? <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600">{emphasis}</span> : null}
        </div>
        <div className="flex items-end justify-between gap-3">
          <MetricNumber field="count" label="次数" hint="当前筛选范围内的样本数量" value={summary?.count ?? 0} />
          <div className="grid gap-0.5 text-right text-xs">
            <MetricStat label="平均耗时" field="avgMs" hint="当前范围内全部样本耗时的算术平均值" value={summary?.avgMs} />
            <MetricStat label="中位耗时" field="p50Ms" hint="一半记录低于该耗时，用于观察常见体验" value={summary?.p50Ms} />
            <MetricStat label="慢端耗时" field="p95Ms" hint="较慢体验侧的耗时，用于发现长尾问题" value={summary?.p95Ms} />
            <MetricStat label="最慢一次" field="maxMs" hint="当前范围内耗时最长的一次记录" value={summary?.maxMs} />
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <MetricFootStat label="慢次数" field="slowCount" hint="超过慢阈值的次数" value={summary?.slowCount ?? 0} />
          <MetricFootStat label="错误" field="errorCount" hint="当前范围内的错误事件数量" value={summary?.errorCount ?? 0} />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricNumber({ label, field, hint, value }: { label: string; field: string; hint: string; value: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <strong className="cursor-help text-[30px] leading-none text-zinc-950 tabular-nums">{compactNumber(value)}</strong>
      </TooltipTrigger>
      <TooltipContent>
        <FieldHint label={label} field={field} hint={hint} />
      </TooltipContent>
    </Tooltip>
  );
}

function MetricStat({ label, field, hint, value }: { label: string; field: string; hint: string; value?: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="grid cursor-help grid-cols-[4.5rem_auto] items-baseline gap-1">
          <span className="text-zinc-400">{label}</span>
          <span className="text-zinc-600 tabular-nums">{formatDuration(value)}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <FieldHint label={label} field={field} hint={hint} />
      </TooltipContent>
    </Tooltip>
  );
}

function MetricFootStat({ label, field, hint, value }: { label: string; field: string; hint: string; value: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help">
          {label} {value}
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
