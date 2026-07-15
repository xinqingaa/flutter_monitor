import { useEffect, useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { SessionsSearch } from '../../app/router';
import { CatalogPagination } from '../../features/catalog/catalog-pagination';
import { ScopeFilterBar } from '../../features/scope/scope-filter-bar';
import { readScopeFilters, scopeToSessionFilters } from '../../features/scope/scope-filters';
import { SessionCatalogTable, SessionPreviewPane } from '../../features/session/session-catalog-table';
import { SessionListFilterForm } from '../../features/session/session-list-filter-form';
import { sessionListToSessionFilters, useSessionListFilters } from '../../features/session/session-list-filters';
import { SessionRecord } from '../../features/session/session-record';
import { useDimensionsQuery, useSessionsQuery } from '../../shared/datasource/queries';
import type { SessionSummary } from '../../shared/datasource/types';
import type { CatalogState } from '../../features/catalog/catalog-table';

export function SessionsRoute() {
  const search = useSearch({ from: '/sessions' });
  const navigate = useNavigate({ from: '/sessions' });
  const page = search.page ?? 1;
  const pageSize = search.pageSize ?? 50;
  const { filters: listFilters, patchFilters: patchListFilters, clearFilters: clearListFilters } = useSessionListFilters();
  const scopeQueryFilters = useMemo(() => scopeToSessionFilters(readScopeFilters(search)), [search]);
  const localQueryFilters = useMemo(() => sessionListToSessionFilters(listFilters), [listFilters]);
  const queryFilters = useMemo(
    () => clean({ ...scopeQueryFilters, ...localQueryFilters, limit: pageSize, offset: (page - 1) * pageSize }),
    [scopeQueryFilters, localQueryFilters, page, pageSize],
  );
  const dimensions = useDimensionsQuery(scopeQueryFilters);
  const sessionsQuery = useSessionsQuery(queryFilters);
  const items = sessionsQuery.data?.sessions ?? [];
  const selected = items.find((item) => item.sessionId === search.selected);
  const detailItem = items.find((item) => item.sessionId === search.detail)
    ?? (search.detail === selected?.sessionId ? selected : undefined);
  const hasFilters = Boolean(
    search.appKey || search.packageName || search.environment || search.appVersion || search.devicePlatform
    || search.from || search.to || search.userId || search.sessionId || search.route
    || Object.values(listFilters).some((value) => value !== undefined && value !== ''),
  );

  function patch(patchValue: Partial<SessionsSearch>, resetPage = false) {
    void navigate({
      search: (current) => clean({
        ...current,
        ...patchValue,
        ...(resetPage ? { page: undefined, selected: undefined, detail: undefined } : {}),
      }),
      replace: resetPage,
    });
  }

  function select(item: SessionSummary) {
    patch({ selected: item.sessionId, detail: undefined });
  }

  function peek(item: SessionSummary) {
    patch({ selected: item.sessionId, detail: item.sessionId });
  }

  function open(item: SessionSummary) {
    void navigate({
      to: '/sessions/$sessionId',
      params: { sessionId: item.sessionId },
      search: { eventId: item.lastEventId },
    });
  }

  useEffect(() => {
    if (!sessionsQuery.data || !search.selected) return;
    if (!items.some((item) => item.sessionId === search.selected)) {
      patch({ selected: undefined, detail: undefined });
    }
  }, [sessionsQuery.data, items, search.selected]);

  const state: CatalogState = sessionsQuery.isLoading && !sessionsQuery.data
    ? 'loading'
    : sessionsQuery.isError
      ? 'error'
      : items.length === 0
        ? (hasFilters ? 'noResults' : 'empty')
        : 'ready';

  const total = sessionsQuery.data?.hasMore
    ? (page - 1) * pageSize + items.length + 1
    : (page - 1) * pageSize + items.length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ScopeFilterBar search={search} dimensions={dimensions.data} onPatch={patch} />
      <section className="flex flex-wrap items-end gap-2 border-b px-4 py-2">
        <SessionListFilterForm
          filters={listFilters}
          dimensions={dimensions.data}
          onChange={(next) => {
            patchListFilters(next);
            patch({ page: undefined, selected: undefined, detail: undefined }, true);
          }}
          onClear={() => {
            clearListFilters();
            patch({ page: undefined, selected: undefined, detail: undefined }, true);
          }}
        />
      </section>
      <div className="grid min-h-0 flex-1 grid-cols-1 min-[1400px]:grid-cols-[minmax(0,1fr)_17.5rem]">
        <div className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto]">
          <SessionCatalogTable
            items={items}
            state={state}
            selectedId={search.selected}
            onSelect={select}
            onOpen={open}
            onPeek={peek}
            onRetry={() => void sessionsQuery.refetch()}
          />
          <CatalogPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(nextPage) => patch({ page: nextPage, selected: undefined, detail: undefined })}
            onPageSizeChange={(nextPageSize) => patch({
              pageSize: nextPageSize,
              page: undefined,
              selected: undefined,
              detail: undefined,
            })}
          />
        </div>
        <aside className="hidden min-h-0 overflow-auto border-l bg-muted/20 min-[1400px]:block">
          <SessionPreviewPane
            item={selected}
            loading={Boolean(search.selected && sessionsQuery.isLoading)}
            error={Boolean(search.selected && sessionsQuery.isError)}
            onOpen={() => selected && open(selected)}
            onPeek={() => selected && peek(selected)}
          />
        </aside>
      </div>
      <SessionRecord
        open={Boolean(search.detail)}
        item={detailItem}
        onOpenChange={(openValue) => {
          if (!openValue) patch({ detail: undefined });
        }}
        onExpand={(sessionId) => {
          patch({ detail: undefined });
          void navigate({
            to: '/sessions/$sessionId',
            params: { sessionId },
            search: { eventId: detailItem?.lastEventId },
          });
        }}
      />
    </div>
  );
}

function clean<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined && item !== '' && (!Array.isArray(item) || item.length)),
  ) as T;
}
