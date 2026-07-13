import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertCircle, AlertTriangle, ChevronLeft, ChevronRight, Filter, MoreHorizontal, MousePointerClick, RotateCcw, SearchX, X } from 'lucide-react';
import type { DomainSearch } from '../../app/router';
import { ScopeFilterBar } from '../../features/scope/scope-filter-bar';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { Field, FieldGroup, FieldLabel } from '../../components/ui/field';
import { Input } from '../../components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../../components/ui/empty';
import { Skeleton } from '../../components/ui/skeleton';
import { FilterSelect } from '../../components/common/filter-select';
import { CatalogPagination } from '../../features/catalog/catalog-pagination';
import { CatalogPreviewShell } from '../../features/catalog/catalog-preview-shell';
import { CatalogRowActions } from '../../features/catalog/catalog-row-actions';
import { CatalogTable, type CatalogState } from '../../features/catalog/catalog-table';
import { RecordShell } from '../../features/inspector/record-shell';
import { JsonViewer } from '../../features/inspector/json-viewer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { datasource, queryKeys, useDimensionsQuery, useEventQuery, useSessionQuery } from '../../shared/datasource/queries';
import type { BusinessCatalogItem, BusinessCatalogQuery, ErrorCatalogItem, ErrorCatalogQuery, MonitorEvent, SessionFilters } from '../../shared/datasource/types';
import { readPath } from '../../shared/event-model/accessors';
import { cn } from '../../shared/formatting/cn';
import { formatDateTime, formatTime } from '../../shared/formatting/format';
import {
  booleanFilterLabel,
  businessResultFilterOptions,
  errorMechanismFilterOptions,
  resultFilterLabel,
} from '../../shared/formatting/filter-labels';
import { useDebouncedValue } from '../../shared/hooks/use-debounced-value';

type Mode = 'business' | 'errors';
type Item = BusinessCatalogItem | ErrorCatalogItem;

const SCOPE_KEYS: Array<keyof DomainSearch> = ['appKey', 'packageName', 'environment', 'appVersion', 'devicePlatform', 'from', 'to', 'userId', 'sessionId', 'route'];
const BUSINESS_KEYS: Array<keyof DomainSearch> = ['action', 'result'];
const ERROR_KEYS: Array<keyof DomainSearch> = ['errorType', 'mechanism', 'fatal', 'handled', 'businessOnly'];

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

  function clearKeys(keys: Array<keyof DomainSearch>) {
    patch(Object.fromEntries(keys.map((key) => [key, undefined])) as Partial<DomainSearch>, true);
  }

  function select(item: Item) {
    patch({ eventId: item.eventId, detail: window.matchMedia('(max-width: 1399px)').matches ? item.eventId : undefined });
  }

  function open(item: Item) {
    patch({ eventId: item.eventId, detail: item.eventId });
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
      <DomainFilters
        mode={mode}
        search={search}
        total={total}
        onPatch={patch}
        onReset={() => patch(
          mode === 'business'
            ? { action: undefined, result: undefined }
            : { errorType: undefined, mechanism: undefined, fatal: undefined, handled: undefined, businessOnly: undefined },
          true,
        )}
        onClearAll={() => clearKeys([...SCOPE_KEYS, ...(mode === 'business' ? BUSINESS_KEYS : ERROR_KEYS)])}
      />
      <div className="grid min-h-0 flex-1 grid-cols-1 min-[1400px]:grid-cols-[minmax(0,1fr)_17.5rem]">
        <div className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto]">
          <DomainTable mode={mode} items={items} state={state} selectedId={search.eventId} onSelect={select} onOpen={open} onRetry={() => void catalog.refetch()} />
          <CatalogPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(nextPage) => patch({ page: nextPage, eventId: undefined, detail: undefined })}
            onPageSizeChange={(nextPageSize) => patch({ pageSize: nextPageSize, page: undefined, eventId: undefined, detail: undefined })}
          />
        </div>
        <aside className="hidden min-h-0 overflow-auto border-l bg-muted/20 min-[1400px]:block">
          <DomainPreview mode={mode} item={selected} onOpen={() => selected && open(selected)} />
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
      />
    </div>
  );
}

