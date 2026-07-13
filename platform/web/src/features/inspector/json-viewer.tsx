import JsonView from '@uiw/react-json-view';
import { lightTheme } from '@uiw/react-json-view/light';
import { vscodeTheme } from '@uiw/react-json-view/vscode';
import { Clipboard } from 'lucide-react';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from '../../components/ui/button';
import { useToast } from '../../components/common/toast';
import { cn } from '../../shared/formatting/cn';
import { copyJson, copyText } from '../../shared/formatting/download';

export type JsonViewerTheme = 'light' | 'dark';

export interface JsonViewerProps {
  value: unknown;
  className?: string;
  collapsed?: boolean | number;
  enableClipboard?: boolean;
  displayDataTypes?: boolean;
  displayObjectSize?: boolean;
  showControls?: boolean;
  rawText?: string;
  /** 强制 theme，不读取持久化偏好。 */
  theme?: JsonViewerTheme;
}

export function JsonViewer({
  value,
  className = '',
  collapsed: collapsedProp = 2,
  enableClipboard = true,
  displayDataTypes = false,
  displayObjectSize = true,
  showControls = true,
  rawText: rawTextProp,
  theme = 'light',
}: JsonViewerProps) {
  const [collapsed, setCollapsed] = useState<boolean | number>(collapsedProp);
  const [mode, setMode] = useState<'formatted' | 'raw'>('formatted');
  const { showToast } = useToast();

  const safeValue = useMemo(() => normalize(value), [value]);
  const rawText = useMemo(
    () => rawTextProp ?? stringifyRaw(safeValue),
    [rawTextProp, safeValue],
  );
  const isObject = safeValue !== null && typeof safeValue === 'object';

  const isDark = theme === 'dark';
  const themeStyle = isDark ? vscodeTheme : lightTheme;
  const showFormatted = mode === 'formatted';

  async function copyCurrentView() {
    try {
      if (showFormatted && isObject) await copyJson(safeValue);
      else await copyText(rawText);
      showToast({ tone: 'success', title: '已复制 JSON' });
    } catch {
      showToast({ tone: 'danger', title: '复制失败', description: '浏览器拒绝了剪贴板写入。' });
    }
  }

  return (
    <div
      className={cn(
        'grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-md border',
        isDark ? 'border-zinc-800 bg-[#1e1e1e]' : 'border-zinc-200 bg-white',
        className,
      )}
    >
      {showControls ? (
        <div
          className={cn(
            'flex items-center gap-1 border-b px-2 py-1 text-[11px]',
            isDark ? 'border-zinc-800 bg-zinc-900 text-zinc-300' : 'border-zinc-200 bg-zinc-50 text-zinc-600',
          )}
        >
          <ViewToggleButton
            label="格式化"
            active={mode === 'formatted'}
            isDark={isDark}
            onClick={() => setMode('formatted')}
          />
          <ViewToggleButton
            label="原文"
            active={mode === 'raw'}
            isDark={isDark}
            onClick={() => setMode('raw')}
          />
          <span className="ml-auto flex items-center gap-1">
            {isObject && showFormatted ? (
              <>
                <ControlButton isDark={isDark} onClick={() => setCollapsed(false)}>展开</ControlButton>
                <ControlButton isDark={isDark} onClick={() => setCollapsed(true)}>收起</ControlButton>
              </>
            ) : null}
            <ControlButton isDark={isDark} onClick={() => void copyCurrentView()} ariaLabel="复制 JSON">
              <Clipboard className="size-3.5" />
            </ControlButton>
          </span>
        </div>
      ) : null}
      <div className="min-h-0 overflow-auto p-3 text-xs leading-relaxed">
        {isObject && showFormatted ? (
          <JsonView
            value={safeValue as object}
            style={themeStyle as CSSProperties}
            collapsed={collapsed}
            displayObjectSize={displayObjectSize}
            displayDataTypes={displayDataTypes}
            enableClipboard={enableClipboard}
            shortenTextAfterLength={120}
            indentWidth={18}
          />
        ) : (
          <pre className={isDark ? 'text-zinc-100' : 'text-zinc-800'}>{rawText}</pre>
        )}
      </div>
    </div>
  );
}

function ViewToggleButton({
  label,
  active,
  isDark,
  onClick,
}: {
  label: string;
  active: boolean;
  isDark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-5 min-w-[42px] items-center justify-center rounded px-1.5 text-[11px] tabular-nums transition-colors',
        active
          ? isDark
            ? 'bg-zinc-700 text-zinc-50'
            : 'bg-zinc-900 text-white'
          : isDark
            ? 'text-zinc-300 hover:bg-zinc-800'
            : 'text-zinc-600 hover:bg-zinc-200',
      )}
    >
      {label}
    </button>
  );
}

function ControlButton({
  children,
  onClick,
  isDark,
  ariaLabel,
}: {
  children: ReactNode;
  onClick: () => void;
  isDark: boolean;
  ariaLabel?: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cn(
        'h-6 px-2 text-[11px]',
        isDark
          ? 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
          : 'text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900',
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function normalize(value: unknown): unknown {
  if (value === undefined) return null;
  return value;
}

function stringifyRaw(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
