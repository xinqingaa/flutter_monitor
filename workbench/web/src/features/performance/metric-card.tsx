import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/card';
import { formatDuration } from '../../shared/formatting/format';
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
      <CardContent className="grid gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-[12px] font-medium text-zinc-600">
            <Icon className="size-4 shrink-0" />
            <span className="truncate">{title}</span>
          </div>
          {emphasis ? <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600">{emphasis}</span> : null}
        </div>
        <div className="flex items-end justify-between gap-3">
          <strong className="text-[24px] leading-none text-zinc-950">{summary?.count ?? 0}</strong>
          <div className="text-right text-[11px] text-zinc-500">
            <div>p95 {formatDuration(summary?.p95Ms)}</div>
            <div>max {formatDuration(summary?.maxMs)}</div>
          </div>
        </div>
        <div className="text-[11px] text-zinc-500">
          slow {summary?.slowCount ?? 0} · error {summary?.errorCount ?? 0}
        </div>
      </CardContent>
    </Card>
  );
}
