import { useParams, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { EventInspector } from '../../features/inspector/event-inspector';
import { SessionHeader } from '../../features/session/session-header';
import { SessionList } from '../../features/session/session-list';
import { SessionTimeline } from '../../features/timeline/session-timeline';
import { firstTimelineEvent, prepareSessionEvents } from '../../features/timeline/session-segments';
import { useSessionQuery, useSessionsQuery, useTraceQuery } from '../../shared/datasource/queries';
import { sortEvents } from '../../shared/event-model/accessors';
import { downloadJson } from '../../shared/formatting/download';

export function SessionDetailRoute() {
  const { sessionId } = useParams({ from: '/sessions/$sessionId' });
  const search = useSearch({ from: '/sessions/$sessionId' }) as { eventId?: string; traceId?: string };
  const sessionQuery = useSessionQuery(sessionId);
  const sessionsQuery = useSessionsQuery({ limit: 50 });
  const events = useMemo(() => sortEvents(sessionQuery.data ?? []), [sessionQuery.data]);
  const timelineEvents = useMemo(() => prepareSessionEvents(events), [events]);
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const defaultEvent = timelineEvents.find((event) => event.status === 'error') ?? firstTimelineEvent(events);
  const searchSelectedEvent = timelineEvents.find((event) => (
    search.eventId ? event.eventId === search.eventId : search.traceId ? event.traceId === search.traceId : false
  ));
  const selectedEvent = timelineEvents.find((event) => event.eventId === selectedEventId) ?? searchSelectedEvent ?? defaultEvent;
  const traceQuery = useTraceQuery(selectedEvent?.traceId);
  const summary = sessionsQuery.data?.sessions.find((session) => session.sessionId === sessionId);

  useEffect(() => {
    setSelectedEventId(search.eventId);
  }, [sessionId, search.eventId, search.traceId]);

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
        <EventInspector event={selectedEvent} traceEvents={prepareSessionEvents(traceQuery.data ?? [])} onSelectEvent={(event) => setSelectedEventId(event.eventId)} />
      </aside>
    </div>
  );
}
