import { useEffect, useMemo } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertCircle, AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, MousePointerClick, SearchX } from 'lucide-react';
import type { DomainSearch } from '../../app/router';
import { ScopeFilterBar } from '../../features/scope/scope-filter-bar';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../components/ui/empty';
import { Skeleton } from '../../components/ui/skeleton';
import { CatalogPagination } from '../../features/catalog/catalog-pagination';
import { CatalogPreviewShell } from '../../features/catalog/catalog-preview-shell';
import { CatalogRowActions } from '../../features/catalog/catalog-row-actions';
import { CatalogTable, type CatalogState } from '../../features/catalog/catalog-table';
import { DomainFilterBar } from '../../features/catalog/domain-filter-bar';
import { SortableHeader } from '../../features/catalog/sortable-header';
import { EnvironmentProfile } from '../../features/inspector/environment-profile';
import { RecordShell } from '../../features/inspector/record-shell';
import { JsonViewer } from '../../features/inspector/json-viewer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { datasource, queryKeys, useDimensionsQuery, useEventQuery, useSessionQuery } from '../../shared/datasource/queries';
import type { BusinessCatalogItem, BusinessCatalogQuery, ErrorCatalogItem, ErrorCatalogQuery, MonitorEvent, SessionFilters } from '../../shared/datasource/types';
import { readPath } from '../../shared/event-model/accessors';
import { CatalogLabels } from '../../shared/event-model/catalog-labels';
import { cn } from '../../shared/formatting/cn';
import { formatDateTime, formatTime } from '../../shared/formatting/format';
import {
  booleanFilterLabel,
  resultFilterLabel,
} from '../../shared/formatting/filter-labels';
import { pickScopeSearch } from '../../features/scope/scope-filters';

type Mode = 'business' | 'errors';
type Item = BusinessCatalogItem | ErrorCatalogItem;

const SCOPE_KEYS: Array<keyof DomainSearch> = ['appKey', 'packageName', 'environment', 'appVersion', 'devicePlatform', 'from', 'to', 'userId', 'sessionId', 'route'];

export function BusinessCatalogRoute() {
  return <DomainCatalog mode="business" />;
}

export function ErrorCatalogRoute() {
  return <DomainCatalog mode="errors" />;
}

