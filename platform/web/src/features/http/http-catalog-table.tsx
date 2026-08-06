import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertCircle, Network } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { CatalogRowActions } from '../catalog/catalog-row-actions';
import {
  CatalogTable,
  type CatalogState,
} from '../catalog/catalog-table';
import { SortableHeader } from '../catalog/sortable-header';
import type { HttpCatalogItem } from '../../shared/datasource/types';
import { CatalogLabels } from '../../shared/event-model/catalog-labels';
import { cn } from '../../shared/formatting/cn';
import { formatDuration, formatTime } from '../../shared/formatting/format';

export type { CatalogState } from '../catalog/catalog-table';

export function HttpCatalogTable({
  items,
  state,
  selectedId,
  fullUrl,
  slowThresholdMs,
  sortBy,
  sortDir,
  onSort,
  onOpen,
  onPeek,
  onRetry,
}: {
  items: HttpCatalogItem[];
  state: CatalogState;
  selectedId?: string;
  fullUrl: boolean;
  slowThresholdMs: number;
  sortBy: 'timestamp' | 'durationMs';
  sortDir: 'asc' | 'desc';
  onSort: (sortBy: 'timestamp' | 'durationMs') => void;
  onOpen: (item: HttpCatalogItem) => void;
  onPeek: (item: HttpCatalogItem) => void;
  onRetry: () => void;
}) {
  const columns = useMemo<ColumnDef<HttpCatalogItem>[]>(
    () => [
      {
        accessorKey: 'timestamp',
        header: () => (
          <SortableHeader
            label={CatalogLabels.time}
            active={sortBy === 'timestamp'}
            direction={sortDir}
            onClick={() => onSort('timestamp')}
          />
        ),
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-xs text-muted-foreground" title={row.original.timestamp}>
            {formatTime(row.original.timestamp)}
          </span>
        ),
      },
      {
        accessorKey: 'method',
        header: CatalogLabels.method,
        cell: ({ row }) => <span className="font-mono font-medium">{row.original.method ?? '-'}</span>,
      },
      {
        accessorKey: 'url',
        header: CatalogLabels.url,
        cell: ({ row }) => (
          <span className="block truncate font-mono text-xs" title={row.original.url}>
            {displayUrl(row.original.url, fullUrl)}
          </span>
        ),
      },
      {
        accessorKey: 'statusCode',
        header: CatalogLabels.statusCode,
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
        header: CatalogLabels.businessCode,
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums" title={businessCodeTitle(row.original)}>
            {row.original.businessCode ?? stateMark(row.original.businessCodeState)}
          </span>
        ),
      },
      {
        accessorKey: 'durationMs',
        header: () => (
          <div className="flex justify-end">
            <SortableHeader
              label={CatalogLabels.duration}
              active={sortBy === 'durationMs'}
              direction={sortDir}
              align="right"
              onClick={() => onSort('durationMs')}
            />
          </div>
        ),
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
        accessorKey: 'requestId',
        header: CatalogLabels.requestId,
        cell: ({ row }) => (
          <span className="block truncate font-mono text-xs" title={row.original.requestId}>
            {row.original.requestId ?? '-'}
          </span>
        ),
      },
      {
        accessorKey: 'route',
        header: CatalogLabels.route,
        cell: ({ row }) => (
          <span className="block truncate" title={row.original.route}>
            {row.original.route ?? '-'}
          </span>
        ),
      },
      {
        accessorKey: 'environment',
        header: CatalogLabels.environment,
        cell: ({ row }) => row.original.environment ?? '-',
      },
      {
        accessorKey: 'userId',
        header: CatalogLabels.user,
        cell: ({ row }) => (
          <span className="block truncate font-mono text-xs" title={row.original.userId}>
            {row.original.userId ?? '-'}
          </span>
        ),
      },
      {
        accessorKey: 'appVersion',
        header: CatalogLabels.version,
        cell: ({ row }) => row.original.appVersion ?? '-',
      },
      {
        accessorKey: 'sessionId',
        header: CatalogLabels.session,
        cell: ({ row }) => (
          <span className="block truncate font-mono text-xs" title={row.original.sessionId}>
            {row.original.sessionId ?? '-'}
          </span>
        ),
      },
      {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => (
          <CatalogRowActions
            item={row.original}
            label="HTTP"
            copyItems={[{ label: CatalogLabels.requestId, value: row.original.requestId }]}
            onOpen={onOpen}
            onPeek={onPeek}
          />
        ),
      },
    ],
    [fullUrl, onOpen, onPeek, onSort, slowThresholdMs, sortBy, sortDir],
  );

  return (
    <CatalogTable
      items={items}
      columns={columns}
      state={state}
      selectedId={selectedId}
      getRowId={(item) => item.eventId}
      minWidthClass="min-w-[1560px]"
      message={{
        emptyTitle: '暂无 HTTP 请求',
        emptyDescription: '等待应用产生网络请求。',
        emptyIcon: Network,
        errorTitle: 'HTTP 请求加载失败',
        errorDescription: '请检查 Monitor Service 后重试。',
      }}
      notice={state === 'partial' ? (
        <Alert>
          <AlertCircle />
          <AlertTitle>部分详情不可用</AlertTitle>
          <AlertDescription>SDK 已剥离部分 HTTP 详情，列表事实字段仍可查询。</AlertDescription>
        </Alert>
      ) : undefined}
      onOpen={onOpen}
      onRetry={onRetry}
      columnClassName={columnClass}
      skeletonClassName={(id) => id === 'url' ? 'h-4 w-full' : 'h-4 w-16'}
    />
  );
}

function columnClass(id: string, header: boolean) {
  return cn(
    id === 'timestamp' && 'w-[176px]',
    id === 'method' && 'w-[76px]',
    id === 'url' && 'w-[360px]',
    id === 'statusCode' && 'w-[88px] text-right',
    id === 'businessCode' && 'w-[96px] text-right',
    id === 'durationMs' && 'w-[108px] text-right',
    id === 'requestId' && 'w-[140px]',
    id === 'route' && 'w-[120px]',
    id === 'environment' && 'w-[88px]',
    id === 'userId' && 'w-[100px]',
    id === 'appVersion' && 'w-[72px]',
    id === 'sessionId' && 'w-[120px]',
    id === 'actions' && 'w-[88px]',
    !header && 'overflow-hidden',
  );
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
  return state === 'parse_failed' ? '?' : state === 'detail_unavailable' ? '…' : '-';
}

function businessCodeTitle(item: HttpCatalogItem) {
  return item.businessCode
    ?? (item.businessCodeState === 'parse_failed'
      ? '业务码解析失败'
      : item.businessCodeState === 'detail_unavailable'
        ? '详情不可用'
        : undefined);
}
