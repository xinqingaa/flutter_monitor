import { AlertTriangle, Clock, Gauge, Globe2, User } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent } from '../../components/ui/card';
import type { MonitorEvent, SessionSummary } from '../../shared/datasource/types';
import { appVersionOf, environmentOf, routeOf, userIdOf } from '../../shared/event-model/accessors';
import { formatDateTime, formatDuration } from '../../shared/formatting/format';

export function SessionHeader({
  sessionId,
  events,
  summary,
}: {
  sessionId: string;
  events: MonitorEvent[];
  summary?: SessionSummary;
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
          <Badge tone={summary?.status === 'error' ? 'danger' : 'neutral'}>{summary?.status ?? 'ok'}</Badge>
        </div>
        <div className="grid grid-cols-5 gap-2">
          <HeaderMetric icon={Clock} label="duration" value={formatDuration(duration)} />
          <HeaderMetric icon={User} label="user" value={summary?.userId ?? userIdOf(contextEvent)} />
          <HeaderMetric icon={Globe2} label="route" value={summary?.route ?? routeOf(contextEvent)} />
          <HeaderMetric icon={AlertTriangle} label="errors" value={String(summary?.errorCount ?? 0)} />
          <HeaderMetric icon={Gauge} label="jank / http_fail" value={`${summary?.jankCount ?? 0} / ${summary?.failedHttpCount ?? 0}`} />
        </div>
        <div className="text-[11px] text-zinc-500">
          app {summary?.appVersion ?? appVersionOf(contextEvent)} · env {summary?.environment ?? environmentOf(contextEvent)} · events {events.length}
        </div>
      </CardContent>
    </Card>
  );
}

function HeaderMetric({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5">
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-0.5 truncate text-[12px] font-medium text-zinc-950">{value}</div>
    </div>
  );
}
