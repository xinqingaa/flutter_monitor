import {
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { cn } from '../../shared/formatting/cn';

const PREVIEW_BREAKPOINT = 1400;
const STORAGE_KEY = 'workbench.catalog.previewWidth';
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 220;
const MAX_WIDTH = 520;

/**
 * Catalog list + Preview split with pixel-based drag resize (same model as Session detail).
 * Avoids react-resizable-panels height collapse inside flex column shells.
 */
export function CatalogSplitLayout({
  main,
  preview,
}: {
  main: ReactNode;
  preview: ReactNode;
}) {
  const wide = useMinWidth(PREVIEW_BREAKPOINT);
  const previewWidth = useResizableWidth(STORAGE_KEY, DEFAULT_WIDTH, MIN_WIDTH, MAX_WIDTH);

  if (!wide) {
    return <div className="min-h-0 flex-1 overflow-hidden">{main}</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{main}</div>
      <CatalogResizeHandle
        width={previewWidth.width}
        min={previewWidth.min}
        max={previewWidth.max}
        onResize={previewWidth.startResize}
        onNudge={previewWidth.nudge}
        onReset={previewWidth.reset}
      />
      <aside
        className="min-h-0 shrink-0 overflow-auto border-l bg-muted/20"
        style={{ width: previewWidth.width }}
      >
        {preview}
      </aside>
    </div>
  );
}

function CatalogResizeHandle({
  width,
  min,
  max,
  onResize,
  onNudge,
  onReset,
}: {
  width: number;
  min: number;
  max: number;
  onResize: (event: ReactPointerEvent<HTMLElement>) => void;
  onNudge: (delta: number) => void;
  onReset: () => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onNudge(16);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      onNudge(-16);
    } else if (event.key === 'Home') {
      event.preventDefault();
      onNudge(max - width);
    } else if (event.key === 'End') {
      event.preventDefault();
      onNudge(min - width);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onReset();
    }
  }

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label="调整 Preview 宽度"
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(width)}
      className={cn(
        'group relative z-10 w-1.5 shrink-0 cursor-col-resize bg-border/80',
        'hover:bg-ring/50 focus-visible:bg-ring/60 focus-visible:outline-none',
      )}
      onPointerDown={onResize}
      onKeyDown={handleKeyDown}
      onDoubleClick={onReset}
    >
      <span className="pointer-events-none absolute inset-y-0 left-1/2 w-3 -translate-x-1/2" />
    </div>
  );
}

function useResizableWidth(storageKey: string, defaultWidth: number, min: number, max: number) {
  const [width, setWidth] = useState(defaultWidth);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return;
    const parsed = Number(stored);
    if (Number.isFinite(parsed)) setWidth(clamp(parsed, min, max));
  }, [max, min, storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, String(width));
  }, [storageKey, width]);

  const setClampedWidth = useCallback((next: number) => {
    setWidth(clamp(next, min, max));
  }, [max, min]);

  const startResize = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;

    function handleMove(moveEvent: PointerEvent) {
      // Preview is on the right: drag left → wider, drag right → narrower.
      setClampedWidth(startWidth + (startX - moveEvent.clientX));
    }

    function handleUp() {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }, [setClampedWidth, width]);

  const nudge = useCallback((delta: number) => {
    setClampedWidth(width + delta);
  }, [setClampedWidth, width]);

  const reset = useCallback(() => {
    setWidth(defaultWidth);
  }, [defaultWidth]);

  return {
    width,
    min,
    max,
    startResize,
    nudge,
    reset,
  };
}

function useMinWidth(px: number) {
  const [matches, setMatches] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia(`(min-width: ${px}px)`).matches : false
  ));

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${px}px)`);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [px]);

  return matches;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
