import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, PanelRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { CollapsiblePanel, CollapsiblePanelAction, useCollapsiblePanel } from '../../components/layout/collapsible-panel';
import { EmptyState } from '../../components/common/empty-state';
import { ProblemSessionList } from '../../features/overview/problem-session-list';
import { RecentEvents } from '../../features/overview/recent-events';
import { SessionFilterForm } from '../../features/session/session-filter-form';
import { SessionRows } from '../../features/session/session-list';
import { useRecentQuery, useSessionsQuery } from '../../shared/datasource/queries';
import type { SessionFilters } from '../../shared/datasource/types';

export function SessionsRoute() {
  const [draftFilters, setDraftFilters] = useState<SessionFilters>({ limit: 80 });
  const [filters, setFilters] = useState<SessionFilters>({ limit: 80 });
  const sessionsQuery = useSessionsQuery(filters);
  const recentQuery = useRecentQuery(80);
  const sessions = sessionsQuery.data?.sessions ?? [];
  const problemSessions = useMemo(
    () => sessions.filter((session) => session.errorCount > 0 || session.jankCount > 0 || session.failedHttpCount > 0 || session.status === 'error'),
    [sessions],
  );
  const rightPanel = useCollapsiblePanel('workbench.sessions.right');

  return (
    <div
      className={`grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto p-2 xl:overflow-hidden ${
        rightPanel.collapsed ? 'xl:grid-cols-[minmax(760px,1fr)_40px]' : 'xl:grid-cols-[minmax(760px,1fr)_380px]'
      }`}
    >
      <section className="grid min-h-[620px] gap-2 xl:min-h-0 xl:grid-rows-[auto_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Session 检索</CardTitle>
              <CardDescription>按用户、时间范围、版本、环境、页面或状态定位一次 App 使用过程。</CardDescription>
            </div>
            {sessions[0] ? (
              <Button asChild variant="secondary" size="sm">
                <Link to="/sessions/$sessionId" params={{ sessionId: sessions[0].sessionId }}>
                  打开最新
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : null}
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

        <Card className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <CardHeader>
            <CardTitle>全部 Session</CardTitle>
            <CardDescription>所有已落库的 App 使用过程，进入详情后查看链路、节点诊断和原始 JSON。</CardDescription>
          </CardHeader>
          <CardContent className="min-h-0 overflow-auto p-0">
            <SessionRows sessions={sessions} />
          </CardContent>
        </Card>
      </section>

      <aside className="min-h-[520px] xl:min-h-0">
        <CollapsiblePanel
          storageKey="workbench.sessions.right"
          title="问题侧栏"
          icon={PanelRight}
          side="right"
          collapsed={rightPanel.collapsed}
          onToggleCollapsed={rightPanel.toggleCollapsed}
        >
          <div className="grid h-full min-h-0 gap-2 xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
              <CardHeader className="flex flex-row items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle>最近问题会话</CardTitle>
                  <CardDescription>包含错误、卡顿、失败请求或异常状态的会话。</CardDescription>
                </div>
                <CollapsiblePanelAction
                  side="right"
                  title="问题侧栏"
                  collapsed={rightPanel.collapsed}
                  onToggleCollapsed={rightPanel.toggleCollapsed}
                />
              </CardHeader>
              <CardContent className="min-h-0 overflow-auto p-0">
                {problemSessions.length === 0 ? (
                  <div className="p-3">
                    <EmptyState title="暂无问题会话" description="错误、卡顿、失败请求或慢启动出现后会进入这里。" />
                  </div>
                ) : (
                  <ProblemSessionList sessions={problemSessions.slice(0, 16)} />
                )}
              </CardContent>
            </Card>
            <RecentEvents events={recentQuery.data ?? []} />
          </div>
        </CollapsiblePanel>
      </aside>
    </div>
  );
}