function DomainCatalog({ mode }: { mode: Mode }) {
  const path = mode === 'business' ? '/business' : '/errors';
  const search = useSearch({ from: path });
  const navigate = useNavigate({ from: path });
  const page = search.page ?? 1;
  const pageSize = search.pageSize ?? 50;
  const sortBy = search.sortBy ?? 'timestamp';
  const sortDir = search.sortDir ?? 'desc';
  const query = useMemo(
    () => mode === 'business' ? businessQuery(search, page, pageSize) : errorQuery(search, page, pageSize),
    [mode, search, page, pageSize],
  );
  const catalog = useQuery<{ items: Item[]; total: number; limit: number; offset: number }>({
    queryKey: mode === 'business' ? queryKeys.businessCatalog(query as BusinessCatalogQuery) : queryKeys.errorCatalog(query as ErrorCatalogQuery),
    queryFn: async () => mode === 'business'
      ? datasource.businessCatalog(query as BusinessCatalogQuery)
      : datasource.errorCatalog(query as ErrorCatalogQuery),
  });
  const dimensions = useDimensionsQuery(scopeQuery(search));
  const detail = useEventQuery(search.detail);
  const items = catalog.data?.items ?? [];
  const selected = items.find((item) => item.eventId === search.eventId);
  const detailItem = items.find((item) => item.eventId === search.detail)
    ?? (search.detail === selected?.eventId ? selected : undefined);
  const total = catalog.data?.total ?? 0;
  const hasDomainFilters = mode === 'business'
    ? Boolean(search.action || search.result)
    : Boolean(search.errorType || search.mechanism || search.fatal !== undefined || search.handled !== undefined || search.businessOnly);

  function patch(value: Partial<DomainSearch>, reset = false) {
    void navigate({
      search: (current) => clean({ ...current, ...value, ...(reset ? { page: undefined, eventId: undefined, detail: undefined } : {}) }),
      replace: reset,
    });
  }

  function select(item: Item) {
    patch({ eventId: item.eventId, detail: undefined });
  }

  function peek(item: Item) {
    patch({ eventId: item.eventId, detail: item.eventId });
  }

  function open(item: Item) {
    void navigate({
      to: mode === 'business' ? '/business/$eventId' : '/errors/$eventId',
      params: { eventId: item.eventId },
      search: (current) => pickScopeSearch(current),
    });
  }

  function toggleSort() {
    const nextDir = sortBy === 'timestamp' && sortDir === 'desc' ? 'asc' : 'desc';
    patch({
      sortBy: nextDir === 'desc' ? undefined : 'timestamp',
      sortDir: nextDir === 'desc' ? undefined : nextDir,
    }, true);
  }

  useEffect(() => {
    if (catalog.data && search.eventId && !items.some((item) => item.eventId === search.eventId)) {
      patch({ eventId: undefined, detail: undefined });
    }
  }, [catalog.data, items, search.eventId]);

  const state: CatalogState = catalog.isLoading && !catalog.data
    ? 'loading'
    : catalog.isError
      ? 'error'
      : items.length === 0
        ? ((hasDomainFilters || hasScope(search)) ? 'noResults' : 'empty')
        : 'ready';

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <ScopeFilterBar search={search} dimensions={dimensions.data} onPatch={patch} />
      <DomainFilterBar
        mode={mode}
        search={search}
        onPatch={patch}
        onReset={() => patch(
          mode === 'business'
            ? { action: undefined, result: undefined }
            : { errorType: undefined, mechanism: undefined, fatal: undefined, handled: undefined, businessOnly: undefined },
          true,
        )}
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 min-[1400px]:grid-cols-[minmax(0,1fr)_17.5rem]">
        <div className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto]">
          <DomainTable
            mode={mode}
            items={items}
            state={state}
            selectedId={search.eventId}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={toggleSort}
            onSelect={select}
            onOpen={open}
            onPeek={peek}
            onRetry={() => void catalog.refetch()}
          />
          <CatalogPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(nextPage) => patch({ page: nextPage, eventId: undefined, detail: undefined })}
            onPageSizeChange={(nextPageSize) => patch({ pageSize: nextPageSize, page: undefined, eventId: undefined, detail: undefined })}
          />
        </div>
        <aside className="hidden min-h-0 overflow-auto border-l bg-muted/20 min-[1400px]:block">
          <DomainPreview
            mode={mode}
            item={selected}
            onOpen={() => selected && open(selected)}
            onPeek={() => selected && peek(selected)}
          />
        </aside>
      </div>
      <DomainRecord
        mode={mode}
        open={Boolean(search.detail)}
        item={detailItem}
        event={detail.data}
        loading={detail.isLoading}
        error={detail.isError}
        items={items}
        onClose={() => patch({ detail: undefined })}
        onNavigate={(next) => patch({ eventId: next.eventId, detail: next.eventId })}
        onExpand={(id) => {
          patch({ detail: undefined });
          void navigate({
            to: mode === 'business' ? '/business/$eventId' : '/errors/$eventId',
            params: { eventId: id },
            search: (current) => pickScopeSearch(current),
          });
        }}
      />
    </div>
  );
}

function DomainTable({
  mode,
  items,
  state,
  selectedId,
  sortBy,
  sortDir,
  onSort,
  onSelect,
  onOpen,
  onPeek,
  onRetry,
}: {
  mode: Mode;
  items: Item[];
  state: CatalogState;
  selectedId?: string;
  sortBy: 'timestamp';
  sortDir: 'asc' | 'desc';
  onSort: () => void;
  onSelect: (item: Item) => void;
  onOpen: (item: Item) => void;
  onPeek: (item: Item) => void;
  onRetry: () => void;
}) {
  const columns = useMemo<ColumnDef<Item>[]>(
    () => mode === 'business'
      ? businessColumns(onOpen, onPeek, sortBy, sortDir, onSort) as ColumnDef<Item>[]
      : errorColumns(onOpen, onPeek, sortBy, sortDir, onSort) as ColumnDef<Item>[],
    [mode, onOpen, onPeek, onSort, sortBy, sortDir],
  );

  return (
    <CatalogTable
      items={items}
      columns={columns}
      state={state}
      selectedId={selectedId}
      getRowId={(item) => item.eventId}
      minWidthClass="min-w-[920px]"
      message={mode === 'business' ? {
        emptyTitle: '暂无埋点数据',
        emptyDescription: '等待应用产生业务动作。',
        emptyIcon: MousePointerClick,
        errorTitle: '埋点数据加载失败',
        errorDescription: '请检查 Monitor Service 后重试。',
      } : {
        emptyTitle: '暂无异常数据',
        emptyDescription: '当前范围没有错误或业务失败。',
        emptyIcon: AlertTriangle,
        errorTitle: '异常数据加载失败',
        errorDescription: '请检查 Monitor Service 后重试。',
      }}
      onSelect={onSelect}
      onOpen={onOpen}
      onRetry={onRetry}
      columnClassName={(id, header) => domainColumnClass(mode, id, header)}
      skeletonClassName={(id) => id === 'action' || id === 'message' ? 'h-4 w-full' : 'h-4 w-16'}
    />
  );
}

