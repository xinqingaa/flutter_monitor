import { Link } from '@tanstack/react-router';
import { EmptyState } from '../../components/common/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import type { MonitorEvent } from '../../shared/datasource/types';
import { routeOf } from '../../shared/event-model/accessors';
import { formatTime } from '../../shared/formatting/format';
import { EventKindBadge } from '../timeline/status-badge';

export function RecentEvents({ events }: { events: MonitorEvent[] }) {
  return (
    <Card className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader>
        <CardTitle>实时事件</CardTitle>
        <p className="mt-1 text-xs text-zinc-500">最近进入工作台的原始事件流</p>
      </CardHeader>
      <CardContent className="min-h-0 overflow-auto p-0">
        {events.length === 0 ? (
          <div className="p-3">
            <EmptyState title="暂无事件" description="本地实时模式收到事件后会追加到这里。" />
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {events.slice(0, 24).map((event) => (
              <Link
                key={event.eventId}
                to="/events/$eventId"
                params={{ eventId: event.eventId ?? '-' }}
                className="grid grid-cols-[88px_96px_minmax(0,1fr)] gap-2 px-3 py-2 text-sm hover:bg-teal-50"
              >
                <span className="text-zinc-500">{formatTime(event.timestamp)}</span>
                <EventKindBadge event={event} />
                <span className="min-w-0 truncate text-zinc-900">
                  {event.name ?? '-'} <span className="text-zinc-400">· {routeOf(event)}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
