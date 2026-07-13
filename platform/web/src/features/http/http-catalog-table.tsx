import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import {
  AlertCircle,
  ClipboardCopy,
  ExternalLink,
  GitBranch,
  MoreHorizontal,
  Network,
  SearchX,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '../../components/ui/empty';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { useToast } from '../../components/common/toast';
import type { HttpCatalogItem } from '../../shared/datasource/types';
import { cn } from '../../shared/formatting/cn';
import { copyText } from '../../shared/formatting/download';
import { formatDuration, formatTime } from '../../shared/formatting/format';

export type CatalogState = 'loading' | 'ready' | 'empty' | 'noResults' | 'error' | 'partial';

export function HttpCatalogTable({
  items,
  state,
  selectedId,
  fullUrl,
  slowThresholdMs,
  onSelect,
  onOpen,
  onRetry,
}: {
  items: HttpCatalogItem[];
  state: CatalogState;
  selectedId?: string;
  fullUrl: boolean;
  slowThresholdMs: number;
  onSelect: (item: HttpCatalogItem) => void;
  onOpen: (item: HttpCatalogItem) => void;
  onRetry: () => void;
}) {
  const columns = useMemo<ColumnDef<HttpCatalogItem>[]>(
    () => [
      {
        accessorKey: 'timestamp',
        header: '时间',
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground" title={row.original.timestamp}>
            {formatTime(row.original.timestamp)}
          </span>
        ),
      },
      {
        accessorKey: 'method',
        header: '方法',
        cell: ({ row }) => <span className="font-mono font-medium">{row.original.method ?? '-'}</span>,
      },
      {
        accessorKey: 'url',
        header: 'URL',
        cell: ({ row }) => (
          <span className="block truncate font-mono text-xs" title={row.original.url}>
            {displayUrl(row.original.url, fullUrl)}
          </span>
        ),
      },
      {
        accessorKey: 'statusCode',
        header: '状态码',
        cell: ({ row }) => (
          <span
            className={cn(
              'block text-right font-mono tabular-nums',
              row.original.success === false && 'font-medium text-destructive',
            )}
          >
            {row.original.statusCode ?? '-'}
          </span>
        ),
      },
      {
        accessorKey: 'businessCode',
        header: '业务码',
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums" title={businessCodeTitle(row.original)}>
            {row.original.businessCode ?? stateMark(row.original.businessCodeState)}
          </span>
        ),
      },
      {
        accessorKey: 'durationMs',
        header: '耗时',
        cell: ({ row }) => (
          <span
            className={cn(
              'block text-right font-mono tabular-nums',
              (row.original.durationMs ?? 0) >= slowThresholdMs && 'font-medium',
            )}
          >
            {formatDuration(row.original.durationMs)}
          </span>
        ),
      },
      {
        accessorKey: 'route',
        header: '关联路由',
        cell: ({ row }) => (
          <span className="block truncate" title={row.original.route}>
            {row.original.route ?? '-'}
          </span>
        ),
      },
      {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => <HttpRowActions item={row.original} onOpen={onOpen} />,
      },
    ],
    [fullUrl, onOpen, slowThresholdMs],
  );
  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (item) => item.eventId,
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      {state === 'partial' ? (
        <Alert>
          <AlertCircle />
          <AlertTitle>部分详情不可用</AlertTitle>
          <AlertDescription>SDK 已剥离部分 HTTP 详情，列表事实字段仍可查询。</AlertDescription>
        </Alert>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <Table className="min-w-[880px] table-fixed">
          <TableHeader className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className={columnClass(header.column.id, true)}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {state === 'loading' ? (
              <LoadingRows columns={columns.length} />
            ) : state === 'error' || state === 'empty' || state === 'noResults' ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-[360px] p-0">
                  <CatalogMessage state={state} onRetry={onRetry} />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  tabIndex={0}
                  data-state={row.original.eventId === selectedId ? 'selected' : undefined}
                  className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => onSelect(row.original)}
                  onDoubleClick={() => onOpen(row.original)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onOpen(row.original);
                    if (event.key === ' ') {
                      event.preventDefault();
                      onSelect(row.original);
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={columnClass(cell.column.id)}
                      onClick={cell.column.id === 'actions' ? (event) => event.stopPropagation() : undefined}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function HttpRowActions({ item, onOpen }: { item: HttpCatalogItem; onOpen: (item: HttpCatalogItem) => void }) {
  const { showToast } = useToast();
  async function copy(label: string, value?: string) {
    if (!value) return;
    try {
      await copyText(value);
      showToast({ tone: 'success', title: `已复制 ${label}` });
    } catch {
      showToast({ tone: 'danger', title: `${label} 复制失败` });
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" aria-label="HTTP 行操作">
          <MoreHorizontal data-icon="inline-start" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => onOpen(item)}>
            <ExternalLink />打开详情
          </DropdownMenuItem>
          {item.sessionId ? (
            <DropdownMenuItem asChild>
              <Link
                to="/sessions/$sessionId"
                params={{ sessionId: item.sessionId }}
                search={{ eventId: item.eventId }}
              >
                <GitBranch />查看 Session
              </Link>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => void copy('Event ID', item.eventId)}>
            <ClipboardCopy />复制 Event ID
          </DropdownMenuItem>
          {item.requestId ? (
            <DropdownMenuItem onSelect={() => void copy('Request ID', item.requestId)}>
              <ClipboardCopy />复制 Request ID
            </DropdownMenuItem>
          ) : null}
          {item.sessionId ? (
            <DropdownMenuItem onSelect={() => void copy('Session ID', item.sessionId)}>
              <ClipboardCopy />复制 Session ID
            </DropdownMenuItem>
          ) : null}
          {item.traceId ? (
            <DropdownMenuItem onSelect={() => void copy('Trace ID', item.traceId)}>
              <ClipboardCopy />复制 Trace ID
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LoadingRows({ columns }: { columns: number }) {
  return Array.from({ length: 8 }, (_, row) => (
    <TableRow key={row}>
      {Array.from({ length: columns }, (_, column) => (
        <TableCell key={column} className={columnClass(columnId(column))}>
          <Skeleton className={column === 2 ? 'h-4 w-full' : 'h-4 w-16'} />
        </TableCell>
      ))}
    </TableRow>
  ));
}

function CatalogMessage({
  state,
  onRetry,
}: {
  state: 'empty' | 'noResults' | 'error';
  onRetry: () => void;
}) {
  const content =
    state === 'empty'
      ? { title: '暂无 HTTP 请求', description: '等待应用产生网络请求。', icon: Network }
      : state === 'noResults'
        ? { title: '没有匹配结果', description: '调整或清除筛选条件。', icon: SearchX }
        : { title: 'HTTP 请求加载失败', description: '请检查 Monitor Service 后重试。', icon: AlertCircle };
  const Icon = content.icon;
  return (
    <Empty className="h-full border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Icon /></EmptyMedia>
        <EmptyTitle>{content.title}</EmptyTitle>
        <EmptyDescription>{content.description}</EmptyDescription>
        {state === 'error' ? <Button size="sm" onClick={onRetry}>重试</Button> : null}
      </EmptyHeader>
    </Empty>
  );
}

function columnClass(id: string, header = false) {
  return cn(
    id === 'timestamp' && 'w-[152px]',
    id === 'method' && 'w-[76px]',
    id === 'statusCode' && 'w-[88px] text-right',
    id === 'businessCode' && 'w-[96px] text-right',
    id === 'durationMs' && 'w-[92px] text-right',
    id === 'route' && 'w-[140px]',
    id === 'actions' && 'w-[52px]',
    !header && 'overflow-hidden',
  );
}

function columnId(index: number) {
  return ['timestamp', 'method', 'url', 'statusCode', 'businessCode', 'durationMs', 'route', 'actions'][index] ?? 'url';
}

function displayUrl(url: string | undefined, full: boolean): string {
  if (!url || full) return url ?? '-';
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function stateMark(state: HttpCatalogItem['businessCodeState']) {
  return state === 'parse_failed' ? '解析失败' : state === 'detail_unavailable' ? '详情缺失' : '-';
}

function businessCodeTitle(item: HttpCatalogItem) {
  return item.businessCode
    ?? (item.businessCodeState === 'parse_failed'
      ? '响应 body 无法解析为含顶层 code 的 JSON'
      : item.businessCodeState === 'detail_unavailable'
        ? '详情被剥离或 body 被截断'
        : '响应中没有顶层 code');
}