function businessColumns(
  onOpen: (item: Item) => void,
  onPeek: (item: Item) => void,
  sortBy: 'timestamp',
  sortDir: 'asc' | 'desc',
  onSort: () => void,
): ColumnDef<BusinessCatalogItem>[] {
  return [
    {
      accessorKey: 'timestamp',
      header: () => (
        <SortableHeader
          label={CatalogLabels.time}
          active={sortBy === 'timestamp'}
          direction={sortDir}
          onClick={onSort}
        />
      ),
      cell: ({ row }) => <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTime(row.original.timestamp)}</span>,
    },
    {
      accessorKey: 'action',
      header: CatalogLabels.action,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="block truncate font-mono text-xs" title={row.original.action}>{row.original.action}</span>
          {row.original.summary ? <Badge variant="secondary">摘要</Badge> : null}
        </div>
      ),
    },
    {
      accessorKey: 'result',
      header: CatalogLabels.result,
      cell: ({ row }) => (
        <span className={cn(row.original.result === 'failed' && 'font-medium text-destructive')}>
          {resultFilterLabel(row.original.result)}
        </span>
      ),
    },
    { accessorKey: 'route', header: CatalogLabels.route, cell: ({ row }) => <Truncated value={row.original.route} /> },
    { accessorKey: 'userId', header: CatalogLabels.user, cell: ({ row }) => <Truncated value={row.original.userId} /> },
    { accessorKey: 'appVersion', header: CatalogLabels.version, cell: ({ row }) => row.original.appVersion ?? '-' },
    { accessorKey: 'environment', header: CatalogLabels.environment, cell: ({ row }) => row.original.environment ?? '-' },
    { accessorKey: 'sessionId', header: CatalogLabels.session, cell: ({ row }) => <ShortId value={row.original.sessionId} /> },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => <CatalogRowActions item={row.original} label="埋点" onOpen={onOpen} onPeek={onPeek} />,
    },
  ];
}

function errorColumns(
  onOpen: (item: Item) => void,
  onPeek: (item: Item) => void,
  sortBy: 'timestamp',
  sortDir: 'asc' | 'desc',
  onSort: () => void,
): ColumnDef<ErrorCatalogItem>[] {
  return [
    {
      accessorKey: 'timestamp',
      header: () => (
        <SortableHeader
          label={CatalogLabels.time}
          active={sortBy === 'timestamp'}
          direction={sortDir}
          onClick={onSort}
        />
      ),
      cell: ({ row }) => <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTime(row.original.timestamp)}</span>,
    },
    {
      id: 'kind',
      header: CatalogLabels.kind,
      cell: ({ row }) => (
        <Badge variant={row.original.kind === 'business_failure' ? 'secondary' : 'destructive'}>
          {row.original.kind === 'business_failure' ? '业务失败' : '异常'}
        </Badge>
      ),
    },
    {
      accessorKey: 'message',
      header: CatalogLabels.message,
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <Truncated value={row.original.title ?? row.original.message ?? row.original.type} />
          {row.original.summary ? (
            <span className="text-xs text-muted-foreground">聚合 · {row.original.occurrenceCount ?? '-'} 次</span>
          ) : row.original.fingerprint ? (
            <span className="truncate font-mono text-[11px] text-muted-foreground" title={row.original.fingerprint}>
              {row.original.fingerprint}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'occurrenceCount',
      header: CatalogLabels.occurrenceCount,
      cell: ({ row }) => (
        <span className="block text-right font-mono tabular-nums">
          {row.original.occurrenceCount ?? (row.original.summary ? '-' : '1')}
        </span>
      ),
    },
    { id: 'handledState', header: CatalogLabels.handledState, cell: ({ row }) => errorStateLabel(row.original) },
    { accessorKey: 'route', header: CatalogLabels.route, cell: ({ row }) => <Truncated value={row.original.route} /> },
    { accessorKey: 'userId', header: CatalogLabels.user, cell: ({ row }) => <Truncated value={row.original.userId} /> },
    { accessorKey: 'appVersion', header: CatalogLabels.version, cell: ({ row }) => row.original.appVersion ?? '-' },
    { accessorKey: 'environment', header: CatalogLabels.environment, cell: ({ row }) => row.original.environment ?? '-' },
    { accessorKey: 'sessionId', header: CatalogLabels.session, cell: ({ row }) => <ShortId value={row.original.sessionId} /> },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => <CatalogRowActions item={row.original} label="异常" onOpen={onOpen} onPeek={onPeek} />,
    },
  ];
}

