import { Link } from '@tanstack/react-router';
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
}: {
  events: MonitorEvent[];
  selectedEventId?: string;
}) {
  const sorted = sortEvents(events);
  return (
    <Card className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
      <CardHeader>
        <CardTitle>Session Timeline</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 overflow-auto p-0">
        {sorted.length === 0 ? (
          <div className="p-3">
            <EmptyState title="暂无 timeline" description="选择 session 后会展示事件链路。" />
          </div>
        ) : (
          <div className="min-w-[860px] divide-y divide-zinc-100">
            <div className="grid grid-cols-[82px_92px_minmax(180px,1.2fr)_minmax(120px,0.8fr)_80px_120px] gap-2 bg-zinc-50 px-3 py-2 text-[11px] font-medium text-zinc-500">
              <span>time</span>
              <span>kind</span>
              <span>name</span>
              <span>route</span>
              <span>duration</span>
              <span>trace</span>
            </div>
            {sorted.map((event) => {
              const labels = issueLabels(event);
              return (
                <Link
                  key={event.eventId}
                  to="/events/$eventId"
                  params={{ eventId: event.eventId ?? '-' }}
                  className={cn(
                    'grid grid-cols-[82px_92px_minmax(180px,1.2fr)_minmax(120px,0.8fr)_80px_120px] items-center gap-2 px-3 py-2 text-[12px] hover:bg-teal-50',
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
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
