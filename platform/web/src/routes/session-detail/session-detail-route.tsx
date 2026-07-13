import { Link, useParams, useSearch } from '@tanstack/react-router';
import { GitBranch, ListTree, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { EmptyState } from '../../components/common/empty-state';
import { CollapsiblePanel, CollapsiblePanelAction, FloatingPanelToggle, useCollapsiblePanel } from '../../components/layout/collapsible-panel';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/common/legacy-dialog';
import { IconTooltipButton } from '../../components/common/icon-tooltip-button';
import { Input } from '../../components/ui/input';
import { EventInspector } from '../../features/inspector/event-inspector';
import { HttpInspectorDialog } from '../../features/inspector/http-inspector';
import { SessionConsoleView } from '../../features/session-console/session-console-view';
import { SessionHeader } from '../../features/session/session-header';
import { SessionList } from '../../features/session/session-list';
import { SessionRail } from '../../features/session/session-rail';
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
  const [sideSearchDraft, setSideSearchDraft] = useState('');
  const [sideSearchOpen, setSideSearchOpen] = useState(false);
  const sessionQuery = useSessionQuery(sessionId);
  const scopedSessionQuery = useSessionsQuery({ ...scopeQueryFilters, sessionId, limit: 1 });
  const sessionsQuery = useSessionsQuery({ ...scopeQueryFilters, sessionId: sideSessionId || undefined, limit: 50 });
  const sessionConsoleQuery = useSessionConsoleQuery(sessionId);
  const events = useMemo(() => sortEvents(sessionQuery.data ?? []), [sessionQuery.data]);
  const currentSessionInScope = !scopeActive || Boolean(scopedSessionQuery.data?.sessions.some((session) => session.sessionId === sessionId));
  const visibleEvents = currentSessionInScope ? events : [];
  const timelineEvents = useMemo(() => prepareSessionEvents(events), [events]);
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const [httpDetailEventId, setHttpDetailEventId] = useState<string>();
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
  const httpDetailQuery = useEventQuery(currentSessionInScope ? httpDetailEventId : undefined);
  const httpDetailEvent = httpDetailQuery.data
    ?? visibleEvents.find((event) => event.eventId === httpDetailEventId)
    ?? timelineEvents.find((event) => event.eventId === httpDetailEventId);
  const traceQuery = useTraceQuery(currentSessionInScope ? selectedEvent?.traceId : undefined);
  const summary = sessionsQuery.data?.sessions.find((session) => session.sessionId === sessionId);
  const leftPanel = useCollapsiblePanel('workbench.sessionDetail.left');
  const rightPanel = useCollapsiblePanel('workbench.sessionDetail.right');
  const leftWidth = useResizableWidth('workbench.sessionDetail.leftWidth', 340, 280, 460);
  const rightWidth = useResizableWidth('workbench.sessionDetail.rightWidth', 470, 380, 760);
  const sideSessions = sessionsQuery.data?.sessions ?? [];
  const layoutColumns = leftPanel.collapsed && rightPanel.collapsed
    ? '104px minmax(620px,1fr)'
    : leftPanel.collapsed
      ? `104px minmax(620px,1fr) ${rightWidth.width}px`
      : rightPanel.collapsed
        ? `${leftWidth.width}px minmax(620px,1fr)`
        : `${leftWidth.width}px minmax(620px,1fr) ${rightWidth.width}px`;
  const layoutStyle = { '--session-detail-columns': layoutColumns } as CSSProperties;

  useEffect(() => {
    setSelectedEventId(search.eventId ?? searchSelectedRow?.eventId ?? searchSelectedEvent?.eventId);
  }, [sessionId, search.eventId, search.traceId, searchSelectedRow?.eventId, searchSelectedEvent?.eventId]);

  useEffect(() => {
    setHttpDetailEventId(undefined);
  }, [sessionId]);

  useEffect(() => {
    if (!sideSearchOpen) return undefined;
    const handle = window.setTimeout(() => {
      setSideSessionId(sideSearchDraft.trim());
    }, 300);
    return () => window.clearTimeout(handle);
  }, [sideSearchDraft, sideSearchOpen]);

  function openHttpDetail(eventId: string) {
    setSelectedEventId(eventId);
    setHttpDetailEventId(eventId);
  }

  function openSideSearch() {
    setSideSearchDraft(sideSessionId);
    setSideSearchOpen(true);
  }

  function closeSideSearch() {
    setSideSessionId(sideSearchDraft.trim());
    setSideSearchOpen(false);
  }

  function clearSideSearch() {
    setSideSearchDraft('');
    setSideSessionId('');
  }

  return (
    <>
      <div
        className="relative grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto p-2 xl:overflow-hidden xl:[grid-template-columns:var(--session-detail-columns)]"
        style={layoutStyle}
      >
      <aside className="relative h-full min-h-[320px] overflow-hidden xl:min-h-0">
        <CollapsiblePanel
          storageKey="workbench.sessionDetail.left"
          title="会话列表"
          icon={ListTree}
          side="left"
          collapsed={leftPanel.collapsed}
          onToggleCollapsed={leftPanel.toggleCollapsed}
          collapsedContent={(
            <SessionRail
              sessions={sideSessions}
              selectedSessionId={sessionId}
              title="会话列表"
              side="left"
              onExpand={leftPanel.toggleCollapsed}
              onSearch={openSideSearch}
              searchActive={sideSessionId.trim().length > 0}
              onClearSearch={clearSideSearch}
            />
          )}
        >
          <SessionList
            sessions={sideSessions}
            selectedSessionId={sessionId}
            headerContentPlacement="header"
            headerContent={(
              <Input
                aria-label="左侧 Session ID"
                className="h-8 w-full"
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
        {!leftPanel.collapsed ? (
          <PanelResizeHandle
            side="left"
            label="调整左侧栏宽度"
            width={leftWidth.width}
            min={leftWidth.min}
            max={leftWidth.max}
            onResize={leftWidth.startResize}
            onNudge={leftWidth.nudge}
            onReset={leftWidth.reset}
          />
        ) : null}
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
              inspectorCollapsed={rightPanel.collapsed}
              onOpenHttpDetail={openHttpDetail}
              onExpandInspector={() => rightPanel.setCollapsed(false)}
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
      {rightPanel.collapsed ? (
        <FloatingPanelToggle
          side="right"
          title="节点诊断"
          collapsed={rightPanel.collapsed}
          onToggleCollapsed={rightPanel.toggleCollapsed}
          className="absolute right-3 top-1/2 z-20 -translate-y-1/2"
        />
      ) : (
        <aside className="relative h-full min-h-[560px] overflow-hidden xl:min-h-0">
          <PanelResizeHandle
            side="right"
            label="调整右侧栏宽度"
            width={rightWidth.width}
            min={rightWidth.min}
            max={rightWidth.max}
            onResize={rightWidth.startResize}
            onNudge={rightWidth.nudge}
            onReset={rightWidth.reset}
          />
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
      )}
      </div>
      <HttpInspectorDialog
        open={Boolean(httpDetailEventId && httpDetailEvent?.name === 'http.client')}
        event={httpDetailEvent?.name === 'http.client' ? httpDetailEvent : undefined}
        relatedEvents={timelineEvents}
        onClose={() => setHttpDetailEventId(undefined)}
        onSelectEvent={(event) => {
          if (!event.eventId) return;
          setSelectedEventId(event.eventId);
          setHttpDetailEventId(event.name === 'http.client' ? event.eventId : undefined);
        }}
      />
      <Dialog
        open={sideSearchOpen}
        onClose={closeSideSearch}
        className="max-w-md"
        title="搜索会话"
        description="按 Session ID 过滤左侧会话列表。"
      >
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            autoFocus
            aria-label="搜索 Session ID"
            className="h-9 pl-8 pr-9"
            placeholder="输入 Session ID"
            value={sideSearchDraft}
            onChange={(event) => setSideSearchDraft(event.target.value)}
          />
          {sideSearchDraft ? (
            <IconTooltipButton
              type="button"
              variant="ghost"
              size="icon"
              label="清空搜索"
              icon={X}
              onClick={clearSideSearch}
              className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-zinc-500 hover:text-zinc-900"
            />
          ) : null}
        </div>
      </Dialog>
    </>
  );
}

function useResizableWidth(storageKey: string, defaultWidth: number, min: number, max: number) {
  const [width, setWidth] = useState(defaultWidth);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;
    const parsed = Number(stored);
    if (Number.isFinite(parsed)) setWidth(clamp(parsed, min, max));
  }, [max, min, storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, String(width));
  }, [storageKey, width]);

  const setClampedWidth = useCallback((next: number) => {
    setWidth(clamp(next, min, max));
  }, [max, min]);

  const startResize = useCallback((side: 'left' | 'right', event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;

    function handleMove(moveEvent: PointerEvent) {
      const delta = side === 'left' ? moveEvent.clientX - startX : startX - moveEvent.clientX;
      setClampedWidth(startWidth + delta);
    }

    function handleUp() {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }, [setClampedWidth, width]);

  const nudge = useCallback((delta: number) => {
    setClampedWidth(width + delta);
  }, [setClampedWidth, width]);

  const reset = useCallback(() => {
    setWidth(defaultWidth);
  }, [defaultWidth]);

  return {
    width,
    min,
    max,
    startResize,
    nudge,
    reset,
  };
}

