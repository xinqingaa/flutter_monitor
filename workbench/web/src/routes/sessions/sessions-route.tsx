import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { SessionFilterForm } from '../../features/session/session-filter-form';
import { SessionRows } from '../../features/session/session-list';
import { useSessionsQuery } from '../../shared/datasource/queries';
import type { SessionFilters, SessionSummary } from '../../shared/datasource/types';

type PageSize = 30 | 50 | 100;
const DEFAULT_PAGE_SIZE: PageSize = 50;
const PAGE_SIZES: PageSize[] = [30, 50, 100];

export function SessionsRoute() {
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [draftFilters, setDraftFilters] = useState<SessionFilters>({ limit: DEFAULT_PAGE_SIZE, offset: 0 });
  const [filters, setFilters] = useState<SessionFilters>({ limit: DEFAULT_PAGE_SIZE, offset: 0 });
  const [loadedSessions, setLoadedSessions] = useState<SessionSummary[]>([]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const sessionsQuery = useSessionsQuery(filters);
  const pageSessions = useMemo(() => sessionsQuery.data?.sessions ?? [], [sessionsQuery.data?.sessions]);
  const visibleSessions = loadedSessions.length > 0 ? loadedSessions : pageSessions;

  const filterOptions = useMemo(() => ({
    environments: uniqueValues(visibleSessions.map((session) => session.environment)),
    appVersions: uniqueValues(visibleSessions.map((session) => session.appVersion)),
    routes: uniqueValues(visibleSessions.map((session) => session.route)),
    statuses: uniqueValues(visibleSessions.map((session) => session.status)),
  }), [visibleSessions]);

  function applyFilters() {
    const next = { ...draftFilters, limit: pageSize, offset: 0 };
    setFilters(next);
    setLoadedSessions([]);
  }

  function loadMore() {
    const loaded = visibleSessions.length;
    setFilters({ ...filters, limit: pageSize, offset: loaded });
  }

  function changePageSize(nextSize: PageSize) {
    setPageSize(nextSize);
    const nextFilters = { ...draftFilters, limit: nextSize, offset: 0 };
    setDraftFilters(nextFilters);
    setFilters(nextFilters);
    setLoadedSessions([]);
  }

  useEffect(() => {
    if (!sessionsQuery.data) return;
    if ((filters.offset ?? 0) === 0) {
      setLoadedSessions(pageSessions);
      return;
    }
    setLoadedSessions((current) => {
      const seen = new Set(current.map((session) => session.sessionId));
      const next = pageSessions.filter((session) => !seen.has(session.sessionId));
      return next.length > 0 ? [...current, ...next] : current;
    });
  }, [filters.offset, pageSessions, sessionsQuery.data]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      if (!sessionsQuery.data?.hasMore || sessionsQuery.isFetching) return;
      loadMore();
    }, { rootMargin: '160px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [visibleSessions.length, sessionsQuery.data?.hasMore, sessionsQuery.isFetching, filters, pageSize]);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto p-2 xl:overflow-hidden">
      <section className="grid min-h-[620px] gap-2 xl:min-h-0 xl:grid-rows-[auto_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Session 检索</CardTitle>
              <CardDescription>按用户、时间范围、版本、环境、页面或状态定位一次 App 使用过程。</CardDescription>
            </div>
            {visibleSessions[0] ? (
              <Button asChild variant="secondary" size="sm">
                <Link to="/sessions/$sessionId" params={{ sessionId: visibleSessions[0].sessionId }}>
                  打开最新
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            <SessionFilterForm filters={draftFilters} options={filterOptions} onChange={setDraftFilters} onSubmit={applyFilters} />
            {sessionsQuery.data?.userIdQueryAvailable === false ? (
              <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                当前数据没有 `context.user.userId`，不能按用户检索；请改用时间、版本、页面或问题类型。
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <CardHeader className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>全部 Session</CardTitle>
              <CardDescription>所有已落库的 App 使用过程，进入详情后查看链路、节点诊断和原始 JSON。</CardDescription>
            </div>
            <PageSizeSelect value={pageSize} onChange={changePageSize} />
          </CardHeader>
          <CardContent className="min-h-0 overflow-auto p-0">
            <SessionRows sessions={visibleSessions} variant="row" />
            <ListFooter isFetching={sessionsQuery.isFetching} hasMore={sessionsQuery.data?.hasMore} label="Session" />
            <div ref={sentinelRef} className="h-1" />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ListFooter({ isFetching, hasMore, label }: { isFetching: boolean; hasMore?: boolean; label: string }) {
  if (isFetching) return <div className="px-3 py-3 text-center text-xs text-zinc-500">加载中...</div>;
  if (hasMore) return null;
  return <div className="px-3 py-3 text-center text-xs text-zinc-500">已加载全部 {label}</div>;
}

function PageSizeSelect({ value, onChange }: { value: PageSize; onChange: (value: PageSize) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-500">
      每页
      <select
        className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
        value={value}
        onChange={(event) => onChange(Number(event.target.value) as PageSize)}
      >
        {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
      </select>
    </label>
  );
}

function uniqueValues(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b));
}
