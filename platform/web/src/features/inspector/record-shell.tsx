import type * as React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../components/ui/sheet';

export type RecordShellState = 'loading' | 'ready' | 'notFound' | 'partial' | 'error';

export function RecordShell({
  open,
  onOpenChange,
  title,
  summary,
  state,
  children,
  initialFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  summary?: React.ReactNode;
  state: RecordShellState;
  children?: React.ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="grid h-full w-full grid-rows-[auto_minmax(0,1fr)] gap-0 p-0 sm:max-w-2xl" onOpenAutoFocus={(event) => { if (!initialFocusRef?.current) return; event.preventDefault(); initialFocusRef.current.focus(); }}>
        <SheetHeader className="border-b px-6 py-4"><SheetTitle className="pr-8">{title}</SheetTitle></SheetHeader>
        <div data-state={state} className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          {summary ? <section className="border-b p-4">{summary}</section> : null}
          <section className="min-h-0 overflow-hidden p-4">{children}</section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
