import { Link } from '@tanstack/react-router';
import { Braces, ListFilter, PanelRight, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../components/ui/tooltip';
import { CollapsiblePanel, CollapsiblePanelAction, useCollapsiblePanel } from '../../components/layout/collapsible-panel';
import { OverviewMetrics } from '../../features/overview/overview-metrics';
import { SessionCard } from '../../features/session/session-summary-card';
import { ServiceStatusStrip } from '../../features/overview/service-status-strip';
import { useHealthQuery, usePerformanceQuery, useSessionsQuery } from '../../shared/datasource/queries';
import { useLiveState } from '../../app/live-context';

export function OverviewRoute() {
  const healthQuery = useHealthQuery();
  const sessionsQuery = useSessionsQuery({ limit: 10 });
  const performanceQuery = usePerformanceQuery({ limit: 100 });
  const live = useLiveState();

  const sessions = sessionsQuery.data?.sessions ?? [];
  const recentSessions = sessions.slice(0, 2);
  const rightPanel = useCollapsiblePanel('workbench.overview.right');

  return (
    <div
      className={`grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto p-2 xl:grid-rows-[auto_minmax(0,1fr)] xl:overflow-hidden ${
        rightPanel.collapsed ? 'xl:grid-cols-[minmax(760px,1fr)_40px]' : 'xl:grid-cols-[minmax(760px,1fr)_380px]'
      }`}
    >
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

      <aside className="min-h-[360px] xl:min-h-0">
        <CollapsiblePanel
          storageKey="workbench.overview.right"
          title="排查侧栏"
          icon={PanelRight}
          side="right"
          collapsed={rightPanel.collapsed}
          onToggleCollapsed={rightPanel.toggleCollapsed}
        >
          <div className="grid content-start gap-2">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div>
                  <CardTitle>排查入口</CardTitle>
                </div>
                <CollapsiblePanelAction
                  side="right"
                  title="排查侧栏"
                  collapsed={rightPanel.collapsed}
                  onToggleCollapsed={rightPanel.toggleCollapsed}
                />
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2">
                <WorkbenchEntryButton to="/sessions" icon={ListFilter} label="Session" tooltip="sessionlist" />
                <WorkbenchEntryButton to="/events" icon={Braces} label="Event" tooltip="eventlist" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>最近 / 实时</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                {recentSessions.length === 0 ? (
                  <div className="rounded-md border border-dashed border-zinc-200 bg-zinc-50 px-3 py-6 text-center text-sm text-zinc-500">
                    暂无会话
                  </div>
                ) : recentSessions.map((session, index) => (
                  <SessionCard
                    key={session.sessionId}
                    session={session}
                    variant="featured"
                    className={index > 0 ? 'mt-1' : undefined}
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        </CollapsiblePanel>
      </aside>
    </div>
  );
}

function WorkbenchEntryButton({
  to,
  icon: Icon,
  label,
  tooltip,
}: {
  to: '/sessions' | '/events';
  icon: LucideIcon;
  label: string;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="secondary" className="h-10 w-full justify-start px-3">
          <Link to={to}>
            <Icon className="size-4" />
            {label}
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
