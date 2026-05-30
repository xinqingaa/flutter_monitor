import { Link } from '@tanstack/react-router';
import { ArrowRight, Braces, ListFilter, type LucideIcon } from 'lucide-react';
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
            <Button asChild variant="secondary" className="w-full sm:w-auto">
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
            <CardTitle>排查入口</CardTitle>
            <CardDescription>Session 是主要排查入口；Events 用于开发态查看原始信号。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <WorkbenchEntryButton to="/sessions" icon={ListFilter} label="打开 Session 列表" />
            <WorkbenchEntryButton to="/events" icon={Braces} label="打开 Event 列表" />
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function WorkbenchEntryButton({ to, icon: Icon, label }: { to: '/sessions' | '/events'; icon: LucideIcon; label: string }) {
  return (
    <Button asChild variant="secondary" className="w-full">
      <Link to={to} className="justify-center">
        <Icon className="size-4" />
        <span>{label}</span>
        <ArrowRight className="size-4" />
      </Link>
    </Button>
  );
}
