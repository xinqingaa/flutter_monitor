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
        <CardTitle>Live / Recent Events</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 overflow-auto p-0">
        {events.length === 0 ? (
          <div className="p-3">
            <EmptyState title="暂无事件" description="LocalLive 收到事件后会实时追加。" />
          </div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {events.slice(0, 24).map((event) => (
              <Link
                key={event.eventId}
                to="/events/$eventId"
                params={{ eventId: event.eventId ?? '-' }}
                className="grid grid-cols-[78px_86px_minmax(0,1fr)] gap-2 px-3 py-2 text-[12px] hover:bg-teal-50"
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