function DomainPreview({ mode, item, onOpen, onPeek }: {
  mode: Mode;
  item?: Item;
  onOpen: () => void;
  onPeek: () => void;
}) {
  const business = mode === 'business' ? item as BusinessCatalogItem : undefined;
  const error = mode === 'errors' ? item as ErrorCatalogItem : undefined;

  return (
    <CatalogPreviewShell
      selected={Boolean(item)}
      emptyDescription={`从${mode === 'business' ? '埋点' : '异常'}表格中选择一条记录。`}
      header={item ? (
        <div className="flex min-w-0 flex-col gap-2">
          {business ? (
            <>
              <Badge className="w-fit" variant={business.result === 'failed' ? 'destructive' : 'secondary'}>{resultFilterLabel(business.result)}</Badge>
              <p className="break-all font-mono text-sm font-medium leading-6">{business.action}</p>
            </>
          ) : (
            <>
              <Badge className="w-fit" variant={error?.kind === 'business_failure' ? 'secondary' : 'destructive'}>{error?.kind === 'business_failure' ? '业务失败' : '异常'}</Badge>
              <p className="break-all text-sm font-medium leading-6">{error?.type}</p>
              {error?.message ? <p className="break-words text-sm text-muted-foreground">{error.message}</p> : null}
            </>
          )}
        </div>
      ) : undefined}
      facts={item ? [
        ...(error?.fingerprint ? [{ label: 'Fingerprint', value: error.fingerprint }] : []),
        ...(error?.occurrenceCount != null ? [{ label: CatalogLabels.occurrenceCount, value: error.occurrenceCount }] : []),
        ...(error?.summary ? [{ label: '形态', value: '聚合摘要' }] : []),
        { label: CatalogLabels.route, value: item.route ?? '-' },
        { label: CatalogLabels.user, value: item.userId ?? '-' },
        { label: CatalogLabels.version, value: item.appVersion ?? '-' },
        { label: CatalogLabels.environment, value: item.environment ?? '-' },
        { label: CatalogLabels.time, value: formatDateTime(item.timestamp) },
      ] : undefined}
      ids={item ? [
        { label: CatalogLabels.eventId, value: item.eventId },
        { label: CatalogLabels.session, value: item.sessionId },
        { label: CatalogLabels.trace, value: item.traceId },
      ] : undefined}
      eventId={item?.eventId}
      sessionId={item?.sessionId}
      onOpen={onOpen}
      onPeek={onPeek}
    />
  );
}