function DomainFilters({ mode, search, total, onPatch, onReset, onClearAll }: {
  mode: Mode;
  search: DomainSearch;
  total: number;
  onPatch: (value: Partial<DomainSearch>, reset?: boolean) => void;
  onReset: () => void;
  onClearAll: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  const keys = mode === 'business' ? BUSINESS_KEYS : ERROR_KEYS;
  const activeMore = mode === 'errors'
    ? [search.fatal !== undefined, search.handled !== undefined, search.businessOnly].filter(Boolean).length
    : 0;

  return (
    <section aria-label={`${mode === 'business' ? '埋点' : '异常'}筛选`} className="border-b px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        {mode === 'business' ? (
          <>
            <CommitInput label="Action" value={search.action} onCommit={(action) => onPatch({ action }, true)} />
            <FilterSelect value={search.result} placeholder="全部结果" options={businessResultFilterOptions} onChange={(result) => onPatch({ result }, true)} className="w-32" />
          </>
        ) : (
          <>
            <CommitInput label="错误类型" value={search.errorType} onCommit={(errorType) => onPatch({ errorType }, true)} />
            <FilterSelect value={search.mechanism} placeholder="全部机制" options={errorMechanismFilterOptions} onChange={(mechanism) => onPatch({ mechanism }, true)} className="w-32" />
            <Popover open={moreOpen} onOpenChange={setMoreOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline"><Filter data-icon="inline-start" />更多筛选{activeMore ? ` (${activeMore})` : ''}</Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                <FieldGroup>
                  <Field>
                    <FieldLabel>致命状态</FieldLabel>
                    <TriSelect label="致命" value={search.fatal} onChange={(fatal) => onPatch({ fatal }, true)} />
                  </Field>
                  <Field>
                    <FieldLabel>处理状态</FieldLabel>
                    <TriSelect label="已处理" value={search.handled} onChange={(handled) => onPatch({ handled }, true)} />
                  </Field>
                  <Field orientation="horizontal">
                    <Checkbox id="business-only" checked={search.businessOnly === true} onCheckedChange={(checked) => onPatch({ businessOnly: checked === true || undefined }, true)} />
                    <FieldLabel htmlFor="business-only">仅业务失败</FieldLabel>
                  </Field>
                </FieldGroup>
              </PopoverContent>
            </Popover>
          </>
        )}
        <span className="whitespace-nowrap text-sm text-muted-foreground">{total} 条</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" aria-label={`${mode === 'business' ? '埋点' : '异常'}筛选操作`}>
              <MoreHorizontal data-icon="inline-start" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={onReset}><RotateCcw />重置领域筛选</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={onClearAll}><X />清除全部筛选</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {keys.some((key) => search[key] !== undefined) ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {keys.flatMap((key) => search[key] !== undefined
            ? [<Badge key={key} variant="secondary">{domainFilterLabel(key, search[key])}</Badge>]
            : [])}
        </div>
      ) : null}
    </section>
  );
}

function DomainTable({ mode, items, state, selectedId, onSelect, onOpen, onRetry }: {
  mode: Mode;
  items: Item[];
  state: CatalogState;
  selectedId?: string;
  onSelect: (item: Item) => void;
  onOpen: (item: Item) => void;
  onRetry: () => void;
}) {
  const columns = useMemo<ColumnDef<Item>[]>(
    () => mode === 'business'
      ? businessColumns(onOpen) as ColumnDef<Item>[]
      : errorColumns(onOpen) as ColumnDef<Item>[],
    [mode, onOpen],
  );

  return (
    <CatalogTable
      items={items}
      columns={columns}
      state={state}
      selectedId={selectedId}
      minWidthClass="min-w-[880px]"
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

function businessColumns(onOpen: (item: Item) => void): ColumnDef<BusinessCatalogItem>[] {
  return [
    {
      accessorKey: 'timestamp',
      header: '时间',
      cell: ({ row }) => <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTime(row.original.timestamp)}</span>,
    },
    {
      accessorKey: 'action',
      header: 'Action',
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="block truncate font-mono text-xs" title={row.original.action}>{row.original.action}</span>
          {row.original.summary ? <Badge variant="secondary">摘要</Badge> : null}
        </div>
      ),
    },
    {
      accessorKey: 'result',
      header: '结果',
      cell: ({ row }) => (
        <span className={cn(row.original.result === 'failed' && 'font-medium text-destructive')}>
          {resultFilterLabel(row.original.result)}
        </span>
      ),
    },
    { accessorKey: 'route', header: '关联路由', cell: ({ row }) => <Truncated value={row.original.route} /> },
    { accessorKey: 'userId', header: '用户', cell: ({ row }) => <Truncated value={row.original.userId} /> },
    { accessorKey: 'sessionId', header: 'Session', cell: ({ row }) => <ShortId value={row.original.sessionId} /> },
    { accessorKey: 'appVersion', header: '版本', cell: ({ row }) => row.original.appVersion ?? '-' },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => <CatalogRowActions item={row.original} label="埋点" onOpen={(item) => onOpen(item)} />,
    },
  ];
}

