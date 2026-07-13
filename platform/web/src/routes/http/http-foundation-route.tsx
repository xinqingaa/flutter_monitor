import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { HttpSearch } from '../../app/router';
import { ScopeFilterBar } from '../../features/scope/scope-filter-bar';
import { HttpFilterBar } from '../../features/http/http-filter-bar';
import { HttpCatalogTable, type CatalogState } from '../../features/http/http-catalog-table';
import { CatalogPagination } from '../../features/catalog/catalog-pagination';
import { CatalogPreviewPane } from '../../features/catalog/catalog-preview-pane';
import { HttpRecord } from '../../features/inspector/http-record';
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
  'sessionId',
  'route',
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
  const selected = items.find((item) => item.eventId === search.eventId);
  const detailItem = items.find((item) => item.eventId === search.detail)
    ?? (search.detail === selected?.eventId ? selected : undefined);
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
  function select(item: HttpCatalogItem) {
    const narrow = window.matchMedia('(max-width: 1399px)').matches;
    patch({ eventId: item.eventId, detail: narrow ? item.eventId : undefined });
  }
  function open(item: HttpCatalogItem) {
    patch({ eventId: item.eventId, detail: item.eventId });
  }
  function toggleSort(nextSortBy: 'timestamp' | 'durationMs') {
    const nextDir = sortBy === nextSortBy && sortDir === 'desc' ? 'asc' : 'desc';
    patch({
      sortBy: nextSortBy === 'timestamp' && nextDir === 'desc' ? undefined : nextSortBy,
      sortDir: nextSortBy === 'timestamp' && nextDir === 'desc' ? undefined : nextDir,
    }, true);
  }

  useEffect(() => {
    if (!catalog.data || !search.eventId) return;
    if (!items.some((item) => item.eventId === search.eventId)) patch({ eventId: undefined, detail: undefined });
  }, [catalog.data, items, search.eventId]);

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
      <div className="grid min-h-0 flex-1 grid-cols-1 min-[1400px]:grid-cols-[minmax(0,1fr)_17.5rem]">
        <div className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto]">
          <HttpCatalogTable
            items={items}
            state={state}
            selectedId={search.eventId}
            fullUrl={fullUrl}
            slowThresholdMs={catalog.data?.slowThresholdMs ?? search.slowThresholdMs ?? 1000}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={toggleSort}
            onSelect={select}
            onOpen={open}
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
        <aside className="hidden min-h-0 overflow-auto border-l bg-muted/20 min-[1400px]:block">
          <CatalogPreviewPane
            item={selected}
            loading={Boolean(search.eventId && catalog.isLoading)}
            error={Boolean(search.eventId && catalog.isError)}
            onOpen={() => selected && open(selected)}
          />
        </aside>
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
        onNavigate={(next) => patch({ eventId: next.eventId, detail: next.eventId })}
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
