import type * as React from 'react';
import { Sheet } from '../../components/ui/sheet';

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
    <Sheet open={open} onOpenChange={onOpenChange} title={title} initialFocusRef={initialFocusRef}>
      <div data-state={state} className="grid min-h-full grid-rows-[auto_minmax(0,1fr)]">
        {summary ? <section className="border-b border-border-default p-3">{summary}</section> : null}
        <section className="min-h-0 p-3">{children}</section>
      </div>
    </Sheet>
  );
}
