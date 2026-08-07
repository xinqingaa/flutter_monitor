import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { SessionSearch } from '../../app/router';
import { Button } from '../../components/ui/button';
import { IdCombobox } from '../../components/common/id-combobox';
import { pickScopeSearch } from '../../features/scope/scope-filters';
import {
  SessionWorkspaceEmpty,
  SessionWorkspaceView,
  type SessionWorkspaceSearch,
} from '../../features/session/session-workspace-view';
import { useDebouncedValue } from '../../shared/hooks/use-debounced-value';
import { useDimensionsQuery, useSessionQuery } from '../../shared/datasource/queries';
import {
  environmentOf,
  eventKind,
  readPath,
  sortEvents,
  userIdOf,
} from '../../shared/event-model/accessors';
import { formatDuration } from '../../shared/formatting/format';
import type { MonitorEvent } from '../../shared/datasource/types';

export function SessionWorkspaceRoute() {
  const { sessionId } = useParams({ from: '/sessions/$sessionId' });
  const search = useSearch({ from: '/sessions/$sessionId' });
  const navigate = useNavigate({ from: '/sessions/$sessionId' });
  const session = useSessionQuery(sessionId);
  const [sessionQuery, setSessionQuery] = useState(sessionId);
  const debouncedSession = useDebouncedValue(sessionQuery, 250);
  const suggestions = useDimensionsQuery({}, debouncedSession);
  const events = useMemo(
    () => sortEvents(session.data ?? []).filter(inPrimaryTimeline),
    [session.data],
  );
  const durationLabel = sessionDurationLabel(events);
  const errorCount = events.filter(isErrorTabEvent).length;
  const identity = useMemo(() => sessionIdentity(events[0]), [events]);

  useEffect(() => {
    setSessionQuery(sessionId);
  }, [sessionId]);

  function switchSession(next?: string) {
    if (!next || next === sessionId) return;
    void navigate({ to: '/sessions/$sessionId', params: { sessionId: next }, search: {} });
  }

  const onSearchChange = useCallback((patch: Partial<SessionWorkspaceSearch>) => {
    void navigate({
      search: (current: SessionSearch) => ({
        ...current,
        ...patch,
        tab: patch.tab === 'all' ? undefined : (patch.tab ?? current.tab),
      }),
      replace: true,
    });
  }, [navigate]);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] bg-background">
      <section className="border-b bg-background px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon" aria-label="返回 Session 列表" asChild>
            <Link to="/sessions" search={(current) => pickScopeSearch(current)}>
              <ArrowLeft />
            </Link>
          </Button>
          <IdCombobox
            value={sessionId}
            label="Session ID"
            query={sessionQuery}
            options={suggestions.data?.sessionIds ?? []}
            loading={suggestions.isFetching}
            error={suggestions.isError}
            onQueryChange={setSessionQuery}
            onChange={switchSession}
            className="w-72"
          />
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className={errorCount > 0 ? 'font-medium text-destructive' : 'text-muted-foreground'}>
              {errorCount} 异常
            </span>
            <span className="tabular-nums text-muted-foreground">{events.length} 事件</span>
            {durationLabel ? <span className="tabular-nums text-muted-foreground">{durationLabel}</span> : null}
          </div>
        </div>
        {identity ? (
          <p className="mt-1.5 truncate pl-11 text-xs text-muted-foreground">{identity}</p>
        ) : null}
      </section>

      {session.isLoading ? (
        <SessionWorkspaceEmpty title="正在加载 Session" description="读取事件链路与上下文" />
      ) : session.isError ? (
        <SessionWorkspaceEmpty title="Session 加载失败" description="请检查 Monitor Service 后重试" danger />
      ) : events.length === 0 ? (
        <SessionWorkspaceEmpty title="没有主要事件" description="当前 Session 中没有启动、页面、HTTP、埋点或异常事件" />
      ) : (
        <SessionWorkspaceView
          sessionId={sessionId}
          events={events}
          search={search}
          onSearchChange={onSearchChange}
        />
      )}
    </div>
  );
}

function sessionIdentity(event?: MonitorEvent) {
  if (!event) return undefined;
  const user = userIdOf(event);
  const packageName = stringValue(readPath(event, ['resource', 'app', 'packageName']));
  const appKey = stringValue(readPath(event, ['resource', 'app', 'appKey']));
  const version = stringValue(readPath(event, ['resource', 'app', 'appVersion']));
  const env = environmentOf(event);
  const platform = stringValue(readPath(event, ['resource', 'device', 'platform']));
  return [
    user !== '-' ? user : undefined,
    packageName ?? appKey,
    version ? `v${version}` : undefined,
    env !== '-' ? env : undefined,
    platform,
  ].filter(Boolean).join(' · ') || undefined;
}

function inPrimaryTimeline(event: MonitorEvent) {
  const kind = eventKind(event);
  return ['startup', 'page', 'http', 'business', 'error'].includes(kind)
    || readPath(event, ['attributes', 'business.result']) === 'failed';
}

function isErrorTabEvent(event: MonitorEvent) {
  if (eventKind(event) === 'http') return false;
  return eventKind(event) === 'error'
    || readPath(event, ['attributes', 'business.result']) === 'failed'
    || (event.status === 'error' && eventKind(event) !== 'http');
}

function sessionDurationLabel(events: MonitorEvent[]) {
  if (events.length < 2) {
    return events[0]?.durationMs !== undefined ? formatDuration(events[0].durationMs) : undefined;
  }
  const first = Date.parse(events[0]?.timestamp ?? events[0]?.startTime ?? '');
  const last = Date.parse(events.at(-1)?.timestamp ?? events.at(-1)?.endTime ?? '');
  if (!Number.isFinite(first) || !Number.isFinite(last) || last < first) return undefined;
  return formatDuration(last - first);
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined;
}