function DomainRecord({ mode, open, item, event, loading, error, items = [], onClose, onNavigate, onExpand }: {
  mode: Mode;
  open: boolean;
  item?: Item;
  event?: MonitorEvent;
  loading: boolean;
  error: boolean;
  items?: Item[];
  onClose: () => void;
  onNavigate?: (item: Item) => void;
  onExpand?: (eventId: string) => void;
}) {
  const index = item ? items.findIndex((entry) => entry.eventId === item.eventId) : -1;
  const previous = index > 0 ? items[index - 1] : undefined;
  const next = index >= 0 && index < items.length - 1 ? items[index + 1] : undefined;
  return (
    <RecordShell
      open={open}
      onOpenChange={(value) => !value && onClose()}
      title={mode === 'business' ? (item as BusinessCatalogItem | undefined)?.action ?? '埋点详情' : (item as ErrorCatalogItem | undefined)?.type ?? '异常详情'}
      state={loading ? 'loading' : error ? 'error' : event ? 'ready' : 'notFound'}
      summary={item ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={recordBadgeVariant(mode, item)}>
            {mode === 'business' ? resultFilterLabel((item as BusinessCatalogItem).result) : (item as ErrorCatalogItem).kind === 'business_failure' ? '业务失败' : '异常'}
          </Badge>
          <span className="text-xs text-muted-foreground">{formatDateTime(item.timestamp)} · {item.route ?? '-'}</span>
        </div>
      ) : undefined}
      headerActions={(
        <>
          <Button
            size="icon"
            variant="ghost"
            aria-label="上一条"
            disabled={!previous || !onNavigate}
            onClick={() => previous && onNavigate?.(previous)}
          >
            <ChevronLeft data-icon="inline-start" />
          </Button>
          <span className="min-w-10 text-center text-xs tabular-nums text-muted-foreground">
            {items.length === 0 || index < 0 ? '-' : `${index + 1}/${items.length}`}
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label="下一条"
            disabled={!next || !onNavigate}
            onClick={() => next && onNavigate?.(next)}
          >
            <ChevronRight data-icon="inline-start" />
          </Button>
          {onExpand && item?.eventId ? (
            <Button size="sm" variant="outline" onClick={() => onExpand(item.eventId)}>
              <ExternalLink data-icon="inline-start" />
              全屏
            </Button>
          ) : null}
        </>
      )}
    >
      <DomainRecordContent mode={mode} event={event} loading={loading} error={error} />
    </RecordShell>
  );
}

export function DomainRecordContent({
  mode,
  event,
  loading,
  error,
}: {
  mode: Mode;
  event?: MonitorEvent;
  loading: boolean;
  error: boolean;
}) {
  const session = useSessionQuery(event?.sessionId);
  const related = (session.data ?? [])
    .filter((candidate) => candidate.eventId !== event?.eventId && (candidate.name === 'http.client' || readPath(candidate, ['attributes', 'business.action']) !== undefined || candidate.signalType === 'error'))
    .slice(-8);

  if (loading) return <DomainRecordLoading />;
  if (error) return <DomainRecordState icon={AlertCircle} title="详情加载失败" description="请检查 Monitor Service 后重试。" />;
  if (!event) return <DomainRecordState icon={SearchX} title="找不到该事件" description="事件可能已超过本地保留上限。" />;

  return (
    <Tabs key={event.eventId} defaultValue="detail" className="flex h-full min-h-0 flex-col gap-4 p-6">
      <TabsList className="w-fit shrink-0">
        <TabsTrigger value="detail">{mode === 'business' ? '属性' : '错误'}</TabsTrigger>
        <TabsTrigger value="related">关联</TabsTrigger>
        <TabsTrigger value="context">上下文</TabsTrigger>
        <TabsTrigger value="raw">Raw</TabsTrigger>
      </TabsList>
      <TabsContent value="detail" className="min-h-0 flex-1 overflow-auto"><DomainDetail mode={mode} event={event} /></TabsContent>
      <TabsContent value="related" className="min-h-0 flex-1 overflow-auto"><Related events={related} /></TabsContent>
      <TabsContent value="context" className="min-h-0 flex-1 overflow-auto"><EnvironmentProfile event={event} /></TabsContent>
      <TabsContent value="raw" className="min-h-0 flex-1 overflow-auto"><JsonViewer value={event} collapsed={2} /></TabsContent>
    </Tabs>
  );
}

