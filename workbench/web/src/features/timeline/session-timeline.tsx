import { EmptyState } from '../../components/common/empty-state';
import { CopyableId } from '../../components/common/copyable-id';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import type { MonitorEvent } from '../../shared/datasource/types';
import { eventKind, issueLabels, routeOf, sortEvents } from '../../shared/event-model/accessors';
import { formatDuration, formatTime } from '../../shared/formatting/format';
import { EventKindBadge } from './status-badge';
import { Badge } from '../../components/ui/badge';
import { cn } from '../../shared/formatting/cn';

export function SessionTimeline({
  events,
  selectedEventId,
  onSelectEvent,
}: {
  events: MonitorEvent[];
  selectedEventId?: string;
  onSelectEvent?: (event: MonitorEvent) => void;
}) {
  const sorted = sortEvents(events);
  return (
    <Card className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader>
        <CardTitle>会话链路</CardTitle>
        <p className="mt-1 text-xs text-zinc-500">一次 App 使用过程中的启动、页面、请求、错误和行为节点。</p>
      </CardHeader>
      <CardContent className="min-h-0 overflow-auto p-0">
        {sorted.length === 0 ? (
          <div className="p-3">
            <EmptyState title="暂无链路" description="选择会话后会展示完整链路。" />
          </div>
        ) : (
          <div className="min-w-[860px] divide-y divide-zinc-100">
            <div className="grid grid-cols-[90px_96px_minmax(180px,1.2fr)_minmax(120px,0.8fr)_90px_132px] gap-2 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500">
              <span>时间</span>
              <span>类型</span>
              <span>节点</span>
              <span>页面</span>
              <span>耗时</span>
              <span>链路</span>
            </div>
            {sorted.map((event) => {
              const labels = issueLabels(event);
              return (
                <button
                  type="button"
                  key={event.eventId}
                  onClick={() => onSelectEvent?.(event)}
                  className={cn(
                    'grid w-full grid-cols-[90px_96px_minmax(180px,1.2fr)_minmax(120px,0.8fr)_90px_132px] items-center gap-2 px-3 py-2 text-left text-sm hover:bg-teal-50',
                    selectedEventId === event.eventId && 'bg-teal-50',
                    eventKind(event) === 'error' && 'bg-red-50/60 hover:bg-red-50',
                  )}
                >
                  <span className="text-zinc-500">{formatTime(event.timestamp)}</span>
                  <EventKindBadge event={event} />
                  <span className="min-w-0 truncate font-medium text-zinc-900">
                    {event.name ?? '-'}
                    {labels.length > 0 ? (
                      <span className="ml-2 inline-flex gap-1">
                        {labels.slice(0, 2).map((label) => <Badge key={label} tone="warn">{label}</Badge>)}
                      </span>
                    ) : null}
                  </span>
                  <span className="min-w-0 truncate text-zinc-500">{routeOf(event)}</span>
                  <span className="text-zinc-500">{formatDuration(event.durationMs)}</span>
                  <CopyableId value={event.traceId} />
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
