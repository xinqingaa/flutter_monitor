import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Clipboard, PanelRightOpen } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Badge } from '../../components/common/status-badge';
import { Button } from '../../components/ui/button';
import { IconTooltipButton } from '../../components/common/icon-tooltip-button';
import { useToast } from '../../components/common/toast';
import type { SessionConsoleRow } from '../../shared/datasource/types';
import { cn } from '../../shared/formatting/cn';
import { formatDuration } from '../../shared/formatting/format';
import { groupLabel, groupTone, iconClass, issueTone, primaryStatusBadge, rowIcon } from './row-display';

type Measurable = { getBoundingClientRect: () => DOMRect };

export function NodePeekPopover({
  row,
  anchorEl,
  open,
  onClose,
  onExpandInspector,
}: {
  row?: SessionConsoleRow;
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  onExpandInspector?: () => void;
}) {
  const anchorElRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    anchorElRef.current = anchorEl;
  }, [anchorEl]);

  const virtualRef = useRef<Measurable>({
    getBoundingClientRect: () => {
      const el = anchorElRef.current;
      return el ? el.getBoundingClientRect() : new DOMRect();
    },
  });

  if (!row) return null;

  return (
    <PopoverPrimitive.Root
      key={row.eventId}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <PopoverPrimitive.Anchor virtualRef={virtualRef} />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          side="bottom"
          sideOffset={8}
          collisionPadding={12}
          avoidCollisions
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="z-30 w-[320px] rounded-lg border border-zinc-200 bg-white p-3 shadow-lg shadow-zinc-900/10 outline-none"
        >
          <NodePeekContent row={row} onExpandInspector={onExpandInspector} onClose={onClose} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function NodePeekContent({
  row,
  onExpandInspector,
  onClose,
}: {
  row: SessionConsoleRow;
  onExpandInspector?: () => void;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const Icon = rowIcon(row);
  const statusBadge = primaryStatusBadge(row);

  async function copyEventId() {
    if (!row.eventId) return;
    try {
      await window.navigator.clipboard.writeText(row.eventId);
      showToast({ tone: 'success', title: '已复制 eventId', description: row.eventId });
    } catch {
      showToast({ tone: 'danger', title: '复制失败', description: '浏览器拒绝了剪贴板写入。' });
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex min-w-0 items-start gap-2">
        <span className={cn('inline-flex size-7 shrink-0 items-center justify-center rounded-md border', iconClass(row))}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-zinc-950" title={row.title}>{row.title}</div>
          {row.route ? (
            <div className="mt-0.5 truncate text-[11px] text-zinc-500" title={row.route}>route {row.route}</div>
          ) : null}
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <Badge tone={groupTone(row.group)} className="rounded-md px-1.5 py-0 text-[11px]">{groupLabel(row.group)}</Badge>
        {statusBadge ? (
          <Badge tone={statusBadge.tone} className="rounded-md px-1.5 py-0 text-[11px]">{statusBadge.label}</Badge>
        ) : null}
        {row.durationMs !== undefined ? (
          <Badge tone={row.durationMs >= 1000 ? 'warn' : 'neutral'} className="rounded-md px-1.5 py-0 text-[11px]">
            {formatDuration(row.durationMs)}
          </Badge>
        ) : null}
        {row.issueLabels.map((label) => (
          <Badge key={label} tone={issueTone(label)} className="rounded-md px-1.5 py-0 text-[11px]">{label}</Badge>
        ))}
      </div>
      <div className="mt-1 flex items-center justify-end gap-1 border-t border-zinc-100 pt-2">
        <IconTooltipButton
          type="button"
          variant="secondary"
          size="icon"
          label="复制 eventId"
          icon={Clipboard}
          disabled={!row.eventId}
          onClick={() => void copyEventId()}
          className="h-7 w-7"
        />
        {onExpandInspector ? (
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-7 gap-1.5 px-2"
            onClick={() => {
              onExpandInspector();
              onClose();
            }}
          >
            <PanelRightOpen className="size-3.5" />
            <span>展开 Inspector</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
