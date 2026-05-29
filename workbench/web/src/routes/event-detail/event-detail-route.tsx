import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { EventInspector } from '../../features/inspector/event-inspector';
import { SessionTimeline } from '../../features/timeline/session-timeline';
import { useEventQuery, useSessionQuery, useTraceQuery } from '../../shared/datasource/queries';

export function EventDetailRoute() {
  const { eventId } = useParams({ from: '/events/$eventId' });
  const eventQuery = useEventQuery(eventId);
  const event = eventQuery.data;
  const sessionQuery = useSessionQuery(event?.sessionId);
  const traceQuery = useTraceQuery(event?.traceId);
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const selectedEvent = (sessionQuery.data ?? []).find((item) => item.eventId === selectedEventId) ?? event;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 p-2">
      <div className="flex items-center justify-between">
        {event?.sessionId ? (
          <Button asChild variant="secondary">
            <Link to="/sessions/$sessionId" params={{ sessionId: event.sessionId }}>
              <ArrowLeft className="size-4" />
              返回会话
            </Link>
          </Button>
        ) : (
          <Button asChild variant="secondary">
            <Link to="/">
              <ArrowLeft className="size-4" />
              返回首页
            </Link>
          </Button>
        )}
        <div className="text-xs text-zinc-500">{eventId}</div>
      </div>
      <div className="grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto xl:grid-cols-[minmax(640px,1fr)_520px] xl:overflow-hidden">
        <SessionTimeline
          events={sessionQuery.data ?? []}
          selectedEventId={selectedEvent?.eventId ?? eventId}
          onSelectEvent={(item) => setSelectedEventId(item.eventId)}
        />
        <EventInspector event={selectedEvent} traceEvents={traceQuery.data ?? []} />
      </div>
    </div>
  );
}
