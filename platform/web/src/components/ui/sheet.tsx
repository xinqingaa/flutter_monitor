import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type * as React from 'react';
import { cn } from '../../shared/formatting/cn';
import { IconTooltipButton } from './icon-tooltip-button';

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = 'right',
  className,
  initialFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  side?: 'left' | 'right' | 'bottom';
  className?: string;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-interactive-overlay data-[state=closed]:animate-out data-[state=open]:animate-in" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            if (!initialFocusRef?.current) return;
            event.preventDefault();
            initialFocusRef.current.focus();
          }}
          className={cn(
            'fixed z-[100] grid bg-surface shadow-xl outline-none motion-reduce:transition-none',
            side === 'right'
              ? 'inset-y-0 right-0 w-[min(720px,72vw)] grid-rows-[auto_minmax(0,1fr)] border-l border-border-default max-[900px]:w-full'
              : side === 'left'
                ? 'inset-y-0 left-0 w-[min(288px,84vw)] grid-rows-[auto_minmax(0,1fr)] border-r border-border-default'
              : 'inset-x-0 bottom-0 max-h-[92dvh] grid-rows-[auto_minmax(0,1fr)] rounded-t-lg border border-border-default',
            className,
          )}
        >
          <header className="flex min-w-0 items-start justify-between gap-3 border-b border-border-default px-4 py-3">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-[15px] font-semibold leading-6 text-text-primary">{title}</Dialog.Title>
              {description ? <Dialog.Description className="text-xs leading-[18px] text-text-secondary">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close asChild>
              <IconTooltipButton type="button" variant="ghost" size="icon" label="关闭" icon={X} />
            </Dialog.Close>
          </header>
          <div className="min-h-0 overflow-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
