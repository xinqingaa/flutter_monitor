import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { GitBranch } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { CatalogPreviewShell } from '../catalog/catalog-preview-shell';
import { CatalogRowActions } from '../catalog/catalog-row-actions';
import { CatalogTable, type CatalogState } from '../catalog/catalog-table';
import type { SessionSummary } from '../../shared/datasource/types';
import { statusLabel } from '../../shared/event-model/status';
import { cn } from '../../shared/formatting/cn';
import { formatDateTime, formatTime } from '../../shared/formatting/format';

export type { CatalogState };

export function SessionCatalogTable({
  items,
  state,
  selectedId,
  onSelect,
  onOpen,
  onPeek,
  onRetry,
}: {
  items: SessionSummary[];
  state: CatalogState;
  selectedId?: string;
  onSelect: (item: SessionSummary) => void;
  onOpen: (item: SessionSummary) => void;
  onPeek: (item: SessionSummary) => void;
  onRetry: () => void;
}) {
  const columns = useMemo<ColumnDef<SessionSummary>[]>(
    () => [
      {
        accessorKey: 'lastTimestamp',
        header: '时间',
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-xs text-muted-foreground" title={row.original.lastTimestamp}>
            {formatTime(row.original.lastTimestamp)}
          </span>
        ),
      },
      {
        accessorKey: 'sessionId',
        header: 'Session',
        cell: ({ row }) => (
          <span className="block truncate font-mono text-xs" title={row.original.sessionId}>
            {row.original.sessionId}
          </span>
        ),
      },
      {
        accessorKey: 'userId',
        header: '用户',
        cell: ({ row }) => (
          <span className="block truncate font-mono text-xs" title={row.original.userId}>
            {row.original.userId ?? '-'}
          </span>
        ),
      },
      {
        accessorKey: 'route',
        header: '路由',
        cell: ({ row }) => (
          <span className="block truncate" title={row.original.route}>
            {row.original.route ?? '-'}
          </span>
        ),
      },
      {
        accessorKey: 'appVersion',
        header: '版本',
        cell: ({ row }) => row.original.appVersion ?? '-',
      },
      {
        accessorKey: 'status',
        header: '状态',
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'error' ? 'destructive' : 'secondary'}>
            {statusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        id: 'problems',
        header: '问题',
        cell: ({ row }) => {
          const count = problemCount(row.original);
          return (
            <span className={cn('block text-right font-mono tabular-nums', count > 0 && 'font-medium text-destructive')}>
              {count}
            </span>
          );
        },
      },
      {
        accessorKey: 'count',
        header: '事件',
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums">{row.original.count}</span>
        ),
      },
      {
        id: 'actions',
        enableHiding: false,
        cell: ({ row }) => (
          <CatalogRowActions
            item={{ sessionId: row.original.sessionId, eventId: row.original.lastEventId }}
            label="Session"
            showSessionLink={false}
            onOpen={() => onOpen(row.original)}
            onPeek={() => onPeek(row.original)}
          />
        ),
      },
    ],
    [onOpen, onPeek],
  );

  return (
    <CatalogTable
      items={items}
      columns={columns}
      state={state}
      selectedId={selectedId}
      getRowId={(item) => item.sessionId}
      minWidthClass="min-w-[960px]"
      message={{
        emptyTitle: '暂无 Session',
        emptyDescription: '运行 example 后，本地会话会出现在这里。',
        emptyIcon: GitBranch,
        errorTitle: 'Session 加载失败',
        errorDescription: '请检查 Monitor Service 后重试。',
      }}
      onSelect={onSelect}
      onOpen={onOpen}
      onRetry={onRetry}
      columnClassName={columnClass}
      skeletonClassName={(id) => id === 'sessionId' ? 'h-4 w-full' : 'h-4 w-16'}
    />
  );
}

export function SessionPreviewPane({
  item,
  loading,
  error,
  onOpen,
  onPeek,
}: {
  item?: SessionSummary;
  loading?: boolean;
  error?: boolean;
  onOpen: () => void;
  onPeek: () => void;
}) {
  return (
    <CatalogPreviewShell
      selected={Boolean(item)}
      loading={loading}
      error={error}
      emptyDescription="从 Session 表格中选择一条记录。"
      showSessionLink={false}
      header={item ? (
        <div className="flex min-w-0 flex-col gap-2">
          <Badge className="w-fit" variant={item.status === 'error' ? 'destructive' : 'secondary'}>
            {statusLabel(item.status)}
          </Badge>
          <p className="break-all font-mono text-sm font-medium leading-6">{item.sessionId}</p>
        </div>
      ) : undefined}
      facts={item ? [
        { label: '用户', value: item.userId ?? '-' },
        { label: '版本', value: item.appVersion ?? '-' },
        { label: '环境', value: item.environment ?? '-' },
        { label: '平台', value: item.devicePlatform ?? '-' },
        { label: '路由', value: item.route ?? '-' },
        { label: '问题', value: problemCount(item) },
        { label: '事件数', value: item.count },
        { label: '起止', value: `${formatDateTime(item.firstTimestamp)} - ${formatDateTime(item.lastTimestamp)}` },
      ] : undefined}
      ids={item ? [
        { label: 'Session', value: item.sessionId },
        { label: 'Last Event', value: item.lastEventId },
      ] : undefined}
      onOpen={onOpen}
      onPeek={onPeek}
    />
  );
}

export function problemCount(session: SessionSummary) {
  return session.errorCount + session.failedHttpCount + (session.businessFailureCount ?? 0);
}

function columnClass(id: string, header: boolean) {
  return cn(
    id === 'lastTimestamp' && 'w-[176px]',
    id === 'userId' && 'w-[100px]',
    id === 'route' && 'w-[120px]',
    id === 'appVersion' && 'w-[72px]',
    id === 'status' && 'w-[80px]',
    id === 'problems' && 'w-[64px] text-right',
    id === 'count' && 'w-[64px] text-right',
    id === 'actions' && 'w-[88px]',
    !header && 'overflow-hidden',
  );
}
