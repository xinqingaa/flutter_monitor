import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, GitBranch } from 'lucide-react';
import { useState } from 'react';
import { CollapsiblePanel, CollapsiblePanelAction, FloatingPanelToggle, useCollapsiblePanel } from '../../components/layout/collapsible-panel';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { EventInspector } from '../../features/inspector/event-inspector';
import { prepareSessionEvents } from '../../features/timeline/session-segments';
import { SessionTimeline } from '../../features/timeline/session-timeline';
import { useTraceQuery } from '../../shared/datasource/queries';
import { sortEvents } from '../../shared/event-model/accessors';
import { formatDuration, formatTime } from '../../shared/formatting/format';

export function TraceDetailRoute() {
  const { traceId } = useParams({ from: '/traces/$traceId' });
  const traceQuery = useTraceQuery(traceId);
  const events = sortEvents(traceQuery.data ?? []);
  const timelineEvents = prepareSessionEvents(events);
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const selectedEvent = timelineEvents.find((event) => event.eventId === selectedEventId) ?? timelineEvents[0];
  const first = events[0];
  const last = events[events.length - 1];
  const duration = first?.timestamp && last?.timestamp ? Date.parse(last.timestamp) - Date.parse(first.timestamp) : undefined;
  const rightPanel = useCollapsiblePanel('workbench.traceDetail.right');

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
      <div
        className={`relative grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto xl:overflow-hidden ${
          rightPanel.collapsed ? 'xl:grid-cols-[minmax(640px,1fr)]' : 'xl:grid-cols-[minmax(640px,1fr)_560px]'
        }`}
      >
        <SessionTimeline events={events} selectedEventId={selectedEvent?.eventId} autoExpandSelected={Boolean(selectedEventId)} onSelectEvent={(event) => setSelectedEventId(event.eventId)} />
        {rightPanel.collapsed ? (
          <FloatingPanelToggle
            side="right"
            title="节点诊断"
            collapsed={rightPanel.collapsed}
            onToggleCollapsed={rightPanel.toggleCollapsed}
            className="absolute right-3 top-1/2 z-20 -translate-y-1/2"
          />
        ) : (
          <aside className="min-h-[560px] overflow-hidden xl:min-h-0">
            <CollapsiblePanel
              storageKey="workbench.traceDetail.right"
              title="节点诊断"
              icon={GitBranch}
              side="right"
              collapsed={rightPanel.collapsed}
              onToggleCollapsed={rightPanel.toggleCollapsed}
            >
              <EventInspector
                event={selectedEvent}
                traceEvents={timelineEvents}
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
        )}
      </div>
    </div>
  );
}
