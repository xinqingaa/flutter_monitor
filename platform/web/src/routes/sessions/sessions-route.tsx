import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { FilterSelect } from '../../components/common/filter-select';
import { SessionListFilterForm } from '../../features/session/session-list-filter-form';
import { sessionListToSessionFilters, useSessionListFilters } from '../../features/session/session-list-filters';
import { SessionRows } from '../../features/session/session-list';
import { scopeToSessionFilters, useScopeFilters } from '../../features/scope/scope-filters';
import { useDimensionsQuery, useSessionsQuery } from '../../shared/datasource/queries';
import type { SessionSummary } from '../../shared/datasource/types';

type PageSize = 30 | 50 | 100;
const DEFAULT_PAGE_SIZE: PageSize = 50;
const PAGE_SIZES: PageSize[] = [30, 50, 100];

export function SessionsRoute() {
  const { filters: scopeFilters } = useScopeFilters();
  const { filters: listFilters, patchFilters: patchListFilters, clearFilters: clearListFilters } = useSessionListFilters();
  const scopeQueryFilters = useMemo(() => scopeToSessionFilters(scopeFilters), [scopeFilters]);
  const localQueryFilters = useMemo(() => sessionListToSessionFilters(listFilters), [listFilters]);
  const queryFilters = useMemo(() => ({ ...scopeQueryFilters, ...localQueryFilters }), [scopeQueryFilters, localQueryFilters]);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [offset, setOffset] = useState(0);
  const [loadedSessions, setLoadedSessions] = useState<SessionSummary[]>([]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const dimensionsQuery = useDimensionsQuery(scopeQueryFilters);
  const filters = useMemo(() => cleanFilters({ ...queryFilters, limit: pageSize, offset }), [queryFilters, pageSize, offset]);
  const sessionsQuery = useSessionsQuery(filters);
  const pageSessions = useMemo(() => sessionsQuery.data?.sessions ?? [], [sessionsQuery.data?.sessions]);
  const visibleSessions = loadedSessions.length > 0 ? loadedSessions : pageSessions;

  useEffect(() => {
    setOffset(0);
    setLoadedSessions([]);
  }, [queryFilters, pageSize]);

  function loadMore() {
    setOffset(visibleSessions.length);
  }

  function changePageSize(nextSize: PageSize) {
    setPageSize(nextSize);
    setOffset(0);
    setLoadedSessions([]);
  }

  useEffect(() => {
    if (!sessionsQuery.data) return;
    if (offset === 0) {
      setLoadedSessions(pageSessions);
      return;
    }
    setLoadedSessions((current) => {
      const seen = new Set(current.map((session) => session.sessionId));
      const next = pageSessions.filter((session) => !seen.has(session.sessionId));
      return next.length > 0 ? [...current, ...next] : current;
    });
  }, [offset, pageSessions, sessionsQuery.data]);

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
  }, [visibleSessions.length, sessionsQuery.data?.hasMore, sessionsQuery.isFetching]);

  return (
    <div className="grid h-full min-h-0 grid-cols-1 gap-2 overflow-auto p-2 xl:overflow-hidden">
      <section className="grid min-h-[620px] gap-2 xl:min-h-0 xl:grid-rows-[auto_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Session 检索</CardTitle>
              <CardDescription>在顶部全局范围内按会话 ID、页面、状态或问题类型缩小会话列表。</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <SessionListFilterForm
              filters={listFilters}
              dimensions={dimensionsQuery.data}
              onChange={patchListFilters}
              onClear={clearListFilters}
            />
          </CardContent>
        </Card>

        <Card className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <CardHeader className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>全部 Session</CardTitle>
              <CardDescription>使用顶部全局范围筛选数据源；进入详情后按 sessionId 查看完整链路和原始 JSON。</CardDescription>
            </div>
            <PageSizeSelect value={pageSize} onChange={changePageSize} />
          </CardHeader>
          <CardContent className="min-h-0 overflow-auto p-0">
            {sessionsQuery.data?.userIdQueryAvailable === false && scopeFilters.userId ? (
              <p className="m-3 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
                当前数据没有 `context.user.userId`，不能按用户检索；请改用时间、版本、应用或平台。
              </p>
            ) : null}
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
    <FilterSelect
      ariaLabel="每页数量"
      placeholder="每页"
      value={String(value)}
      className="min-w-[92px]"
      onChange={(next) => onChange(Number(next ?? value) as PageSize)}
      options={PAGE_SIZES.map((size) => ({ value: String(size), label: `每页 ${size}` }))}
    />
  );
}

function cleanFilters<T extends Record<string, unknown>>(filters: T): T {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== ''),
  ) as T;
}
