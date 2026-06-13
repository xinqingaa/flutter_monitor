import { Link, useParams, useSearch } from '@tanstack/react-router';
import { GitBranch, ListTree } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '../../components/common/empty-state';
import { CollapsiblePanel, CollapsiblePanelAction, useCollapsiblePanel } from '../../components/layout/collapsible-panel';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { EventInspector } from '../../features/inspector/event-inspector';
import { SessionConsoleView } from '../../features/session-console/session-console-view';
import { SessionHeader } from '../../features/session/session-header';
import { SessionList } from '../../features/session/session-list';
import { hasActiveScope, pickScopeSearch, scopeToSessionFilters, useScopeFilters } from '../../features/scope/scope-filters';
import { firstTimelineEvent, prepareSessionEvents } from '../../features/timeline/session-segments';
import { useEventQuery, useSessionConsoleQuery, useSessionQuery, useSessionsQuery, useTraceQuery } from '../../shared/datasource/queries';
import { sortEvents } from '../../shared/event-model/accessors';
import { downloadJson } from '../../shared/formatting/download';

export function SessionDetailRoute() {
  const { sessionId } = useParams({ from: '/sessions/$sessionId' });
  const search = useSearch({ from: '/sessions/$sessionId' }) as { eventId?: string; traceId?: string };
  const { filters: scopeFilters } = useScopeFilters();
  const scopeQueryFilters = useMemo(() => scopeToSessionFilters(scopeFilters), [scopeFilters]);
  const scopeActive = hasActiveScope(scopeFilters);
  const [sideSessionId, setSideSessionId] = useState('');
  const sessionQuery = useSessionQuery(sessionId);
  const scopedSessionQuery = useSessionsQuery({ ...scopeQueryFilters, sessionId, limit: 1 });
  const sessionsQuery = useSessionsQuery({ ...scopeQueryFilters, sessionId: sideSessionId || undefined, limit: 50 });
  const sessionConsoleQuery = useSessionConsoleQuery(sessionId);
  const events = useMemo(() => sortEvents(sessionQuery.data ?? []), [sessionQuery.data]);
  const currentSessionInScope = !scopeActive || Boolean(scopedSessionQuery.data?.sessions.some((session) => session.sessionId === sessionId));
  const visibleEvents = currentSessionInScope ? events : [];
  const timelineEvents = useMemo(() => prepareSessionEvents(events), [events]);
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const consoleRows = sessionConsoleQuery.data?.rows ?? [];
  const defaultEventId = consoleRows[0]?.eventId ?? firstTimelineEvent(events)?.eventId;
  const searchSelectedRow = consoleRows.find((row) => (
    search.eventId ? row.eventId === search.eventId : search.traceId ? row.traceId === search.traceId : false
  ));
  const searchSelectedEvent = timelineEvents.find((event) => (
    search.eventId ? event.eventId === search.eventId : search.traceId ? event.traceId === search.traceId : false
  ));
  const effectiveSelectedEventId = selectedEventId ?? searchSelectedRow?.eventId ?? searchSelectedEvent?.eventId ?? defaultEventId;
  const fallbackSelectedEvent = timelineEvents.find((event) => event.eventId === effectiveSelectedEventId) ?? searchSelectedEvent ?? firstTimelineEvent(events);
  const eventQuery = useEventQuery(currentSessionInScope ? effectiveSelectedEventId : undefined);
  const selectedEvent = eventQuery.data ?? fallbackSelectedEvent;
  const traceQuery = useTraceQuery(currentSessionInScope ? selectedEvent?.traceId : undefined);
  const summary = sessionsQuery.data?.sessions.find((session) => session.sessionId === sessionId);
  const leftPanel = useCollapsiblePanel('workbench.sessionDetail.left');
  const rightPanel = useCollapsiblePanel('workbench.sessionDetail.right');

  useEffect(() => {
    setSelectedEventId(search.eventId ?? searchSelectedRow?.eventId ?? searchSelectedEvent?.eventId);
  }, [sessionId, search.eventId, search.traceId, searchSelectedRow?.eventId, searchSelectedEvent?.eventId]);

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
            headerContent={(
              <Input
                aria-label="左侧 Session ID"
                className="m-2 mb-0 h-8 w-[calc(100%-1rem)]"
                placeholder="搜索 Session ID"
                value={sideSessionId}
                onChange={(event) => setSideSessionId(event.target.value)}
              />
            )}
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
        {currentSessionInScope ? (
          <>
            <SessionHeader
              sessionId={sessionId}
              events={visibleEvents}
              summary={sessionConsoleQuery.data?.summary ?? summary}
              consoleData={sessionConsoleQuery.data}
              onExport={() => downloadJson(`flutter-monitor-session-${sessionId}.json`, {
                sessionId,
                exportedAt: new Date().toISOString(),
                count: visibleEvents.length,
                events: visibleEvents,
              })}
            />
            <SessionConsoleView
              consoleData={sessionConsoleQuery.data}
              selectedEventId={effectiveSelectedEventId}
              onSelectEvent={setSelectedEventId}
            />
          </>
        ) : (
          <div className="grid min-h-0 place-items-center rounded-md border border-zinc-200 bg-white p-4">
            <div className="grid max-w-md gap-3">
              <EmptyState
                title="当前会话不在顶部筛选范围内"
                description="顶部范围已经排除了这个 session，链路和诊断内容不会展示。"
              />
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild variant="secondary">
                  <Link to="/sessions" search={(current) => pickScopeSearch(current)}>返回 Session 列表</Link>
                </Button>
                <Button asChild variant="default">
                  <Link to="/sessions/$sessionId" params={{ sessionId }}>清空顶部筛选</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
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
          {currentSessionInScope ? (
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
          ) : (
            <div className="grid h-full min-h-0 place-items-center bg-white p-3">
              <EmptyState title="无诊断内容" description="当前会话已被顶部范围排除。" />
            </div>
          )}
        </CollapsiblePanel>
      </aside>
    </div>
  );
}
