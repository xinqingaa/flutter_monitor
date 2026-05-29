import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  FileJson,
  GitBranch,
  HeartPulse,
  RefreshCw,
  Search,
  Server,
  Wifi,
} from 'lucide-react';
import { LocalWorkbenchDatasource, type SessionFilters } from './datasource';
import {
  appVersionOf,
  breadcrumbsOf,
  environmentOf,
  eventKind,
  formatDuration,
  formatTime,
  routeOf,
  userIdOf,
} from './event-utils';
import type { MonitorEvent, PerformanceMetricSummary, PerformanceOverview, SessionSummary } from './types';
import './styles.css';

const datasource = new LocalWorkbenchDatasource();

function App() {
  const [filters, setFilters] = useState<SessionFilters>({ limit: 50 });
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [events, setEvents] = useState<MonitorEvent[]>([]);
  const [recent, setRecent] = useState<MonitorEvent[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>();
  const [selectedEvent, setSelectedEvent] = useState<MonitorEvent>();
  const [traceEvents, setTraceEvents] = useState<MonitorEvent[]>([]);
  const [overview, setOverview] = useState<PerformanceOverview>();
  const [health, setHealth] = useState<Record<string, unknown>>({});
  const [live, setLive] = useState(true);
  const [message, setMessage] = useState('未加载');

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    if (!live) return undefined;
    return datasource.subscribeEvents((event: MonitorEvent) => {
      setRecent((current) => [event, ...current].slice(0, 100));
      if (event.sessionId && event.sessionId === selectedSessionId) {
        setEvents((current) => sortEvents([...current, event]));
      }
    });
  }, [live, selectedSessionId]);

  async function refreshAll(nextFilters = filters) {
    try {
      const [healthData, recentEvents, sessionData, performanceData] = await Promise.all([
        datasource.health(),
        datasource.recent(80),
        datasource.listSessions(nextFilters),
        datasource.performanceOverview(nextFilters),
      ]);
      setHealth(healthData);
      setRecent(recentEvents);
      setSessions(sessionData.sessions);
      setOverview(performanceData);
      if (!selectedSessionId && sessionData.sessions[0]) {
        await openSession(sessionData.sessions[0].sessionId);
      }
      setMessage(`已加载 ${sessionData.sessions.length} 个 session`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  async function openSession(sessionId: string) {
    setSelectedSessionId(sessionId);
    const sessionEvents = await datasource.getSession(sessionId);
    setEvents(sortEvents(sessionEvents));
    const first = sessionEvents[0];
    setSelectedEvent(first);
    if (first?.traceId) setTraceEvents(await datasource.getTrace(first.traceId));
  }

  async function selectEvent(event: MonitorEvent) {
    setSelectedEvent(event);
    if (event.traceId) {
      setTraceEvents(await datasource.getTrace(event.traceId));
    } else {
      setTraceEvents([]);
    }
  }

  async function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await refreshAll(filters);
  }

  const selectedBreadcrumbs = useMemo(
    () => (selectedEvent ? breadcrumbsOf(selectedEvent) : []),
    [selectedEvent],
  );

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <h1>Flutter Monitor Workbench</h1>
          <p>LocalLive datasource · EventEnvelope timeline</p>
        </div>
        <div className="topbar-actions">
          <button className={live ? 'toggle active' : 'toggle'} onClick={() => setLive((value) => !value)}>
            <Wifi size={16} /> Live
          </button>
          <button onClick={() => refreshAll()}>
            <RefreshCw size={16} /> 刷新
          </button>
        </div>
      </header>

      <main className="layout">
        <aside className="left-pane">
          <section className="panel">
            <div className="panel-title">
              <Search size={16} />
              <span>Session Search</span>
            </div>
            <form className="filters" onSubmit={applyFilters}>
              <input placeholder="userId" value={filters.userId ?? ''} onChange={(e) => setFilters({ ...filters, userId: e.target.value })} />
              <input placeholder="environment" value={filters.environment ?? ''} onChange={(e) => setFilters({ ...filters, environment: e.target.value })} />
              <input placeholder="appVersion" value={filters.appVersion ?? ''} onChange={(e) => setFilters({ ...filters, appVersion: e.target.value })} />
              <input placeholder="route" value={filters.route ?? ''} onChange={(e) => setFilters({ ...filters, route: e.target.value })} />
              <button type="submit">查询</button>
            </form>
          </section>

          <section className="panel grow">
            <div className="panel-title">
              <Activity size={16} />
              <span>Sessions</span>
            </div>
            <div className="session-list">
              {sessions.map((session) => (
                <button
                  key={session.sessionId}
                  className={session.sessionId === selectedSessionId ? 'session active' : 'session'}
                  onClick={() => void openSession(session.sessionId)}
                >
                  <strong>{session.sessionId}</strong>
                  <span>{formatTime(session.firstTimestamp)} - {formatTime(session.lastTimestamp)}</span>
                  <span>events={session.count} errors={session.errorCount} jank={session.jankCount} http_fail={session.failedHttpCount}</span>
                  <span>{session.userId ?? '-'} · {session.route ?? '-'}</span>
                </button>
              ))}
              {sessions.length === 0 && <div className="empty">暂无 session</div>}
            </div>
          </section>
        </aside>

        <section className="center-pane">
          <div className="status-strip">
            <StatusItem icon={<Server size={15} />} label="storage" value={String(health.storageMode ?? '-')} />
            <StatusItem icon={<Activity size={15} />} label="events" value={String(health.eventCount ?? 0)} />
            <StatusItem icon={<HeartPulse size={15} />} label="status" value={message} />
          </div>
          <PerformanceGrid overview={overview} />
          <section className="panel timeline-panel">
            <div className="panel-title">
              <GitBranch size={16} />
              <span>Session Timeline</span>
            </div>
            <div className="timeline">
              {events.map((event) => (
                <button
                  key={event.eventId}
                  className={selectedEvent?.eventId === event.eventId ? 'timeline-row active' : 'timeline-row'}
                  onClick={() => void selectEvent(event)}
                >
                  <span className={`kind kind-${eventKind(event)}`}>{eventKind(event)}</span>
                  <span className="time">{formatTime(event.timestamp)}</span>
                  <span className="name">{event.name ?? '-'}</span>
                  <span className="route">{routeOf(event)}</span>
                  <span className="duration">{formatDuration(event.durationMs)}</span>
                  <span className={event.status === 'error' ? 'status error' : 'status'}>{event.status ?? event.signalType ?? '-'}</span>
                </button>
              ))}
              {events.length === 0 && <div className="empty">选择 session 后显示 timeline</div>}
            </div>
          </section>
        </section>

        <aside className="right-pane">
          <section className="panel detail-panel">
            <div className="panel-title">
              <FileJson size={16} />
              <span>Event Detail</span>
            </div>
            {selectedEvent ? (
              <div className="detail">
                <dl>
                  <dt>event</dt><dd>{selectedEvent.eventId ?? '-'}</dd>
                  <dt>session</dt><dd>{selectedEvent.sessionId ?? '-'}</dd>
                  <dt>trace</dt><dd>{selectedEvent.traceId ?? '-'}</dd>
                  <dt>span</dt><dd>{selectedEvent.spanId ?? '-'}</dd>
                  <dt>route</dt><dd>{routeOf(selectedEvent)}</dd>
                  <dt>user</dt><dd>{userIdOf(selectedEvent)}</dd>
                  <dt>app</dt><dd>{appVersionOf(selectedEvent)} · {environmentOf(selectedEvent)}</dd>
                </dl>
                <h3>Trace Events</h3>
                <div className="trace-list">
                  {traceEvents.map((event) => (
                    <button key={event.eventId} onClick={() => void selectEvent(event)}>
                      {formatTime(event.timestamp)} · {event.name ?? '-'} · {formatDuration(event.durationMs)}
                    </button>
                  ))}
                </div>
                <h3>Breadcrumbs</h3>
                <div className="breadcrumb-list">
                  {selectedBreadcrumbs.map((breadcrumb: Record<string, unknown>, index: number) => (
                    <pre key={index}>{JSON.stringify(breadcrumb, null, 2)}</pre>
                  ))}
                  {selectedBreadcrumbs.length === 0 && <div className="empty compact">无 breadcrumb 快照</div>}
                </div>
                <h3>Raw Envelope</h3>
                <pre className="json">{JSON.stringify(selectedEvent, null, 2)}</pre>
              </div>
            ) : (
              <div className="empty">未选择事件</div>
            )}
          </section>

          <section className="panel recent-panel">
            <div className="panel-title">
              <AlertTriangle size={16} />
              <span>Live / Recent</span>
            </div>
            <div className="recent-list">
              {recent.slice(0, 20).map((event) => (
                <button key={event.eventId} onClick={() => void selectEvent(event)}>
                  <span>{formatTime(event.timestamp)}</span>
                  <strong>{event.name ?? '-'}</strong>
                  <span>{event.sessionId ?? '-'}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}

function StatusItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="status-item">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PerformanceGrid({ overview }: { overview?: PerformanceOverview }) {
  const entries: Array<[string, PerformanceMetricSummary | undefined]> = [
    ['Startup', overview?.startup],
    ['Pages', overview?.pages],
    ['HTTP', overview?.http],
    ['Jank', overview?.jank],
    ['Errors', overview?.errors],
  ];
  return (
    <section className="perf-grid">
      {entries.map(([label, summary]) => (
        <div className="metric" key={label}>
          <div><BarChart3 size={15} /> {label}</div>
          <strong>{summary?.count ?? 0}</strong>
          <span>p95 {formatDuration(summary?.p95Ms)} · max {formatDuration(summary?.maxMs)}</span>
        </div>
      ))}
    </section>
  );
}

function sortEvents(events: MonitorEvent[]): MonitorEvent[] {
  return [...events].sort((a, b) => Date.parse(a.timestamp ?? '') - Date.parse(b.timestamp ?? ''));
}

createRoot(document.getElementById('root')!).render(<App />);