function DomainRecordLoading() {
  return (
    <div className="flex h-full flex-col gap-5 p-6">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-5/6" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

function DomainRecordState({ icon: Icon, title, description }: {
  icon: typeof AlertCircle;
  title: string;
  description: string;
}) {
  return (
    <Empty className="h-full border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Icon /></EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function DomainDetail({ mode, event }: { mode: Mode; event: MonitorEvent }) {
  if (mode === 'business') return <JsonViewer value={readPath(event, ['payload', 'payload.properties']) ?? readPath(event, ['payload', 'properties']) ?? {}} collapsed={2} />;
  const error = readPath(event, ['payload', 'error']);
  const stack = readPath(event, ['payload', 'payload.error.stacktrace']) ?? readPath(event, ['payload', 'stack']) ?? (isRecord(error) ? error.stack : undefined);
  const breadcrumbs = readPath(event, ['payload', 'payload.breadcrumbs']) ?? readPath(event, ['payload', 'breadcrumbs']);
  const message = readPath(event, ['payload', 'payload.error.message']) ?? (isRecord(error) ? error.message : undefined) ?? readPath(event, ['payload', 'message']) ?? event.name;
  return (
    <div className="grid gap-4">
      <Section title="消息" value={message} text />
      <Section title="堆栈" value={stack} text />
      <Section title="足迹" value={breadcrumbs} />
    </div>
  );
}

function Related({ events }: { events: MonitorEvent[] }) {
  return events.length ? (
    <div className="grid gap-2">
      {events.map((event) => (
        <div key={event.eventId} className="rounded-md border p-2 text-xs">
          <div className="font-medium">{event.name}</div>
          <div className="text-muted-foreground">{formatDateTime(event.timestamp)} · {event.status ?? event.signalType}</div>
        </div>
      ))}
    </div>
  ) : <div className="grid min-h-40 place-items-center text-sm text-muted-foreground">同 Session 没有相关 HTTP、埋点或错误。</div>;
}

function Section({ title, value, text }: { title: string; value: unknown; text?: boolean }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {value === undefined
        ? <p className="text-xs text-muted-foreground">没有可用数据。</p>
        : text
          ? <pre className="whitespace-pre-wrap break-words rounded-md border bg-muted/50 p-3 text-xs">{String(value)}</pre>
          : <JsonViewer value={value} collapsed={2} />}
    </section>
  );
}

function businessQuery(search: DomainSearch, page: number, size: number): BusinessCatalogQuery {
  return clean({
    ...scopeQuery(search),
    action: search.action,
    result: list(search.result),
    sortBy: search.sortBy,
    sortDir: search.sortDir,
    limit: size,
    offset: (page - 1) * size,
  });
}

function errorQuery(search: DomainSearch, page: number, size: number): ErrorCatalogQuery {
  return clean({
    ...scopeQuery(search),
    errorType: search.errorType,
    mechanism: list(search.mechanism),
    fatal: search.fatal,
    handled: search.handled,
    businessOnly: search.businessOnly,
    sortBy: search.sortBy,
    sortDir: search.sortDir,
    limit: size,
    offset: (page - 1) * size,
  });
}

function scopeQuery(search: DomainSearch): SessionFilters {
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
  return value?.split(',').map((item) => item.trim()).filter(Boolean);
}

function clean<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== '' && (!Array.isArray(item) || item.length))) as T;
}

function hasScope(search: DomainSearch) {
  return SCOPE_KEYS.some((key) => search[key] !== undefined);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function errorStateLabel(item: ErrorCatalogItem) {
  if (item.fatal !== undefined) return `致命: ${booleanFilterLabel(item.fatal)}`;
  if (item.handled !== undefined) return `已处理: ${booleanFilterLabel(item.handled)}`;
  return '-';
}

function recordBadgeVariant(mode: Mode, item: Item): 'secondary' | 'destructive' {
  if (mode === 'business') return (item as BusinessCatalogItem).result === 'failed' ? 'destructive' : 'secondary';
  return (item as ErrorCatalogItem).kind === 'business_failure' ? 'secondary' : 'destructive';
}

function domainColumnClass(mode: Mode, id: string, header: boolean) {
  return cn(
    id === 'timestamp' && 'w-[176px]',
    id === 'result' && 'w-[80px]',
    id === 'kind' && 'w-[88px]',
    id === 'handledState' && 'w-[90px]',
    id === 'occurrenceCount' && 'w-[64px] text-right',
    id === 'route' && 'w-[100px]',
    id === 'userId' && 'w-[70px]',
    id === 'sessionId' && 'w-[120px]',
    id === 'appVersion' && 'w-[60px]',
    id === 'environment' && 'w-[72px]',
    id === 'actions' && 'w-[88px]',
    mode === 'business' && id === 'action' && 'min-w-[180px]',
    mode === 'errors' && id === 'message' && 'min-w-[128px]',
    !header && 'overflow-hidden',
  );
}

function Truncated({ value }: { value?: string }) {
  return <span className="block truncate" title={value}>{value ?? '-'}</span>;
}

function ShortId({ value }: { value?: string }) {
  if (!value) return <span>-</span>;
  const display = value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
  return <span className="block truncate font-mono text-xs" title={value}>{display}</span>;
}
