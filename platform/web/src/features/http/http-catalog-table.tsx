import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertCircle, Network } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { CatalogRowActions } from '../catalog/catalog-row-actions';
import {
  CatalogTable,
  type CatalogState,
} from '../catalog/catalog-table';
import type { HttpCatalogItem } from '../../shared/datasource/types';
import { cn } from '../../shared/formatting/cn';
import { formatDuration, formatTime } from '../../shared/formatting/format';

export type { CatalogState } from '../catalog/catalog-table';

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
        cell: ({ row }) => (
          <CatalogRowActions
            item={row.original}
            label="HTTP "
            copyItems={[{ label: 'Request ID', value: row.original.requestId }]}
            onOpen={onOpen}
          />
        ),
      },
    ],
    [fullUrl, onOpen, slowThresholdMs],
  );

  return (
    <CatalogTable
      items={items}
      columns={columns}
      state={state}
      selectedId={selectedId}
      minWidthClass="min-w-[880px]"
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
      onSelect={onSelect}
      onOpen={onOpen}
      onRetry={onRetry}
      columnClassName={columnClass}
      skeletonClassName={(id) => id === 'url' ? 'h-4 w-full' : 'h-4 w-16'}
    />
  );
}

function columnClass(id: string, header: boolean) {
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
