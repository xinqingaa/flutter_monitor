import { AlertTriangle, Clock, Download, Gauge, Globe2, User } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import type { MonitorEvent, SessionSummary } from '../../shared/datasource/types';
import { appVersionOf, environmentOf, routeOf, userIdOf } from '../../shared/event-model/accessors';
import { formatDateTime, formatDuration } from '../../shared/formatting/format';
import { statusLabel } from '../../shared/event-model/status';

export function SessionHeader({
  sessionId,
  events,
  summary,
  onExport,
}: {
  sessionId: string;
  events: MonitorEvent[];
  summary?: SessionSummary;
  onExport?: () => void;
}) {
  const first = events[0];
  const last = events[events.length - 1];
  const duration = first?.timestamp && last?.timestamp
    ? Date.parse(last.timestamp) - Date.parse(first.timestamp)
    : undefined;
  const contextEvent = events.find((event) => userIdOf(event) !== '-' || routeOf(event) !== '-') ?? first;

  return (
    <Card>
      <CardContent className="grid gap-3 p-3">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[16px] font-semibold text-zinc-950">{sessionId}</h2>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              {formatDateTime(first?.timestamp)} - {formatDateTime(last?.timestamp)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge tone={summary?.status === 'error' ? 'danger' : 'neutral'}>{statusLabel(summary?.status)}</Badge>
            {onExport ? (
              <Button type="button" variant="secondary" onClick={onExport}>
                <Download className="size-4" />
                导出原始 JSON
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          <HeaderMetric icon={Clock} label="持续时间" value={formatDuration(duration)} />
          <HeaderMetric icon={User} label="用户" value={summary?.userId ?? userIdOf(contextEvent)} />
          <HeaderMetric icon={Globe2} label="页面" value={summary?.route ?? routeOf(contextEvent)} />
          <HeaderMetric icon={AlertTriangle} label="错误数" value={String(summary?.errorCount ?? 0)} />
          <HeaderMetric icon={Gauge} label="卡顿 / 失败请求" value={`${summary?.jankCount ?? 0} / ${summary?.failedHttpCount ?? 0}`} />
        </div>
        <div className="text-xs text-zinc-500">
          App {summary?.appVersion ?? appVersionOf(contextEvent)} · 环境 {summary?.environment ?? environmentOf(contextEvent)} · 事件 {events.length}
        </div>
      </CardContent>
    </Card>
  );
}

function HeaderMetric({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-medium text-zinc-950">{value}</div>
    </div>
  );
}
