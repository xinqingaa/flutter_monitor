import { useParams, useSearch } from '@tanstack/react-router';
import { GitBranch, ListTree } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CollapsiblePanel, CollapsiblePanelAction, useCollapsiblePanel } from '../../components/layout/collapsible-panel';
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
  const defaultEvent = firstTimelineEvent(events);
  const searchSelectedEvent = timelineEvents.find((event) => (
    search.eventId ? event.eventId === search.eventId : search.traceId ? event.traceId === search.traceId : false
  ));
  const selectedEvent = timelineEvents.find((event) => event.eventId === selectedEventId) ?? searchSelectedEvent ?? defaultEvent;
  const traceQuery = useTraceQuery(selectedEvent?.traceId);
  const summary = sessionsQuery.data?.sessions.find((session) => session.sessionId === sessionId);
  const leftPanel = useCollapsiblePanel('workbench.sessionDetail.left');
  const rightPanel = useCollapsiblePanel('workbench.sessionDetail.right');

  useEffect(() => {
    setSelectedEventId(search.eventId ?? searchSelectedEvent?.eventId);
  }, [sessionId, search.eventId, search.traceId]);

  return (
    <div
      className={`grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto p-2 xl:overflow-hidden ${
        leftPanel.collapsed && rightPanel.collapsed
          ? 'xl:grid-cols-[40px_minmax(620px,1fr)_40px]'
          : leftPanel.collapsed
            ? 'xl:grid-cols-[40px_minmax(620px,1fr)_470px]'
            : rightPanel.collapsed
              ? 'xl:grid-cols-[340px_minmax(620px,1fr)_40px]'
              : 'xl:grid-cols-[340px_minmax(620px,1fr)_470px]'
      }`}
    >
      <aside className="h-full min-h-[320px] overflow-hidden xl:min-h-0">
        <CollapsiblePanel
          storageKey="workbench.sessionDetail.left"
          title="会话列表"
          icon={ListTree}
          side="left"
          collapsed={leftPanel.collapsed}
          onToggleCollapsed={leftPanel.toggleCollapsed}
        >
          <SessionList
            sessions={sessionsQuery.data?.sessions ?? []}
            selectedSessionId={sessionId}
            panelAction={
              <CollapsiblePanelAction
                side="left"
                title="会话列表"
                collapsed={leftPanel.collapsed}
                onToggleCollapsed={leftPanel.toggleCollapsed}
              />
            }
          />
        </CollapsiblePanel>
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
        <CollapsiblePanel
          storageKey="workbench.sessionDetail.right"
          title="节点诊断"
          icon={GitBranch}
          side="right"
          collapsed={rightPanel.collapsed}
          onToggleCollapsed={rightPanel.toggleCollapsed}
        >
          <EventInspector
            event={selectedEvent}
            traceEvents={prepareSessionEvents(traceQuery.data ?? [])}
            onSelectEvent={(event) => setSelectedEventId(event.eventId)}
            panelAction={
              <CollapsiblePanelAction
                side="right"
                title="节点诊断"
                collapsed={rightPanel.collapsed}
                onToggleCollapsed={rightPanel.toggleCollapsed}
              />
            }
          />
        </CollapsiblePanel>
      </aside>
    </div>
  );
}
