import { Link } from '@tanstack/react-router';
import { ClipboardCopy, ExternalLink, GitBranch, MoreHorizontal, PanelRight } from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import { useToast } from '../../components/common/toast';
import { copyText } from '../../shared/formatting/download';

export interface CatalogActionItem {
  eventId?: string;
  sessionId?: string;
  traceId?: string;
}

export function CatalogRowActions<T extends CatalogActionItem>({
  item,
  label,
  copyItems = [],
  showSessionLink = true,
  onOpen,
  onPeek,
}: {
  item: T;
  label: string;
  copyItems?: Array<{ label: string; value?: string }>;
  showSessionLink?: boolean;
  onOpen: (item: T) => void;
  onPeek: (item: T) => void;
}) {
  const { showToast } = useToast();

  async function copy(copyLabel: string, value?: string) {
    if (!value) return;
    try {
      await copyText(value);
      showToast({ tone: 'success', title: `已复制 ${copyLabel}` });
    } catch {
      showToast({ tone: 'danger', title: `${copyLabel} 复制失败` });
    }
  }

  const ids = [
    { label: 'Event ID', value: item.eventId },
    ...copyItems,
    { label: 'Session ID', value: item.sessionId },
    { label: 'Trace ID', value: item.traceId },
  ].filter((entry) => entry.value);

  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button
        size="icon"
        variant="ghost"
        aria-label={`展开${label}预览`}
        onClick={(event) => {
          event.stopPropagation();
          onPeek(item);
        }}
      >
        <PanelRight data-icon="inline-start" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" aria-label={`${label}行操作`}>
            <MoreHorizontal data-icon="inline-start" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => onOpen(item)}>
              <ExternalLink />打开详情
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onPeek(item)}>
              <PanelRight />展开预览
            </DropdownMenuItem>
            {showSessionLink && item.sessionId ? (
              <DropdownMenuItem asChild>
                <Link
                  to="/sessions/$sessionId"
                  params={{ sessionId: item.sessionId }}
                  search={{ eventId: item.eventId }}
                >
                  <GitBranch />查看 Session
                </Link>
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
          {ids.length ? <DropdownMenuSeparator /> : null}
          {ids.length ? (
            <DropdownMenuGroup>
              {ids.map((entry) => (
                <DropdownMenuItem key={entry.label} onSelect={() => void copy(entry.label, entry.value)}>
                  <ClipboardCopy />复制 {entry.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
