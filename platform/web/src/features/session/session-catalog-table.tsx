import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { GitBranch } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { CatalogPreviewShell } from '../catalog/catalog-preview-shell';
import { CatalogRowActions } from '../catalog/catalog-row-actions';
import { CatalogTable, type CatalogState } from '../catalog/catalog-table';
import type { SessionSummary } from '../../shared/datasource/types';
import { CatalogLabels } from '../../shared/event-model/catalog-labels';
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
        header: CatalogLabels.time,
        cell: ({ row }) => (
          <span className="whitespace-nowrap font-mono text-xs text-muted-foreground" title={row.original.lastTimestamp}>
            {formatTime(row.original.lastTimestamp)}
          </span>
        ),
      },
      {
        accessorKey: 'sessionId',
        header: CatalogLabels.session,
        cell: ({ row }) => (
          <span className="block truncate font-mono text-xs" title={row.original.sessionId}>
            {row.original.sessionId}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: CatalogLabels.status,
        cell: ({ row }) => (
          <Badge variant={row.original.status === 'error' ? 'destructive' : 'secondary'}>
            {statusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        id: 'problems',
        header: CatalogLabels.problems,
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
        header: CatalogLabels.events,
        cell: ({ row }) => (
          <span className="block text-right font-mono tabular-nums">{row.original.count}</span>
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
        accessorKey: 'environment',
        header: CatalogLabels.environment,
        cell: ({ row }) => row.original.environment ?? '-',
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
      minWidthClass="min-w-[1040px]"
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
        { label: CatalogLabels.problems, value: problemCount(item) },
        { label: CatalogLabels.events, value: item.count },
        { label: CatalogLabels.route, value: item.route ?? '-' },
        { label: CatalogLabels.user, value: item.userId ?? '-' },
        { label: CatalogLabels.version, value: item.appVersion ?? '-' },
        { label: CatalogLabels.environment, value: item.environment ?? '-' },
        { label: CatalogLabels.platform, value: item.devicePlatform ?? '-' },
        { label: '起止', value: `${formatDateTime(item.firstTimestamp)} - ${formatDateTime(item.lastTimestamp)}` },
      ] : undefined}
      ids={item ? [
        { label: CatalogLabels.session, value: item.sessionId },
        { label: '最近事件', value: item.lastEventId },
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
    id === 'status' && 'w-[80px]',
    id === 'problems' && 'w-[64px] text-right',
    id === 'count' && 'w-[64px] text-right',
    id === 'route' && 'w-[120px]',
    id === 'userId' && 'w-[100px]',
    id === 'appVersion' && 'w-[72px]',
    id === 'environment' && 'w-[88px]',
    id === 'actions' && 'w-[88px]',
    !header && 'overflow-hidden',
  );
}
