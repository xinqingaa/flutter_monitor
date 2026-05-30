import { Link } from '@tanstack/react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { EmptyState } from '../../components/common/empty-state';
import { EventKindBadge } from '../../features/timeline/status-badge';
import { useRecentQuery } from '../../shared/datasource/queries';
import { routeOf } from '../../shared/event-model/accessors';
import { formatDateTime, formatDuration } from '../../shared/formatting/format';

export function EventsRoute() {
  const recentQuery = useRecentQuery(200);
  const events = recentQuery.data ?? [];

  return (
    <div className="grid h-full min-h-0 p-2">
      <Card className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        <CardHeader>
          <CardTitle>Event 列表</CardTitle>
          <CardDescription>偏开发态的原始事件入口；常规排查优先从 Session Detail 进入。</CardDescription>
        </CardHeader>
        <CardContent className="min-h-0 overflow-auto p-0">
          {events.length === 0 ? (
            <div className="p-3">
              <EmptyState title="暂无事件" description="本地实时模式收到事件后会追加到这里。" />
            </div>
          ) : (
            <div className="min-w-[760px] divide-y divide-zinc-100">
              {events.map((event) => (
                <Link
                  key={event.eventId}
                  to="/events/$eventId"
                  params={{ eventId: event.eventId ?? '-' }}
                  className="grid grid-cols-[150px_96px_minmax(0,1fr)_160px_90px] items-center gap-2 px-3 py-2 text-sm hover:bg-teal-50"
                >
                  <span className="text-xs text-zinc-500">{formatDateTime(event.timestamp)}</span>
                  <EventKindBadge event={event} />
                  <span className="min-w-0 truncate font-medium text-zinc-900">{event.name ?? '-'}</span>
                  <span className="min-w-0 truncate text-xs text-zinc-500">{routeOf(event)}</span>
                  <span className="text-right text-xs tabular-nums text-zinc-500">{formatDuration(event.durationMs)}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