function PanelResizeHandle({
  side,
  label,
  width,
  min,
  max,
  onResize,
  onNudge,
  onReset,
}: {
  side: 'left' | 'right';
  label: string;
  width: number;
  min: number;
  max: number;
  onResize: (side: 'left' | 'right', event: ReactPointerEvent<HTMLElement>) => void;
  onNudge: (delta: number) => void;
  onReset: () => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onNudge(side === 'left' ? -16 : 16);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      onNudge(side === 'left' ? 16 : -16);
    } else if (event.key === 'Home') {
      event.preventDefault();
      onNudge(min - width);
    } else if (event.key === 'End') {
      event.preventDefault();
      onNudge(max - width);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onReset();
    }
  }

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(width)}
      title={`${label}，双击恢复默认宽度`}
      onPointerDown={(event) => onResize(side, event)}
      onKeyDown={handleKeyDown}
      onDoubleClick={onReset}
      style={{ cursor: 'col-resize' }}
      className={[
        'group absolute top-0 z-30 hidden h-full w-3 items-center justify-center outline-none xl:flex',
        side === 'left' ? '-right-2' : '-left-2',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        style={{ cursor: 'col-resize' }}
        className="h-10 w-1 rounded-full bg-zinc-200 opacity-0 transition group-hover:opacity-100 group-focus-visible:bg-teal-500 group-focus-visible:opacity-100 group-active:bg-teal-500 group-active:opacity-100"
      />
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
