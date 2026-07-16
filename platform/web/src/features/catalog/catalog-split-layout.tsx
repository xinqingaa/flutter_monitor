import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

const PREVIEW_STORAGE_KEY = 'workbench.catalog.previewWidth';
const DEFAULT_PREVIEW_WIDTH = 280;
const MIN_PREVIEW_WIDTH = 220;
const MAX_PREVIEW_WIDTH = 420;

/**
 * Catalog list + preview split. Preview width is draggable on wide screens
 * and persisted in localStorage.
 */
export function CatalogSplitLayout({
  children,
  preview,
}: {
  children: ReactNode;
  preview: ReactNode;
}) {
  const previewWidth = useResizableWidth(
    PREVIEW_STORAGE_KEY,
    DEFAULT_PREVIEW_WIDTH,
    MIN_PREVIEW_WIDTH,
    MAX_PREVIEW_WIDTH,
  );

  return (
    <div
      className="grid min-h-0 flex-1 grid-cols-1 min-[1400px]:[grid-template-columns:minmax(0,1fr)_var(--catalog-preview-width)]"
      style={{ '--catalog-preview-width': `${previewWidth.width}px` } as CSSProperties}
    >
      <div className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto]">
        {children}
      </div>
      <aside className="relative hidden min-h-0 overflow-auto border-l bg-muted/20 min-[1400px]:block">
        <PreviewResizeHandle
          width={previewWidth.width}
          min={previewWidth.min}
          max={previewWidth.max}
          onResize={previewWidth.startResize}
          onNudge={previewWidth.nudge}
          onReset={previewWidth.reset}
        />
        {preview}
      </aside>
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

  return { width, min, max, startResize, nudge, reset };
}

function PreviewResizeHandle({
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
      aria-label="调整摘要栏宽度"
      aria-orientation="vertical"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(width)}
      title="拖拽调整摘要宽度，双击恢复默认"
      onPointerDown={onResize}
      onKeyDown={handleKeyDown}
      onDoubleClick={onReset}
      className="group absolute top-0 left-0 z-30 hidden h-full w-3 -translate-x-1/2 cursor-col-resize items-center justify-center outline-none min-[1400px]:flex"
    >
      <span
        aria-hidden="true"
        className="h-10 w-1 rounded-full bg-border opacity-0 transition group-hover:opacity-100 group-focus-visible:bg-ring group-focus-visible:opacity-100 group-active:bg-ring group-active:opacity-100"
      />
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
