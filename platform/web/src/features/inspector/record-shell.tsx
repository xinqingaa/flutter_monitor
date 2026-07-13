import type * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet';
import { cn } from '../../shared/formatting/cn';

export type RecordShellState = 'loading' | 'ready' | 'notFound' | 'partial' | 'error';

export function RecordShell({
  open,
  onOpenChange,
  title,
  description,
  summary,
  headerActions,
  state,
  children,
  initialFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  summary?: React.ReactNode;
  headerActions?: React.ReactNode;
  state: RecordShellState;
  children?: React.ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          'flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl',
        )}
        onOpenAutoFocus={(event) => {
          if (!initialFocusRef?.current) return;
          event.preventDefault();
          initialFocusRef.current.focus();
        }}
      >
        <SheetHeader className="border-b px-6 py-4 text-left">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="min-w-0 flex-1">
              <SheetTitle>{title}</SheetTitle>
              {description ? <SheetDescription>{description}</SheetDescription> : null}
            </div>
            {headerActions ? <div className="flex shrink-0 items-center gap-1">{headerActions}</div> : null}
          </div>
        </SheetHeader>
        {summary ? <div className="border-b px-6 py-4">{summary}</div> : null}
        <div data-state={state} className="min-h-0 flex-1 overflow-hidden">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
