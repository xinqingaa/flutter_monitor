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
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto p-2 xl:grid-cols-[minmax(760px,1fr)_360px] xl:grid-rows-[auto_minmax(0,1fr)] xl:overflow-hidden">
      <section className="grid min-h-0 gap-2 xl:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>查找会话</CardTitle>
            <p className="mt-1 text-xs text-zinc-500">按用户、版本、环境、页面或状态定位一次 App 使用过程。</p>
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
        <ServiceStatusStrip health={healthQuery.data} live={live} />
      </section>

      <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
        <Card>
          <CardHeader>
            <CardTitle>性能概览</CardTitle>
            <p className="mt-1 text-xs text-zinc-500">优先查看启动、页面、网络、卡顿和错误。每个摘要后续都应能回查原始事件。</p>
          </CardHeader>
          <CardContent>
            <OverviewMetrics overview={performanceQuery.data} />
          </CardContent>
        </Card>
        <Card className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <CardHeader>
            <CardTitle>最近问题会话</CardTitle>
            <p className="mt-1 text-xs text-zinc-500">只展示包含错误、卡顿、失败请求或异常状态的会话。</p>
          </CardHeader>
          <CardContent className="min-h-0 overflow-auto p-3">
            {problemSessions.length === 0 ? (
              <EmptyState title="暂无问题会话" description="错误、卡顿、失败请求或慢启动出现后会进入这里。" />
            ) : (
              <div className="-m-3"><ProblemSessionList sessions={problemSessions.slice(0, 12)} /></div>
            )}
          </CardContent>
        </Card>
      </section>

      <aside className="grid min-h-[520px] gap-2 xl:min-h-0 xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
        <SessionList
          sessions={sessions}
          title="全部会话"
          description="所有已落库的 App 使用过程，可切换查看不同链路。"
        />
        <RecentEvents events={recentQuery.data ?? []} />
      </aside>
    </div>
  );
}
