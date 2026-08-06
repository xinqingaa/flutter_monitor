import type { ComponentType, ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { AlertCircle, SearchX } from 'lucide-react';
import { Button } from '../../components/ui/button';
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
import { cn } from '../../shared/formatting/cn';

export type CatalogState = 'loading' | 'ready' | 'empty' | 'noResults' | 'error' | 'partial';

export interface CatalogMessageContent {
  emptyTitle: string;
  emptyDescription: string;
  emptyIcon: ComponentType;
  errorTitle: string;
  errorDescription: string;
}

export function CatalogTable<T>({
  items,
  columns,
  state,
  selectedId,
  getRowId,
  minWidthClass,
  message,
  notice,
  onOpen,
  onRetry,
  columnClassName,
  skeletonClassName,
}: {
  items: T[];
  columns: ColumnDef<T>[];
  state: CatalogState;
  selectedId?: string;
  getRowId: (item: T) => string;
  minWidthClass: string;
  message: CatalogMessageContent;
  notice?: ReactNode;
  onOpen: (item: T) => void;
  onRetry: () => void;
  columnClassName?: (columnId: string, header: boolean) => string | undefined;
  skeletonClassName?: (columnId: string) => string | undefined;
}) {
  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (item) => getRowId(item),
  });
  const leafColumns = table.getAllLeafColumns();

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 p-4">
      {notice}
      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <Table className={cn('table-fixed', minWidthClass)} containerClassName="overflow-visible">
          <TableHeader className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      columnClassName?.(header.column.id, true),
                      stickyActionsClass(header.column.id, true),
                    )}
                  >
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
              <LoadingRows
                columnIds={leafColumns.map((column) => column.id)}
                columnClassName={columnClassName}
                skeletonClassName={skeletonClassName}
              />
            ) : state === 'error' || state === 'empty' || state === 'noResults' ? (
              <TableRow>
                <TableCell colSpan={leafColumns.length} className="h-[360px] p-0">
                  <CatalogMessage state={state} content={message} onRetry={onRetry} />
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  tabIndex={0}
                  data-state={getRowId(row.original) === selectedId ? 'selected' : undefined}
                  className="group cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => onOpen(row.original)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onOpen(row.original);
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'overflow-hidden',
                        columnClassName?.(cell.column.id, false),
                        stickyActionsClass(cell.column.id, false),
                      )}
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

function stickyActionsClass(columnId: string, header: boolean) {
  if (columnId !== 'actions') return undefined;
  return cn(
    'sticky right-0 border-l border-border shadow-[-6px_0_8px_-6px_rgba(0,0,0,0.08)]',
    header
      ? 'z-20 bg-background'
      : 'z-10 bg-background group-hover:bg-muted/50 group-data-[state=selected]:bg-muted',
  );
}

function LoadingRows({
  columnIds,
  columnClassName,
  skeletonClassName,
}: {
  columnIds: string[];
  columnClassName?: (columnId: string, header: boolean) => string | undefined;
  skeletonClassName?: (columnId: string) => string | undefined;
}) {
  return Array.from({ length: 8 }, (_, row) => (
    <TableRow key={row}>
      {columnIds.map((columnId) => (
        <TableCell
          key={columnId}
          className={cn(columnClassName?.(columnId, false), stickyActionsClass(columnId, false))}
        >
          <Skeleton className={skeletonClassName?.(columnId) ?? 'h-4 w-16'} />
        </TableCell>
      ))}
    </TableRow>
  ));
}

function CatalogMessage({
  state,
  content,
  onRetry,
}: {
  state: 'empty' | 'noResults' | 'error';
  content: CatalogMessageContent;
  onRetry: () => void;
}) {
  const value = state === 'empty'
    ? { title: content.emptyTitle, description: content.emptyDescription, icon: content.emptyIcon }
    : state === 'noResults'
      ? { title: '没有匹配结果', description: '调整或清除筛选条件。', icon: SearchX }
      : { title: content.errorTitle, description: content.errorDescription, icon: AlertCircle };
  const Icon = value.icon;

  return (
    <Empty className="h-full border-0">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Icon /></EmptyMedia>
        <EmptyTitle>{value.title}</EmptyTitle>
        <EmptyDescription>{value.description}</EmptyDescription>
        {state === 'error' ? <Button size="sm" onClick={onRetry}>重试</Button> : null}
      </EmptyHeader>
    </Empty>
  );
}
