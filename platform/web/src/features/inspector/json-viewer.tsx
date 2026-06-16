import JsonView from '@uiw/react-json-view';
import { lightTheme } from '@uiw/react-json-view/light';
import { vscodeTheme } from '@uiw/react-json-view/vscode';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Button } from '../../components/ui/button';
import { cn } from '../../shared/formatting/cn';

export type JsonViewerTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'fm.json-viewer.theme';

export interface JsonViewerProps {
  value: unknown;
  className?: string;
  collapsed?: boolean | number;
  enableClipboard?: boolean;
  displayDataTypes?: boolean;
  displayObjectSize?: boolean;
  showControls?: boolean;
  /** 强制 theme，不读取持久化偏好。 */
  theme?: JsonViewerTheme;
}

export function readStoredTheme(): JsonViewerTheme {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // ignore
  }
  return 'light';
}

export function persistTheme(theme: JsonViewerTheme): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export function JsonViewer({
  value,
  className = '',
  collapsed: collapsedProp = 2,
  enableClipboard = true,
  displayDataTypes = false,
  displayObjectSize = true,
  showControls = true,
  theme,
}: JsonViewerProps) {
  const [collapsed, setCollapsed] = useState<boolean | number>(collapsedProp);
  const [storedTheme, setStoredTheme] = useState<JsonViewerTheme>(() => theme ?? readStoredTheme());

  useEffect(() => {
    if (theme) setStoredTheme(theme);
  }, [theme]);

  const activeTheme: JsonViewerTheme = theme ?? storedTheme;

  const safeValue = useMemo(() => normalize(value), [value]);
  const isObject = safeValue !== null && typeof safeValue === 'object';

  const handleThemeChange = (next: JsonViewerTheme) => {
    if (theme) return; // controlled externally
    setStoredTheme(next);
    persistTheme(next);
  };

  const isDark = activeTheme === 'dark';
  const themeStyle = isDark ? vscodeTheme : lightTheme;

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
          <span className="text-[11px] text-zinc-400">主题</span>
          <ThemeToggleButton
            label="亮"
            active={activeTheme === 'light'}
            disabled={!!theme}
            isDark={isDark}
            onClick={() => handleThemeChange('light')}
          />
          <ThemeToggleButton
            label="暗"
            active={activeTheme === 'dark'}
            disabled={!!theme}
            isDark={isDark}
            onClick={() => handleThemeChange('dark')}
          />
          <span className="ml-auto flex items-center gap-1">
            <ControlButton isDark={isDark} onClick={() => setCollapsed(false)}>全部展开</ControlButton>
            <ControlButton isDark={isDark} onClick={() => setCollapsed(1)}>折叠 1 层</ControlButton>
            <ControlButton isDark={isDark} onClick={() => setCollapsed(true)}>全部折叠</ControlButton>
          </span>
        </div>
      ) : null}
      <div className="min-h-0 overflow-auto p-3 text-xs leading-relaxed">
        {isObject ? (
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
          <pre className={isDark ? 'text-zinc-100' : 'text-zinc-800'}>{formatScalar(safeValue)}</pre>
        )}
      </div>
    </div>
  );
}

function ThemeToggleButton({
  label,
  active,
  disabled,
  isDark,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  isDark: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-5 min-w-[26px] items-center justify-center rounded px-1.5 text-[11px] tabular-nums transition-colors',
        active
          ? isDark
            ? 'bg-zinc-700 text-zinc-50'
            : 'bg-zinc-900 text-white'
          : isDark
            ? 'text-zinc-300 hover:bg-zinc-800'
            : 'text-zinc-600 hover:bg-zinc-200',
        disabled && 'cursor-not-allowed opacity-60',
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
}: {
  children: React.ReactNode;
  onClick: () => void;
  isDark: boolean;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
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

function formatScalar(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
