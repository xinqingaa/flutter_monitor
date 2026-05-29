import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
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

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 p-3">
      <div className="flex items-center justify-between">
        {event?.sessionId ? (
          <Button asChild variant="secondary">
            <Link to="/sessions/$sessionId" params={{ sessionId: event.sessionId }}>
              <ArrowLeft className="size-4" />
              返回 Session
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
        <div className="text-[12px] text-zinc-500">{eventId}</div>
      </div>
      <div className="grid h-full min-h-0 grid-cols-[minmax(640px,1fr)_520px] gap-3 overflow-hidden">
        <SessionTimeline events={sessionQuery.data ?? []} selectedEventId={eventId} />
        <EventInspector event={event} traceEvents={traceQuery.data ?? []} />
      </div>
    </div>
  );
}
