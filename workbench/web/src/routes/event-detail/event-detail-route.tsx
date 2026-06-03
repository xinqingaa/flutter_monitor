import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, GitBranch } from 'lucide-react';
import { useState } from 'react';
import { CollapsiblePanel, CollapsiblePanelAction, useCollapsiblePanel } from '../../components/layout/collapsible-panel';
import { Button } from '../../components/ui/button';
import { EventInspector } from '../../features/inspector/event-inspector';
import { pickScopeSearch } from '../../features/scope/scope-filters';
import { prepareSessionEvents } from '../../features/timeline/session-segments';
import { SessionTimeline } from '../../features/timeline/session-timeline';
import { useEventQuery, useSessionQuery, useTraceQuery } from '../../shared/datasource/queries';

export function EventDetailRoute() {
  const { eventId } = useParams({ from: '/events/$eventId' });
  const eventQuery = useEventQuery(eventId);
  const event = eventQuery.data;
  const sessionQuery = useSessionQuery(event?.sessionId);
  const traceQuery = useTraceQuery(event?.traceId);
  const timelineEvents = prepareSessionEvents(sessionQuery.data ?? []);
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const selectedEvent = timelineEvents.find((item) => item.eventId === selectedEventId) ?? event;
  const rightPanel = useCollapsiblePanel('workbench.eventDetail.right');

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 p-2">
      <div className="flex items-center justify-between">
        {event?.sessionId ? (
          <Button asChild variant="secondary">
            <Link to="/sessions/$sessionId" params={{ sessionId: event.sessionId }} search={(current) => pickScopeSearch(current)}>
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
      <div
        className={`grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto xl:overflow-hidden ${
          rightPanel.collapsed ? 'xl:grid-cols-[minmax(640px,1fr)_40px]' : 'xl:grid-cols-[minmax(640px,1fr)_560px]'
        }`}
      >
        <SessionTimeline
          events={sessionQuery.data ?? []}
          selectedEventId={selectedEvent?.eventId ?? eventId}
          onSelectEvent={(item) => setSelectedEventId(item.eventId)}
        />
        <aside className="min-h-[560px] overflow-hidden xl:min-h-0">
          <CollapsiblePanel
            storageKey="workbench.eventDetail.right"
            title="节点诊断"
            icon={GitBranch}
            side="right"
            collapsed={rightPanel.collapsed}
            onToggleCollapsed={rightPanel.toggleCollapsed}
          >
            <EventInspector
              event={selectedEvent}
              traceEvents={prepareSessionEvents(traceQuery.data ?? [])}
              onSelectEvent={(item) => setSelectedEventId(item.eventId)}
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
    </div>
  );
}
