import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, GitBranch } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { EventInspector } from '../../features/inspector/event-inspector';
import { SessionTimeline } from '../../features/timeline/session-timeline';
import { useTraceQuery } from '../../shared/datasource/queries';
import { sortEvents } from '../../shared/event-model/accessors';
import { formatDuration, formatTime } from '../../shared/formatting/format';

export function TraceDetailRoute() {
  const { traceId } = useParams({ from: '/traces/$traceId' });
  const traceQuery = useTraceQuery(traceId);
  const events = sortEvents(traceQuery.data ?? []);
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const selectedEvent = events.find((event) => event.eventId === selectedEventId) ?? events[0];
  const first = events[0];
  const last = events[events.length - 1];
  const duration = first?.timestamp && last?.timestamp ? Date.parse(last.timestamp) - Date.parse(first.timestamp) : undefined;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 p-2">
      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="secondary">
              <Link to="/">
                <ArrowLeft className="size-4" />
                首页
              </Link>
            </Button>
            <GitBranch className="size-5 text-zinc-500" />
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold">{traceId}</h2>
              <p className="text-xs text-zinc-500">
                {events.length} 个事件 · {formatTime(first?.timestamp)} - {formatTime(last?.timestamp)} · {formatDuration(duration)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto xl:grid-cols-[minmax(640px,1fr)_520px] xl:overflow-hidden">
        <SessionTimeline events={events} selectedEventId={selectedEvent?.eventId} onSelectEvent={(event) => setSelectedEventId(event.eventId)} />
        <EventInspector event={selectedEvent} traceEvents={events} />
      </div>
    </div>
  );
}
