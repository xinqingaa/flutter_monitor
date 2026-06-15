import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, type LucideIcon } from 'lucide-react';
import type * as React from 'react';
import { useEffect, useState } from 'react';
import { IconTooltipButton } from '../ui/icon-tooltip-button';
import { cn } from '../../shared/formatting/cn';

type PanelSide = 'left' | 'right';

export function useCollapsiblePanel(storageKey: string, defaultCollapsed = false, enabled = true) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    if (!enabled) return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored === 'collapsed') setCollapsed(true);
    if (stored === 'expanded') setCollapsed(false);
  }, [enabled, storageKey]);

  useEffect(() => {
    if (!enabled) return;
    window.localStorage.setItem(storageKey, collapsed ? 'collapsed' : 'expanded');
  }, [collapsed, enabled, storageKey]);

  return {
    collapsed,
    setCollapsed,
    toggleCollapsed: () => setCollapsed((value) => !value),
  };
}

export function CollapsiblePanel({
  storageKey,
  title,
  icon: Icon,
  side,
  children,
  className,
  collapsedContent,
  collapsed: controlledCollapsed,
  onToggleCollapsed,
}: {
  storageKey: string;
  title: string;
  icon?: LucideIcon;
  side: PanelSide;
  children: React.ReactNode;
  className?: string;
  collapsedContent?: React.ReactNode;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const internal = useCollapsiblePanel(storageKey, false, controlledCollapsed === undefined);
  const collapsed = controlledCollapsed ?? internal.collapsed;
  const toggleCollapsed = onToggleCollapsed ?? internal.toggleCollapsed;
  const CollapsedIcon = side === 'left' ? PanelLeftOpen : PanelRightOpen;

  return (
    <div className={cn('h-full min-h-0 min-w-0', className)} data-collapsed={collapsed ? 'true' : 'false'}>
      {collapsed ? (
        collapsedContent ?? <CollapsedPanelButton icon={CollapsedIcon} label={`展开${title}`} onClick={toggleCollapsed} />
      ) : (
        children
      )}
    </div>
  );
}

export function CollapsiblePanelAction({
  side,
  title,
  collapsed,
  onToggleCollapsed,
}: {
  side: PanelSide;
  title: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const Icon = collapsed ? (side === 'left' ? PanelLeftOpen : PanelRightOpen) : (side === 'left' ? PanelLeftClose : PanelRightClose);
  return (
    <IconTooltipButton
      type="button"
      variant="secondary"
      size="icon"
      label={`${collapsed ? '展开' : '收起'}${title}`}
      icon={Icon}
      onClick={onToggleCollapsed}
      className="hidden h-7 w-7 text-zinc-500 xl:inline-flex"
    />
  );
}

export function FloatingPanelToggle({
  side,
  title,
  collapsed,
  onToggleCollapsed,
  className,
}: {
  side: PanelSide;
  title: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  className?: string;
}) {
  const Icon = collapsed ? (side === 'left' ? PanelLeftOpen : PanelRightOpen) : (side === 'left' ? PanelLeftClose : PanelRightClose);
  return (
    <button
      type="button"
      onClick={onToggleCollapsed}
      className={cn(
        'hidden items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-2 text-xs font-medium text-zinc-600 shadow-lg shadow-zinc-900/10 transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 xl:inline-flex',
        className,
      )}
      aria-label={`${collapsed ? '展开' : '收起'}${title}`}
      title={`${collapsed ? '展开' : '收起'}${title}`}
    >
      <Icon className="size-4 shrink-0" />
      <span className="sr-only">{`${collapsed ? '展开' : '收起'}${title}`}</span>
    </button>
  );
}

function CollapsedPanelButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hidden h-full min-h-10 w-10 flex-col items-center justify-start gap-2 rounded-lg border border-zinc-200 bg-white px-0 py-3 text-zinc-500 shadow-sm transition-colors hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 xl:inline-flex"
      aria-label={label}
      title={label}
    >
      <Icon className="size-4 shrink-0" />
    </button>
  );
}
