import { useParams } from '@tanstack/react-router';
import { useMemo } from 'react';
import { EventInspector } from '../../features/inspector/event-inspector';
import { SessionHeader } from '../../features/session/session-header';
import { SessionList } from '../../features/session/session-list';
import { SessionTimeline } from '../../features/timeline/session-timeline';
import { useSessionQuery, useSessionsQuery, useTraceQuery } from '../../shared/datasource/queries';
import { sortEvents } from '../../shared/event-model/accessors';

export function SessionDetailRoute() {
  const { sessionId } = useParams({ from: '/sessions/$sessionId' });
  const sessionQuery = useSessionQuery(sessionId);
  const sessionsQuery = useSessionsQuery({ limit: 50 });
  const events = useMemo(() => sortEvents(sessionQuery.data ?? []), [sessionQuery.data]);
  const selectedEvent = events.find((event) => event.status === 'error') ?? events[0];
  const traceQuery = useTraceQuery(selectedEvent?.traceId);
  const summary = sessionsQuery.data?.sessions.find((session) => session.sessionId === sessionId);

  return (
    <div className="grid h-full min-h-0 grid-cols-[320px_minmax(700px,1fr)_430px] gap-3 p-3">
      <aside className="h-full min-h-0 overflow-hidden">
        <SessionList sessions={sessionsQuery.data?.sessions ?? []} selectedSessionId={sessionId} />
      </aside>
      <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
        <SessionHeader sessionId={sessionId} events={events} summary={summary} />
        <SessionTimeline events={events} selectedEventId={selectedEvent?.eventId} />
      </section>
      <aside className="h-full min-h-0 overflow-hidden">
        <EventInspector event={selectedEvent} traceEvents={traceQuery.data ?? []} />
      </aside>
    </div>
  );
}
