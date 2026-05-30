import { Link } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/common/empty-state';
import { MetricCard } from './metric-card';
import type { PerformanceMetricSummary } from '../../shared/datasource/types';
import { formatDateTime, formatDuration } from '../../shared/formatting/format';
import { statusLabel } from '../../shared/event-model/status';

export function PerformanceDetailPage({
  title,
  description,
  icon,
  metric,
  emphasis,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  metric?: PerformanceMetricSummary;
  emphasis?: string;
}) {
  const events = metric?.events ?? [];

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto p-2 xl:grid-cols-[360px_minmax(680px,1fr)] xl:overflow-hidden">
      <aside className="grid min-h-[260px] gap-2 xl:min-h-0 xl:grid-rows-[auto_minmax(0,1fr)]">
        <MetricCard title={title} icon={icon} summary={metric} emphasis={emphasis} />
        <Card className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <CardHeader>
            <CardTitle>明细能力</CardTitle>
            <CardDescription>第一版先承接摘要和最近记录，后续补趋势图、阈值线和点位回查。</CardDescription>
          </CardHeader>
          <CardContent className="grid content-start gap-2 text-sm text-zinc-600">
            <p>{description}</p>
            <Button asChild variant="secondary">
              <Link to="/sessions">
                去 Session 检索
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </aside>

      <section className="grid min-h-[520px] xl:min-h-0">
        <Card className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <CardHeader>
            <CardTitle>{title}记录</CardTitle>
            <CardDescription>点击记录进入对应 Session Detail，再选中相关节点排查。</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 overflow-auto p-0">
            {events.length === 0 ? (
              <div className="p-3">
                <EmptyState title="暂无记录" description="当前筛选范围内还没有可展示的记录。" />
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {events.map((event, index) => (
                  <PerformanceRecord key={event.eventId ?? `${event.sessionId ?? 'record'}-${index}`} event={event} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function PerformanceRecord({ event }: { event: PerformanceMetricSummary['events'][number] }) {
  const disabled = !event.sessionId;

  const content = (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-2 text-left hover:bg-teal-50">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <strong className="min-w-0 truncate text-sm text-zinc-950">{event.name ?? '-'}</strong>
          <span className="text-xs text-zinc-500">{statusLabel(event.status)}</span>
        </div>
        <div className="mt-1 truncate text-xs text-zinc-500">
          {formatDateTime(event.timestamp)} · {event.route ?? '-'} · {event.sessionId ?? '-'}
        </div>
      </div>
      <div className="self-center text-right text-xs tabular-nums text-zinc-500">{formatDuration(event.durationMs)}</div>
    </div>
  );

  if (disabled) return <div>{content}</div>;
  return (
    <Link to="/sessions/$sessionId" params={{ sessionId: event.sessionId ?? '-' }}>
      {content}
    </Link>
  );
}
