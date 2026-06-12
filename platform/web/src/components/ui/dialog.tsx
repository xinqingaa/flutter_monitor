import type * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../shared/formatting/cn';
import { IconTooltipButton } from './icon-tooltip-button';

export function Dialog({
  open,
  title,
  description,
  children,
  onClose,
  className,
}: {
  open: boolean;
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
}) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/30 p-4" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn('grid max-h-[86vh] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl', className)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex min-w-0 items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-zinc-950">{title}</h2>
            {description ? <p className="mt-0.5 text-xs text-zinc-500">{description}</p> : null}
          </div>
          <IconTooltipButton type="button" variant="ghost" size="icon" label="关闭" icon={X} onClick={onClose} />
        </header>
        <div className="min-h-0 overflow-hidden p-3">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
