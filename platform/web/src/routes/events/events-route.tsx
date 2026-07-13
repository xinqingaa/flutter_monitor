import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { FilterSelect } from '../../components/common/filter-select';
import { EmptyState } from '../../components/common/empty-state';
import { scopeToSessionFilters, useScopeFilters } from '../../features/scope/scope-filters';
import { EventKindBadge } from '../../features/timeline/status-badge';
import { useRecentQuery } from '../../shared/datasource/queries';
import type { MonitorEvent } from '../../shared/datasource/types';
import { routeOf } from '../../shared/event-model/accessors';
import { formatDateTime, formatDuration } from '../../shared/formatting/format';

type PageSize = 30 | 50 | 100;
const DEFAULT_PAGE_SIZE: PageSize = 50;
const PAGE_SIZES: PageSize[] = [30, 50, 100];

export function EventsRoute() {
  const { filters: scopeFilters } = useScopeFilters();
  const queryFilters = useMemo(() => scopeToSessionFilters(scopeFilters), [scopeFilters]);
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);
  const [offset, setOffset] = useState(0);
  const [loadedEvents, setLoadedEvents] = useState<MonitorEvent[]>([]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const recentQuery = useRecentQuery(pageSize, offset, queryFilters);
  const pageEvents = useMemo(() => recentQuery.data?.events ?? [], [recentQuery.data?.events]);
  const events = loadedEvents.length > 0 ? loadedEvents : pageEvents;

  useEffect(() => {
    setOffset(0);
    setLoadedEvents([]);
  }, [queryFilters]);

  useEffect(() => {
    if (!recentQuery.data) return;
    if (offset === 0) {
      setLoadedEvents(pageEvents);
      return;
    }
    setLoadedEvents((current) => {
      const seen = new Set(current.map((event) => event.eventId));
      const next = pageEvents.filter((event) => !seen.has(event.eventId));
      return next.length > 0 ? [...current, ...next] : current;
    });
  }, [offset, pageEvents, recentQuery.data]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      if (!recentQuery.data?.hasMore || recentQuery.isFetching) return;
      setOffset(events.length);
    }, { rootMargin: '160px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [events.length, recentQuery.data?.hasMore, recentQuery.isFetching]);

  function changePageSize(nextSize: PageSize) {
    setPageSize(nextSize);
    setOffset(0);
    setLoadedEvents([]);
  }

  return (
    <div className="grid h-full min-h-0 p-2">
      <Card className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
        <CardHeader className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Event 列表</CardTitle>
            <CardDescription>使用顶部全局范围筛选原始事件；常规排查优先从 Session Detail 进入。</CardDescription>
          </div>
          <PageSizeSelect value={pageSize} onChange={changePageSize} />
        </CardHeader>
        <CardContent className="min-h-0 overflow-auto p-0">
          {events.length === 0 ? (
            <div className="p-3">
              <EmptyState title="暂无事件" description="本地实时模式收到事件后会追加到这里。" />
            </div>
          ) : (
            <div className="min-w-[760px] divide-y divide-zinc-100">
              {events.map((event) => (
                <Link
                  key={event.eventId}
                  to="/events/$eventId"
                  params={{ eventId: event.eventId ?? '-' }}
                  className="grid grid-cols-[150px_96px_minmax(0,1fr)_160px_90px] items-center gap-2 px-3 py-2 text-sm hover:bg-teal-50"
                >
                  <span className="text-xs text-zinc-500">{formatDateTime(event.timestamp)}</span>
                  <EventKindBadge event={event} />
                  <span className="min-w-0 truncate font-medium text-zinc-900">{event.name ?? '-'}</span>
                  <span className="min-w-0 truncate text-xs text-zinc-500">{routeOf(event)}</span>
                  <span className="text-right text-xs tabular-nums text-zinc-500">{formatDuration(event.durationMs)}</span>
                </Link>
              ))}
              <ListFooter isFetching={recentQuery.isFetching} hasMore={recentQuery.data?.hasMore} label="Event" />
              <div ref={sentinelRef} className="h-1" />
            </div>
          )}
        </CardContent>
      </Card>
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