function errorColumns(onOpen: (item: Item) => void): ColumnDef<ErrorCatalogItem>[] {
  return [
    {
      accessorKey: 'timestamp',
      header: '时间',
      cell: ({ row }) => <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">{formatTime(row.original.timestamp)}</span>,
    },
    {
      id: 'kind',
      header: '类型',
      cell: ({ row }) => (
        <Badge variant={row.original.kind === 'business_failure' ? 'secondary' : 'destructive'}>
          {row.original.kind === 'business_failure' ? '业务失败' : '异常'}
        </Badge>
      ),
    },
    {
      accessorKey: 'message',
      header: 'Message',
      cell: ({ row }) => <Truncated value={row.original.message ?? row.original.type} />,
    },
    { id: 'handledState', header: '处理状态', cell: ({ row }) => errorStateLabel(row.original) },
    { accessorKey: 'route', header: '关联路由', cell: ({ row }) => <Truncated value={row.original.route} /> },
    { accessorKey: 'userId', header: '用户', cell: ({ row }) => <Truncated value={row.original.userId} /> },
    { accessorKey: 'sessionId', header: 'Session', cell: ({ row }) => <ShortId value={row.original.sessionId} /> },
    { accessorKey: 'appVersion', header: '版本', cell: ({ row }) => row.original.appVersion ?? '-' },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => <CatalogRowActions item={row.original} label="异常" onOpen={(item) => onOpen(item)} />,
    },
  ];
}

function DomainPreview({ mode, item, onOpen }: { mode: Mode; item?: Item; onOpen: () => void }) {
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
        { label: '关联路由', value: item.route ?? '-' },
        { label: '用户', value: item.userId ?? '-' },
        { label: '版本', value: item.appVersion ?? '-' },
        { label: '时间', value: formatDateTime(item.timestamp) },
      ] : undefined}
      ids={item ? [
        { label: 'Event', value: item.eventId },
        { label: 'Session', value: item.sessionId },
        { label: 'Trace', value: item.traceId },
      ] : undefined}
      eventId={item?.eventId}
      sessionId={item?.sessionId}
      onOpen={onOpen}
    />
  );
}

function DomainRecord({ mode, open, item, event, loading, error, items = [], onClose, onNavigate }: {
  mode: Mode;
  open: boolean;
  item?: Item;
  event?: MonitorEvent;
  loading: boolean;
  error: boolean;
  items?: Item[];
  onClose: () => void;
  onNavigate?: (item: Item) => void;
}) {
  const session = useSessionQuery(event?.sessionId);
  const related = (session.data ?? [])
    .filter((candidate) => candidate.eventId !== event?.eventId && (candidate.name === 'http.client' || readPath(candidate, ['attributes', 'business.action']) !== undefined || candidate.signalType === 'error'))
    .slice(-8);
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
        </>
      )}
    >
      {loading ? (
        <DomainRecordLoading />
      ) : error ? (
        <DomainRecordState icon={AlertCircle} title="详情加载失败" description="请检查 Monitor Service 后重试。" />
      ) : !event ? (
        <DomainRecordState icon={SearchX} title="找不到该事件" description="事件可能已超过本地保留上限。" />
      ) : (
        <Tabs key={event.eventId} defaultValue="detail" className="flex h-full min-h-0 flex-col gap-4 p-6">
          <TabsList className="w-fit shrink-0">
            <TabsTrigger value="detail">{mode === 'business' ? '属性' : '错误'}</TabsTrigger>
            <TabsTrigger value="related">关联</TabsTrigger>
            <TabsTrigger value="context">上下文</TabsTrigger>
            <TabsTrigger value="raw">Raw</TabsTrigger>
          </TabsList>
          <TabsContent value="detail" className="min-h-0 flex-1 overflow-auto"><DomainDetail mode={mode} event={event} /></TabsContent>
          <TabsContent value="related" className="min-h-0 flex-1 overflow-auto"><Related events={related} /></TabsContent>
          <TabsContent value="context" className="min-h-0 flex-1 overflow-auto"><JsonViewer value={{ resource: event.resource, context: event.context, ids: { eventId: event.eventId, sessionId: event.sessionId, traceId: event.traceId, spanId: event.spanId } }} collapsed={2} /></TabsContent>
          <TabsContent value="raw" className="min-h-0 flex-1 overflow-auto"><JsonViewer value={event} collapsed={2} /></TabsContent>
        </Tabs>
      )}
    </RecordShell>
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
      <Section title="Message" value={message} text />
      <Section title="Stack" value={stack} text />
      <Section title="Breadcrumbs" value={breadcrumbs} />
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

