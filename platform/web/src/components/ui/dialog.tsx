import { useEffect } from 'react';
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
  headerExtra,
  contentClassName,
}: {
  open: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  className?: string;
  headerExtra?: React.ReactNode;
  contentClassName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/30 p-4" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn('grid max-h-[86vh] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl', className)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex min-w-0 items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="min-w-0">
            {typeof title === 'string' ? (
              <h2 className="truncate text-base font-semibold text-zinc-950">{title}</h2>
            ) : title}
            {description ? (
              typeof description === 'string'
                ? <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
                : <div className="mt-0.5">{description}</div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {headerExtra}
            <IconTooltipButton type="button" variant="ghost" size="icon" label="关闭 (Esc)" icon={X} onClick={onClose} />
          </div>
        </header>
        <div className={cn('min-h-0 overflow-hidden p-3', contentClassName)}>{children}</div>
      </section>
    </div>,
    document.body,
  );
}
