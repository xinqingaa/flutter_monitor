import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { HttpSearch } from '../../app/router';
import { Button } from '../../components/ui/button';
import { Pagination, PaginationContent, PaginationItem } from '../../components/ui/pagination';
import { FilterSelect } from '../../components/common/filter-select';
import { ScopeFilterBar } from '../../features/scope/scope-filter-bar';
import { HttpFilterBar } from '../../features/http/http-filter-bar';
import { HttpCatalogTable, type CatalogState } from '../../features/http/http-catalog-table';
import { CatalogPreviewPane } from '../../features/catalog/catalog-preview-pane';
import { HttpRecord } from '../../features/inspector/http-record';
import { useDimensionsQuery, useEventQuery, useHttpCatalogQuery } from '../../shared/datasource/queries';
import type { HttpCatalogItem, HttpCatalogQuery, SessionFilters } from '../../shared/datasource/types';

const HTTP_KEYS: Array<keyof HttpSearch> = ['url', 'method', 'result', 'requestId', 'statusCode', 'businessCode', 'host', 'slowOnly'];
const ALL_FILTER_KEYS: Array<keyof HttpSearch> = ['appKey', 'environment', 'appVersion', 'devicePlatform', 'from', 'to', 'userId', 'sessionId', 'route', ...HTTP_KEYS];

export function HttpFoundationRoute() {
  const search = useSearch({ from: '/http' });
  const navigate = useNavigate({ from: '/http' });
  const page = search.page ?? 1;
  const pageSize = search.pageSize ?? 50;
  const query = useMemo(() => toQuery(search, page, pageSize), [search, page, pageSize]);
  const catalog = useHttpCatalogQuery(query);
  const dimensions = useDimensionsQuery(toScope(search));
  const detail = useEventQuery(search.detail);
  const [fullUrl, setFullUrl] = useState(() => localStorage.getItem('flutter-monitor.http.full-url') === 'true');
  const items = catalog.data?.items ?? [];
  const selected = items.find((item) => item.eventId === search.eventId);
  const detailItem = items.find((item) => item.eventId === search.detail) ?? (search.detail === selected?.eventId ? selected : undefined);
  const hasFilters = ALL_FILTER_KEYS.some((key) => search[key] !== undefined);

  function patch(patchValue: Partial<HttpSearch>, resetPage = false) {
    void navigate({ search: (current) => clean({ ...current, ...patchValue, ...(resetPage ? { page: undefined, eventId: undefined, detail: undefined } : {}) }), replace: resetPage });
  }
  function clearKeys(keys: Array<keyof HttpSearch>) { patch(Object.fromEntries(keys.map((key) => [key, undefined])) as Partial<HttpSearch>, true); }
  function select(item: HttpCatalogItem) {
    const narrow = window.matchMedia('(max-width: 1023px)').matches;
    patch({ eventId: item.eventId, detail: narrow ? item.eventId : undefined });
  }
  function open(item: HttpCatalogItem) { patch({ eventId: item.eventId, detail: item.eventId }); }

  useEffect(() => {
    if (!catalog.data || !search.eventId) return;
    if (!items.some((item) => item.eventId === search.eventId)) patch({ eventId: undefined, detail: undefined });
  }, [catalog.data, items, search.eventId]);

  const state: CatalogState = catalog.isLoading && !catalog.data ? 'loading' : catalog.isError ? 'error' : items.length === 0 ? (hasFilters ? 'noResults' : 'empty') : items.some((item) => item.detailDropped) ? 'partial' : 'ready';
  const total = catalog.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ScopeFilterBar search={search} dimensions={dimensions.data} onPatch={patch} />
      <HttpFilterBar search={search} total={total} slowThresholdMs={catalog.data?.slowThresholdMs} fullUrl={fullUrl} onFullUrlChange={(value) => { setFullUrl(value); localStorage.setItem('flutter-monitor.http.full-url', String(value)); }} onPatch={patch} onResetHttp={() => clearKeys(HTTP_KEYS)} onClearAll={() => clearKeys(ALL_FILTER_KEYS)} />
      <div className="grid min-h-0 flex-1 grid-cols-1 min-[1400px]:grid-cols-[minmax(0,1fr)_17.5rem]">
          <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]">
            <HttpCatalogTable items={items} state={state} selectedId={search.eventId} fullUrl={fullUrl} slowThresholdMs={catalog.data?.slowThresholdMs ?? 1000} onSelect={select} onOpen={open} onRetry={() => void catalog.refetch()} />
            <footer className="flex min-h-14 flex-wrap items-center justify-between gap-3 border-t px-4 py-2 text-sm text-muted-foreground">
              <span className="whitespace-nowrap tabular-nums">共 {total} 条，第 {page} / {totalPages} 页</span>
              <div className="flex items-center gap-3">
                <FilterSelect value={String(pageSize)} placeholder="每页" options={[25, 50, 100].map((value) => ({ value: String(value), label: `${value} 条/页` }))} onChange={(value) => patch({ pageSize: Number(value) as 25 | 50 | 100, page: undefined, eventId: undefined, detail: undefined })} className="w-28" />
                <Pagination className="w-auto">
                  <PaginationContent>
                    <PaginationItem><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => patch({ page: page - 1, eventId: undefined, detail: undefined })}>上一页</Button></PaginationItem>
                    <PaginationItem><Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => patch({ page: page + 1, eventId: undefined, detail: undefined })}>下一页</Button></PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </footer>
          </div>
          <aside className="hidden min-h-0 overflow-auto border-l bg-muted/20 min-[1400px]:block">
            <CatalogPreviewPane item={selected} loading={Boolean(search.eventId && catalog.isLoading)} error={Boolean(search.eventId && catalog.isError)} onOpen={() => selected && open(selected)} />
          </aside>
      </div>
      <HttpRecord open={Boolean(search.detail)} item={detailItem} event={detail.data} loading={detail.isLoading} error={detail.isError} onOpenChange={(openValue) => { if (!openValue) patch({ detail: undefined }); }} />
    </div>
  );
}

function toQuery(search: HttpSearch, page: number, pageSize: number): HttpCatalogQuery {
  return clean({
    appKey: list(search.appKey), environment: list(search.environment), appVersion: list(search.appVersion), devicePlatform: list(search.devicePlatform), from: search.from, to: search.to, userId: search.userId, sessionId: search.sessionId, route: list(search.route),
    url: search.url, method: list(search.method), result: search.result, requestId: search.requestId, statusCode: numberList(search.statusCode), businessCode: list(search.businessCode), host: search.host, slowOnly: search.slowOnly,
    limit: pageSize, offset: (page - 1) * pageSize,
  });
}
function toScope(search: HttpSearch): SessionFilters { return clean({ appKey: list(search.appKey), environment: list(search.environment), appVersion: list(search.appVersion), devicePlatform: list(search.devicePlatform), from: search.from, to: search.to, userId: search.userId, sessionId: search.sessionId, route: list(search.route) }); }
function list(value?: string) { return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : undefined; }
function numberList(value?: string) { return list(value)?.map(Number).filter(Number.isFinite); }
function clean<T extends Record<string, unknown>>(value: T): T { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== '' && (!Array.isArray(item) || item.length))) as T; }