function CommitInput({ label, value, onCommit }: { label: string; value?: string; onCommit: (value?: string) => void }) {
  const [draft, setDraft] = useState(value ?? '');
  const debounced = useDebouncedValue(draft, 300);
  useEffect(() => setDraft(value ?? ''), [value]);
  useEffect(() => {
    const next = debounced.trim() || undefined;
    if (next !== value) onCommit(next);
  }, [debounced]);
  return (
    <Input
      aria-label={label}
      value={draft}
      placeholder={`${label} 模糊筛选，自动查询`}
      onChange={(event) => {
        setDraft(event.target.value);
        if (!event.target.value) onCommit(undefined);
      }}
      onKeyDown={(event) => event.key === 'Enter' && onCommit(draft.trim() || undefined)}
      className="min-w-[260px] flex-1"
    />
  );
}

function TriSelect({ label, value, onChange }: { label: string; value?: boolean; onChange: (value?: boolean) => void }) {
  return (
    <FilterSelect
      value={value === undefined ? undefined : String(value)}
      placeholder={`全部${label}`}
      options={[{ value: 'true', label: `${label}: ${booleanFilterLabel(true)}` }, { value: 'false', label: `${label}: ${booleanFilterLabel(false)}` }]}
      onChange={(next) => onChange(next === undefined ? undefined : next === 'true')}
      className="w-full"
    />
  );
}

function businessQuery(search: DomainSearch, page: number, size: number): BusinessCatalogQuery {
  return clean({ ...scopeQuery(search), action: search.action, result: list(search.result), limit: size, offset: (page - 1) * size });
}

function errorQuery(search: DomainSearch, page: number, size: number): ErrorCatalogQuery {
  return clean({ ...scopeQuery(search), errorType: search.errorType, mechanism: list(search.mechanism), fatal: search.fatal, handled: search.handled, businessOnly: search.businessOnly, limit: size, offset: (page - 1) * size });
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

function domainFilterLabel(key: keyof DomainSearch, value: unknown): string {
  if (key === 'action') return `Action: ${String(value)}`;
  if (key === 'result') return `结果: ${String(value).split(',').map(resultFilterLabel).join('、')}`;
  if (key === 'errorType') return `错误类型: ${String(value)}`;
  if (key === 'mechanism') return `机制: ${String(value)}`;
  if (key === 'fatal') return `致命: ${booleanFilterLabel(Boolean(value))}`;
  if (key === 'handled') return `已处理: ${booleanFilterLabel(Boolean(value))}`;
  if (key === 'businessOnly') return '仅业务失败';
  return `${String(key)}: ${String(value)}`;
}

function domainColumnClass(mode: Mode, id: string, header: boolean) {
  return cn(
    id === 'timestamp' && 'w-[176px]',
    id === 'result' && 'w-[80px]',
    id === 'kind' && 'w-[88px]',
    id === 'handledState' && 'w-[90px]',
    id === 'route' && 'w-[100px]',
    id === 'userId' && 'w-[70px]',
    id === 'sessionId' && 'w-[120px]',
    id === 'appVersion' && 'w-[60px]',
    id === 'actions' && 'w-[44px]',
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
