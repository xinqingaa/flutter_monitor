import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { HttpSearch } from '../../app/router';
import { ScopeFilterBar } from '../../features/scope/scope-filter-bar';
import { HttpFilterBar } from '../../features/http/http-filter-bar';
import { HttpCatalogTable, type CatalogState } from '../../features/http/http-catalog-table';
import { CatalogPagination } from '../../features/catalog/catalog-pagination';
import { HttpRecord } from '../../features/inspector/http-record';
import { pickScopeSearch } from '../../features/scope/scope-filters';
import { useDimensionsQuery, useEventQuery, useHttpCatalogQuery } from '../../shared/datasource/queries';
import type { HttpCatalogItem, HttpCatalogQuery, SessionFilters } from '../../shared/datasource/types';

const HTTP_KEYS: Array<keyof HttpSearch> = [
  'url',
  'method',
  'result',
  'requestId',
  'statusCode',
  'businessCode',
  'host',
  'slowOnly',
  'slowThresholdMs',
  'sessionId',
  'route',
];
const ALL_FILTER_KEYS: Array<keyof HttpSearch> = [
  'appKey',
  'packageName',
  'environment',
  'appVersion',
  'devicePlatform',
  'from',
  'to',
  'userId',
  ...HTTP_KEYS,
];

export function HttpFoundationRoute() {
  const search = useSearch({ from: '/http' });
  const navigate = useNavigate({ from: '/http' });
  const page = search.page ?? 1;
  const pageSize = search.pageSize ?? 50;
  const sortBy = search.sortBy ?? 'timestamp';
  const sortDir = search.sortDir ?? 'desc';
  const query = useMemo(() => toQuery(search, page, pageSize), [search, page, pageSize]);
  const catalog = useHttpCatalogQuery(query);
  const dimensions = useDimensionsQuery(toScope(search));
  const detail = useEventQuery(search.detail);
  const [fullUrl, setFullUrl] = useState(() => localStorage.getItem('flutter-monitor.http.full-url') === 'true');
  const items = catalog.data?.items ?? [];
  const detailItem = items.find((item) => item.eventId === search.detail);
  const hasFilters = ALL_FILTER_KEYS.some((key) => search[key] !== undefined);

  function patch(patchValue: Partial<HttpSearch>, resetPage = false) {
    void navigate({
      search: (current) => clean({
        ...current,
        ...patchValue,
        ...(resetPage ? { page: undefined, eventId: undefined, detail: undefined } : {}),
      }),
      replace: resetPage,
    });
  }
  function clearKeys(keys: Array<keyof HttpSearch>) {
    patch(Object.fromEntries(keys.map((key) => [key, undefined])) as Partial<HttpSearch>, true);
  }
  function peek(item: HttpCatalogItem) {
    patch({ detail: item.eventId });
  }
  function open(item: HttpCatalogItem) {
    void navigate({
      to: '/http/$eventId',
      params: { eventId: item.eventId },
      search: (current) => pickScopeSearch(current),
    });
  }
  function toggleSort(nextSortBy: 'timestamp' | 'durationMs') {
    const nextDir = sortBy === nextSortBy && sortDir === 'desc' ? 'asc' : 'desc';
    patch({
      sortBy: nextSortBy === 'timestamp' && nextDir === 'desc' ? undefined : nextSortBy,
      sortDir: nextSortBy === 'timestamp' && nextDir === 'desc' ? undefined : nextDir,
    }, true);
  }

  useEffect(() => {
    if (!catalog.data || !search.detail) return;
    if (!items.some((item) => item.eventId === search.detail)) patch({ detail: undefined });
  }, [catalog.data, items, search.detail]);

  const state: CatalogState = catalog.isLoading && !catalog.data
    ? 'loading'
    : catalog.isError
      ? 'error'
      : items.length === 0
        ? (hasFilters ? 'noResults' : 'empty')
        : items.some((item) => item.detailDropped) ? 'partial' : 'ready';

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ScopeFilterBar search={search} dimensions={dimensions.data} onPatch={patch} />
      <HttpFilterBar
        search={search}
        dimensions={dimensions.data}
        slowThresholdMs={catalog.data?.slowThresholdMs}
        fullUrl={fullUrl}
        onFullUrlChange={(value) => {
          setFullUrl(value);
          localStorage.setItem('flutter-monitor.http.full-url', String(value));
        }}
        onPatch={patch}
        onResetHttp={() => clearKeys(HTTP_KEYS)}
      />
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
        <HttpCatalogTable
          items={items}
          state={state}
          selectedId={search.detail}
          fullUrl={fullUrl}
          slowThresholdMs={catalog.data?.slowThresholdMs ?? search.slowThresholdMs ?? 1000}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={toggleSort}
          onOpen={open}
          onPeek={peek}
          onRetry={() => void catalog.refetch()}
        />
        <CatalogPagination
          page={page}
          pageSize={pageSize}
          total={catalog.data?.total ?? 0}
          onPageChange={(nextPage) => patch({ page: nextPage, eventId: undefined, detail: undefined })}
          onPageSizeChange={(nextPageSize) => patch({
            pageSize: nextPageSize,
            page: undefined,
            eventId: undefined,
            detail: undefined,
          })}
        />
      </div>
      <HttpRecord
        open={Boolean(search.detail)}
        item={detailItem}
        event={detail.data}
        loading={detail.isLoading}
        error={detail.isError}
        items={items}
        onOpenChange={(openValue) => {
          if (!openValue) patch({ detail: undefined });
        }}
        onNavigate={(next) => patch({ detail: next.eventId })}
        onExpand={(id) => {
          patch({ detail: undefined });
          void navigate({
            to: '/http/$eventId',
            params: { eventId: id },
            search: (current) => pickScopeSearch(current),
          });
        }}
      />
    </div>
  );
}

function toQuery(search: HttpSearch, page: number, pageSize: number): HttpCatalogQuery {
  return clean({
    appKey: list(search.appKey),
    packageName: list(search.packageName),
    environment: list(search.environment),
    appVersion: list(search.appVersion),
    devicePlatform: list(search.devicePlatform),
    from: search.from,
    to: search.to,
    userId: list(search.userId),
    sessionId: list(search.sessionId),
    route: list(search.route),
    url: search.url,
    method: list(search.method),
    result: resultList(search.result),
    requestId: list(search.requestId),
    statusCode: numberList(search.statusCode),
    businessCode: list(search.businessCode),
    host: list(search.host),
    slowOnly: search.slowOnly,
    slowThresholdMs: search.slowThresholdMs,
    sortBy: search.sortBy,
    sortDir: search.sortDir,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });
}

function toScope(search: HttpSearch): SessionFilters {
  return clean({
    appKey: list(search.appKey),
    packageName: list(search.packageName),
    environment: list(search.environment),
    appVersion: list(search.appVersion),
    devicePlatform: list(search.devicePlatform),
    from: search.from,
    to: search.to,
    userId: list(search.userId),
    sessionId: list(search.sessionId),
    route: list(search.route),
  });
}

function list(value?: string) {
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean) : undefined;
}
function resultList(value?: string): Array<'success' | 'failed' | 'unknown'> | undefined {
  const values = list(value)?.filter((item): item is 'success' | 'failed' | 'unknown' => (
    item === 'success' || item === 'failed' || item === 'unknown'
  ));
  return values?.length ? values : undefined;
}
function numberList(value?: string) {
  return list(value)?.map(Number).filter(Number.isFinite);
}
function clean<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== '' && (!Array.isArray(item) || item.length)),
  ) as T;
}
