import { Link } from '@tanstack/react-router';
import { Braces, ListFilter, type LucideIcon } from 'lucide-react';
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
            <CardDescription>Session 用于复现链路，Event 用于查看原始信号。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <WorkbenchEntryButton
              to="/sessions"
              icon={ListFilter}
              label="Session 排查"
              description="按用户、时间、页面、版本定位一次会话"
            />
            <WorkbenchEntryButton
              to="/events"
              icon={Braces}
              label="Event 原始流"
              description="开发态查看 SDK 原始 envelope"
            />
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function WorkbenchEntryButton({
  to,
  icon: Icon,
  label,
  description,
}: {
  to: '/sessions' | '/events';
  icon: LucideIcon;
  label: string;
  description: string;
}) {
  return (
    <Button asChild variant="secondary" className="h-auto w-full justify-start px-3 py-2 text-left">
      <Link to={to} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
        <span className="inline-flex size-9 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50">
          <Icon className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-zinc-950">{label}</span>
          <span className="mt-0.5 block whitespace-normal text-xs font-normal leading-relaxed text-zinc-500">{description}</span>
        </span>
      </Link>
    </Button>
  );
}
