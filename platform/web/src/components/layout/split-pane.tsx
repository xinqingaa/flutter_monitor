import { GripVertical, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type * as React from 'react';
import { IconTooltipButton } from '../common/icon-tooltip-button';
import { cn } from '../../shared/formatting/cn';

const DEFAULT_STORAGE_KEY = 'flutter-monitor.split-pane.preview-width';

export function SplitPane({
  primary,
  secondary,
  defaultSize = 360,
  minSize = 320,
  maxSize = 480,
  storageKey = DEFAULT_STORAGE_KEY,
  collapseBelow = 1024,
  className,
}: {
  primary: React.ReactNode;
  secondary: React.ReactNode;
  defaultSize?: number;
  minSize?: number;
  maxSize?: number;
  storageKey?: string;
  collapseBelow?: number;
  className?: string;
}) {
  const [size, setSize] = useState(() => readStoredSize(storageKey, defaultSize, minSize, maxSize));
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < collapseBelow);
  const dragStart = useRef<{ x: number; size: number } | undefined>(undefined);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${collapseBelow - 1}px)`);
    const update = () => setCollapsed(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [collapseBelow]);

  const stopDragging = useCallback(() => {
    dragStart.current = undefined;
    document.body.style.removeProperty('cursor');
    document.body.style.removeProperty('user-select');
  }, []);

  useEffect(() => {
    function move(event: PointerEvent) {
      if (!dragStart.current) return;
      const next = clamp(dragStart.current.size + dragStart.current.x - event.clientX, minSize, maxSize);
      setSize(next);
      localStorage.setItem(storageKey, String(next));
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stopDragging);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', stopDragging);
    };
  }, [maxSize, minSize, stopDragging, storageKey]);

  function reset() {
    setSize(defaultSize);
    localStorage.removeItem(storageKey);
  }

  return (
    <div className={cn('flex min-h-0 min-w-0 flex-1 overflow-hidden', className)}>
      <div className="min-w-[640px] flex-1 overflow-auto max-[1023px]:min-w-0">{primary}</div>
      {collapsed ? null : (
        <>
          <div
            role="separator"
            aria-label="调整摘要面板宽度"
            aria-orientation="vertical"
            aria-valuemin={minSize}
            aria-valuemax={maxSize}
            aria-valuenow={size}
            tabIndex={0}
            className="group relative w-2 shrink-0 cursor-col-resize border-x border-border-default bg-subtle outline-none focus-visible:ring-2 focus-visible:ring-interactive-focusRing"
            onPointerDown={(event) => {
              dragStart.current = { x: event.clientX, size };
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
            }}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              const next = clamp(size + (event.key === 'ArrowLeft' ? 16 : -16), minSize, maxSize);
              setSize(next);
              localStorage.setItem(storageKey, String(next));
            }}
          >
            <GripVertical className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 text-text-muted" />
          </div>
          <aside className="relative shrink-0 overflow-auto border-l border-border-default bg-surface" style={{ width: size }}>
            <div className="absolute right-2 top-2 z-10">
              <IconTooltipButton type="button" size="icon" variant="ghost" label="恢复默认宽度" icon={RotateCcw} onClick={reset} />
            </div>
            {secondary}
          </aside>
        </>
      )}
    </div>
  );
}

function readStoredSize(key: string, fallback: number, min: number, max: number): number {
  if (typeof window === 'undefined') return fallback;
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
