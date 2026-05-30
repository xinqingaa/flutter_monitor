import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { SessionFilterForm } from '../../features/session/session-filter-form';
import { SessionRows } from '../../features/session/session-list';
import { OverviewMetrics } from '../../features/overview/overview-metrics';
import { RecentEvents } from '../../features/overview/recent-events';
import { RecentLiveSession } from '../../features/overview/recent-live-session';
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
  const recentSession = sessions[0];
  const problemSessions = useMemo(
    () => sessions.filter((session) => session.errorCount > 0 || session.jankCount > 0 || session.failedHttpCount > 0 || session.status === 'error'),
    [sessions],
  );

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto p-2 xl:grid-cols-[minmax(720px,1fr)_360px] xl:grid-rows-[auto_minmax(0,1fr)] xl:overflow-hidden">
      <div className="xl:col-span-2">
        <ServiceStatusStrip health={healthQuery.data} live={live} />
      </div>

      <section className="grid min-h-0 gap-2 xl:grid-rows-[auto_auto_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>性能概览</CardTitle>
            <CardDescription>启动、页面、网络、卡顿和错误的当前量级；悬停指标可查看原始字段与口径。</CardDescription>
          </CardHeader>
          <CardContent>
            <OverviewMetrics overview={performanceQuery.data} />
          </CardContent>
        </Card>

        <RecentLiveSession session={recentSession} live={live} />

        <Card className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <CardHeader className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>查看全部 Session</CardTitle>
              <CardDescription>按用户、时间范围、版本、环境、页面或状态定位一次 App 使用过程。</CardDescription>
            </div>
            {recentSession ? (
              <Button asChild variant="secondary" size="sm">
                <Link to="/sessions/$sessionId" params={{ sessionId: recentSession.sessionId }}>
                  打开最新
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden">
            <div>
              <SessionFilterForm filters={draftFilters} onChange={setDraftFilters} onSubmit={() => setFilters(draftFilters)} />
              {sessionsQuery.data?.userIdQueryAvailable === false ? (
                <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                  当前数据没有 `context.user.userId`，不能按用户检索；请改用时间、版本、页面或问题类型。
                </p>
              ) : null}
            </div>
            <div className="min-h-0 overflow-auto rounded-md border border-zinc-100">
              <SessionRows sessions={sessions} />
            </div>
          </CardContent>
        </Card>
      </section>

      <aside className="grid min-h-[520px] gap-2 xl:min-h-0 xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <CardHeader>
            <CardTitle>最近问题会话</CardTitle>
            <CardDescription>包含错误、卡顿、失败请求或异常状态的会话优先浮出。</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 overflow-auto p-0">
            {problemSessions.length === 0 ? (
              <div className="p-3">
                <EmptyState title="暂无问题会话" description="错误、卡顿、失败请求或慢启动出现后会进入这里。" />
              </div>
            ) : (
              <ProblemSessionList sessions={problemSessions.slice(0, 12)} />
            )}
          </CardContent>
        </Card>
        <RecentEvents events={recentQuery.data ?? []} />
      </aside>
    </div>
  );
}
