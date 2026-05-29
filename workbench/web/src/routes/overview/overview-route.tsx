import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { SessionFilterForm } from '../../features/session/session-filter-form';
import { SessionList } from '../../features/session/session-list';
import { OverviewMetrics } from '../../features/overview/overview-metrics';
import { RecentEvents } from '../../features/overview/recent-events';
import { ServiceStatusStrip } from '../../features/overview/service-status-strip';
import { EmptyState } from '../../components/common/empty-state';
import { ProblemSessionList } from '../../features/overview/problem-session-list';
import { useHealthQuery, usePerformanceQuery, useRecentQuery, useSessionsQuery } from '../../shared/datasource/queries';
import type { SessionFilters } from '../../shared/datasource/types';
import { useLiveState } from '../../app/live-context';

export function OverviewRoute() {
  const [draftFilters, setDraftFilters] = useState<SessionFilters>({ limit: 50 });
  const [filters, setFilters] = useState<SessionFilters>({ limit: 50 });
  const healthQuery = useHealthQuery();
  const recentQuery = useRecentQuery(80);
  const sessionsQuery = useSessionsQuery(filters);
  const performanceQuery = usePerformanceQuery(filters);
  const live = useLiveState();

  const sessions = sessionsQuery.data?.sessions ?? [];
  const problemSessions = useMemo(
    () => sessions.filter((session) => session.errorCount > 0 || session.jankCount > 0 || session.failedHttpCount > 0 || session.status === 'error'),
    [sessions],
  );

  return (
    <div className="grid h-full min-h-0 grid-cols-[320px_minmax(720px,1fr)_390px] gap-3 p-3">
      <aside className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
        <Card>
          <CardHeader>
            <CardTitle>Session Search</CardTitle>
          </CardHeader>
          <CardContent>
            <SessionFilterForm filters={draftFilters} onChange={setDraftFilters} onSubmit={() => setFilters(draftFilters)} />
            {sessionsQuery.data?.userIdQueryAvailable === false ? (
              <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                当前数据没有 `context.user.userId`，不能按用户检索；请改用时间、版本、页面或问题类型。
              </p>
            ) : null}
          </CardContent>
        </Card>
        <SessionList sessions={sessions} />
      </aside>

      <section className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
        <ServiceStatusStrip health={healthQuery.data} live={live} />
        <OverviewMetrics overview={performanceQuery.data} />
        <Card className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <CardHeader>
            <CardTitle>Recent Problem Sessions</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 overflow-auto p-3">
            {problemSessions.length === 0 ? (
              <EmptyState title="暂无问题 session" description="error、jank、failed HTTP 或慢启动出现后会进入这里。" />
            ) : (
              <div className="-m-3"><ProblemSessionList sessions={problemSessions.slice(0, 12)} /></div>
            )}
          </CardContent>
        </Card>
      </section>

      <aside className="min-h-0">
        <RecentEvents events={recentQuery.data ?? []} />
      </aside>
    </div>
  );
}
