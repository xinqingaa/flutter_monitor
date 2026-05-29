import { useParams } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { EventInspector } from '../../features/inspector/event-inspector';
import { SessionHeader } from '../../features/session/session-header';
import { SessionList } from '../../features/session/session-list';
import { SessionTimeline } from '../../features/timeline/session-timeline';
import { useSessionQuery, useSessionsQuery, useTraceQuery } from '../../shared/datasource/queries';
import { sortEvents } from '../../shared/event-model/accessors';
import { downloadJson } from '../../shared/formatting/download';

export function SessionDetailRoute() {
  const { sessionId } = useParams({ from: '/sessions/$sessionId' });
  const sessionQuery = useSessionQuery(sessionId);
  const sessionsQuery = useSessionsQuery({ limit: 50 });
  const events = useMemo(() => sortEvents(sessionQuery.data ?? []), [sessionQuery.data]);
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const defaultEvent = events.find((event) => event.status === 'error') ?? events[0];
  const selectedEvent = events.find((event) => event.eventId === selectedEventId) ?? defaultEvent;
  const traceQuery = useTraceQuery(selectedEvent?.traceId);
  const summary = sessionsQuery.data?.sessions.find((session) => session.sessionId === sessionId);

  useEffect(() => {
    setSelectedEventId(undefined);
  }, [sessionId]);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto p-2 xl:grid-cols-[300px_minmax(620px,1fr)_430px] xl:overflow-hidden">
      <aside className="h-full min-h-[320px] overflow-hidden xl:min-h-0">
        <SessionList sessions={sessionsQuery.data?.sessions ?? []} selectedSessionId={sessionId} />
      </aside>
      <section className="grid min-h-[620px] grid-rows-[auto_minmax(0,1fr)] gap-2 xl:min-h-0">
        <SessionHeader
          sessionId={sessionId}
          events={events}
          summary={summary}
          onExport={() => downloadJson(`flutter-monitor-session-${sessionId}.json`, {
            sessionId,
            exportedAt: new Date().toISOString(),
            count: events.length,
            events,
          })}
        />
        <SessionTimeline
          events={events}
          selectedEventId={selectedEvent?.eventId}
          onSelectEvent={(event) => setSelectedEventId(event.eventId)}
        />
      </section>
      <aside className="h-full min-h-[560px] overflow-hidden xl:min-h-0">
        <EventInspector event={selectedEvent} traceEvents={traceQuery.data ?? []} />
      </aside>
    </div>
  );
}
