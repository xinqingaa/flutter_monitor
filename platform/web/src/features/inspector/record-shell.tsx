import type * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet';

export type RecordShellState = 'loading' | 'ready' | 'notFound' | 'partial' | 'error';

export function RecordShell({
  open,
  onOpenChange,
  title,
  description,
  summary,
  state,
  children,
  initialFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  summary?: React.ReactNode;
  state: RecordShellState;
  children?: React.ReactNode;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
        onOpenAutoFocus={(event) => {
          if (!initialFocusRef?.current) return;
          event.preventDefault();
          initialFocusRef.current.focus();
        }}
      >
        <SheetHeader className="border-b px-6 py-4 text-left">
          <SheetTitle className="pr-8">{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        {summary ? <div className="border-b px-6 py-4">{summary}</div> : null}
        <div data-state={state} className="min-h-0 flex-1 overflow-hidden">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}
