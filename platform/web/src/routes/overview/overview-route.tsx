import { PanelRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { CollapsiblePanel, CollapsiblePanelAction, useCollapsiblePanel } from '../../components/layout/collapsible-panel';
import { OverviewMetrics } from '../../features/overview/overview-metrics';
import { SessionList } from '../../features/session/session-list';
import { SessionRail } from '../../features/session/session-rail';
import { ServiceStatusStrip } from '../../features/overview/service-status-strip';
import { scopeToSessionFilters, useScopeFilters } from '../../features/scope/scope-filters';
import { useHealthQuery, usePerformanceQuery, useSessionsQuery } from '../../shared/datasource/queries';
import { useLiveState } from '../../app/live-context';

export function OverviewRoute() {
  const { filters: scopeFilters } = useScopeFilters();
  const queryFilters = scopeToSessionFilters(scopeFilters);
  const healthQuery = useHealthQuery();
  const sessionsQuery = useSessionsQuery({ ...queryFilters, limit: 10 });
  const performanceQuery = usePerformanceQuery({ ...queryFilters, limit: 100 });
  const live = useLiveState();

  const sessions = sessionsQuery.data?.sessions ?? [];
  const rightPanel = useCollapsiblePanel('workbench.overview.right');

  return (
    <div
      className={`grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto p-2 xl:grid-rows-[auto_minmax(0,1fr)] xl:overflow-hidden ${
        rightPanel.collapsed ? 'xl:grid-cols-[minmax(760px,1fr)_104px]' : 'xl:grid-cols-[minmax(760px,1fr)_380px]'
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
              <CardDescription>启动、页面、网络、卡顿和稳定性错误是首页主视图；业务失败保留在对应 session/page 链路里。</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 overflow-auto">
            <OverviewMetrics overview={performanceQuery.data} variant="focus" />
          </CardContent>
        </Card>
      </section>

      <aside className="min-h-[360px] xl:min-h-0 xl:overflow-hidden">
        <CollapsiblePanel
          storageKey="workbench.overview.right"
          title="排查侧栏"
          icon={PanelRight}
          side="right"
          collapsed={rightPanel.collapsed}
          onToggleCollapsed={rightPanel.toggleCollapsed}
          collapsedContent={(
            <SessionRail
              sessions={sessions}
              title="排查侧栏"
              side="right"
              onExpand={rightPanel.toggleCollapsed}
            />
          )}
        >
          <SessionList
            sessions={sessions}
            title="最近 / 实时"
            description={live ? '本地 Workbench 正在接收实时事件。' : undefined}
            panelAction={(
              <CollapsiblePanelAction
                side="right"
                title="排查侧栏"
                collapsed={rightPanel.collapsed}
                onToggleCollapsed={rightPanel.toggleCollapsed}
              />
            )}
          />
        </CollapsiblePanel>
      </aside>
    </div>
  );
}
