import { Link } from '@tanstack/react-router';
import { ArrowRight, Braces, ListFilter } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { OverviewMetrics } from '../../features/overview/overview-metrics';
import { RecentLiveSession } from '../../features/overview/recent-live-session';
import { ServiceStatusStrip } from '../../features/overview/service-status-strip';
import { useHealthQuery, usePerformanceQuery, useSessionsQuery } from '../../shared/datasource/queries';
import { useLiveState } from '../../app/live-context';

export function OverviewRoute() {
  const healthQuery = useHealthQuery();
  const sessionsQuery = useSessionsQuery({ limit: 10 });
  const performanceQuery = usePerformanceQuery({ limit: 100 });
  const live = useLiveState();

  const sessions = sessionsQuery.data?.sessions ?? [];
  const recentSession = sessions[0];

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto p-2 xl:grid-cols-[minmax(760px,1fr)_340px] xl:grid-rows-[auto_minmax(0,1fr)] xl:overflow-hidden">
      <div className="xl:col-span-2">
        <ServiceStatusStrip health={healthQuery.data} live={live} />
      </div>

      <section className="grid min-h-[560px] xl:min-h-0">
        <Card className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <CardHeader className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>性能概览</CardTitle>
              <CardDescription>启动、页面、网络、卡顿和错误是首页主视图；点击卡片进入对应明细页。</CardDescription>
            </div>
            <Button asChild variant="secondary">
              <Link to="/sessions">
                <ListFilter className="size-4" />
                检索会话
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="min-h-0 overflow-auto">
            <OverviewMetrics overview={performanceQuery.data} variant="focus" />
          </CardContent>
        </Card>
      </section>

      <aside className="grid min-h-[360px] content-start gap-2 xl:min-h-0">
        <RecentLiveSession session={recentSession} live={live} compact />

        <Card>
          <CardHeader>
            <CardTitle>全部 Session</CardTitle>
            <CardDescription>进入总列表后再按用户、时间、版本、页面和状态检索。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button asChild variant="default">
              <Link to="/sessions">
                打开 Session 列表
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Events</CardTitle>
            <CardDescription>偏开发态的原始事件列表入口。</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary" className="w-full justify-between">
              <Link to="/events">
                <span className="inline-flex items-center gap-2">
                  <Braces className="size-4" />
                  打开 Event 列表
                </span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
